import ExpoModulesCore

// Function-based bridge from JS to a host-app implementation that can actually
// import Amplify. This pod has zero Amplify imports — see ExpoAwsLivenessImpl
// for why and AppLivenessImpl (in the app target) for the implementation.
//
// JS API: ExpoAwsLiveness.presentLiveness({ sessionId, region, identityPoolId,
//   disableStartView?, theme? }) → resolves with { isLive: true } on success,
//   rejects with the NSError's domain (which uses Amplify's exception class
//   names where possible — UserCancelledException, AccessDeniedException, etc.).
public class ExpoAwsLivenessModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ExpoAwsLiveness")

    AsyncFunction("presentLiveness") { (params: [String: Any], promise: Promise) in
      guard let impl = ExpoAwsLivenessRegistry.impl else {
        promise.reject(
          "NOT_REGISTERED",
          "ExpoAwsLivenessRegistry.impl is nil. The app's AppLivenessImpl " +
            "wasn't registered. Check that the config plugin's withAppDelegate " +
            "step injected the registration line in AppDelegate."
        )
        return
      }

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

      impl.presentLiveness(
        sessionId: sessionId,
        region: region,
        identityPoolId: identityPoolId,
        disableStartView: disableStartView,
        theme: theme
      ) { result in
        switch result {
        case .success(let isLive):
          promise.resolve(["isLive": isLive])
        case .failure(let error):
          // The NSError's domain is the error code (e.g. UserCancelledException)
          // and the message is the localizedDescription. JS-side classifyNativeError
          // already handles these names cross-platform with Android.
          promise.reject(error.domain, error.localizedDescription)
        }
      }
    }
  }
}
