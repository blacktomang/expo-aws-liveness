import ExpoModulesCore
import Amplify
import AWSCognitoAuthPlugin
import FaceLiveness
import Foundation
import SwiftUI
import UIKit

// JS API: ExpoAwsLiveness.presentLiveness({ sessionId, region, identityPoolId,
//   disableStartView?, theme? }) → resolves with { isLive: true } on success,
//   rejects with the NSError's domain (which uses Amplify's exception class
//   names where possible — UserCancelledException, AccessDeniedException, etc.).
public class ExpoAwsLivenessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAwsLiveness")

    AsyncFunction("presentLiveness") { (params: [String: Any], promise: Promise) in
      let sessionId = (params["sessionId"] as? String) ?? ""
      let region = (params["region"] as? String) ?? ""
      let identityPoolId = (params["identityPoolId"] as? String) ?? ""
      let disableStartView = (params["disableStartView"] as? Bool) ?? false
      let theme = params["theme"] as? String

      guard !sessionId.isEmpty, !region.isEmpty, !identityPoolId.isEmpty else {
        promise.reject(
          "INVALID_PARAMS",
          "sessionId, region, and identityPoolId are all required"
        )
        return
      }

      do {
        try Self.configureAmplifyIfNeeded(region: region, identityPoolId: identityPoolId)
      } catch {
        promise.reject(error.domain, error.localizedDescription)
        return
      }

      DispatchQueue.main.async {
        guard let presenter = Self.topViewController() else {
          promise.reject(
            "NO_PRESENTER",
            "No UIViewController available to present from."
          )
          return
        }

        var hostingController: UIHostingController<LivenessHost>?

        let host = LivenessHost(
          sessionId: sessionId,
          region: region,
          disableStartView: disableStartView,
          theme: theme,
          completion: { result in
            DispatchQueue.main.async {
              hostingController?.dismiss(animated: true) {
                switch result {
                case .success(let isLive):
                  promise.resolve(["isLive": isLive])
                case .failure(let error):
                  promise.reject(error.domain, error.localizedDescription)
                }
              }
            }
          }
        )

        let controller = UIHostingController(rootView: host)
        controller.modalPresentationStyle = .fullScreen
        hostingController = controller
        presenter.present(controller, animated: true)
      }
    }
  }

  // MARK: - Amplify configuration

  // Process-wide flag — Amplify.configure can only be called once per
  // process. We track the (region, identityPoolId) we configured with so we
  // can short-circuit duplicate calls and surface a typed error when the
  // host JS asks us to reconfigure with different values.
  private static var configured: (region: String, identityPoolId: String)?
  private static let configureLock = NSLock()

  private static func configureAmplifyIfNeeded(region: String, identityPoolId: String) throws {
    configureLock.lock()
    defer { configureLock.unlock() }

    if let current = configured {
      if current.region == region && current.identityPoolId == identityPoolId {
        return
      }
      throw NSError(
        domain: "AMPLIFY_CONFIG_CONFLICT",
        code: -1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Amplify is already configured for \(current.region) / \(current.identityPoolId); " +
            "cannot reconfigure for \(region) / \(identityPoolId) in the same process."
        ]
      )
    }

    let json: [String: Any] = [
      "UserAgent": "aws-amplify-cli/2.0",
      "Version": "1.0",
      "auth": [
        "plugins": [
          "awsCognitoAuthPlugin": [
            "UserAgent": "aws-amplify-cli/2.0",
            "Version": "1.0",
            "IdentityManager": ["Default": [:]],
            "CredentialsProvider": [
              "CognitoIdentity": [
                "Default": [
                  "PoolId": identityPoolId,
                  "Region": region
                ]
              ]
            ]
          ]
        ]
      ]
    ]

    do {
      let data = try JSONSerialization.data(withJSONObject: json)
      let config = try JSONDecoder().decode(AmplifyConfiguration.self, from: data)
      try Amplify.add(plugin: AWSCognitoAuthPlugin())
      try Amplify.configure(config)
      configured = (region, identityPoolId)
    } catch {
      throw NSError(
        domain: "AMPLIFY_CONFIG_CONFLICT",
        code: -1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Amplify.configure failed (host app may have already configured it differently): \(error.localizedDescription)"
        ]
      )
    }
  }

  // MARK: - Presentation

  private static func topViewController() -> UIViewController? {
    // Podspec pins iOS 15.1 as the minimum, so UIWindowScene.windows is
    // always available; no fallback to the deprecated UIApplication.shared.windows.
    let scenes = UIApplication.shared.connectedScenes
    let active = scenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene
    let keyWindow = active?.windows.first(where: { $0.isKeyWindow })
    var top = keyWindow?.rootViewController
    while let presented = top?.presentedViewController {
      top = presented
    }
    return top
  }
}

// MARK: - SwiftUI host

/// SwiftUI host that wraps FaceLivenessDetectorView. Translates the SDK's
/// Result<Void, FaceLivenessDetectionError> into the NSError-based completion
/// the module expects. Error domains use Amplify exception class names so the
/// JS-side classifyNativeError works the same as on Android.
private struct LivenessHost: View {
  let sessionId: String
  let region: String
  let disableStartView: Bool
  let theme: String?
  let completion: (Result<Bool, NSError>) -> Void

  @State private var isPresented: Bool = true
  @State private var didReport: Bool = false

  var body: some View {
    let detector = FaceLivenessDetectorView(
      sessionID: sessionId,
      region: region,
      disableStartView: disableStartView,
      isPresented: $isPresented,
      onCompletion: { result in
        report(result)
      }
    )

    return Group {
      switch theme {
      case "light":
        detector.preferredColorScheme(.light)
      case "dark":
        detector.preferredColorScheme(.dark)
      default:
        detector
      }
    }
    .onChange(of: isPresented) { presented in
      if !presented {
        // The detector flipped its binding off without a completion result —
        // treat as a user cancel. Guarded by didReport in case onCompletion
        // already fired.
        report(.failure(.userCancelled))
      }
    }
  }

  private func report(_ result: Result<Void, FaceLivenessDetectionError>) {
    if didReport { return }
    didReport = true
    switch result {
    case .success:
      completion(.success(true))
    case .failure(let error):
      let (domain, message) = mapError(error)
      completion(.failure(NSError(
        domain: domain,
        code: -1,
        userInfo: [NSLocalizedDescriptionKey: message]
      )))
    }
  }

  private func mapError(_ error: FaceLivenessDetectionError) -> (String, String) {
    switch error {
    case .userCancelled:
      return ("UserCancelledException", "User cancelled the face liveness check.")
    case .accessDenied:
      return ("AccessDeniedException", "Access denied for face liveness session.")
    case .sessionTimedOut:
      return ("SessionTimedOutException", "Liveness session timed out.")
    case .faceInOvalMatchExceededTimeLimitError:
      return ("SessionTimedOutException", "Face match exceeded the time limit.")
    case .cameraPermissionDenied:
      return ("CameraPermissionDeniedException", "Camera permission denied.")
    case .cameraNotAvailable:
      return ("CameraNotAvailableException", "Camera is unavailable on this device.")
    case .sessionNotFound:
      return ("SessionNotFoundException", "Liveness session not found.")
    case .socketClosed:
      return ("SocketClosedException", "Connection to the liveness service closed unexpectedly.")
    case .invalidRegion:
      return ("InvalidRegionException", "The AWS region is invalid.")
    case .validation:
      return ("ValidationException", "Liveness request failed validation.")
    case .internalServer:
      return ("InternalServerException", "Liveness service internal error.")
    case .throttling:
      return ("ThrottlingException", "Too many requests; please try again later.")
    case .serviceQuotaExceeded:
      return ("ServiceQuotaExceededException", "Liveness service quota exceeded.")
    case .serviceUnavailable:
      return ("ServiceUnavailableException", "Liveness service is currently unavailable.")
    case .invalidSignature:
      return ("InvalidSignatureException", "Liveness request signature was rejected.")
    case .unknown:
      return ("UnknownException", "An unknown liveness error occurred.")
    default:
      return (String(describing: type(of: error)), String(describing: error))
    }
  }
}

private extension Result where Failure == FaceLivenessDetectionError {
  static var userCancelled: Result<Success, Failure> {
    .failure(.userCancelled)
  }
}
