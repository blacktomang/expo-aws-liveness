import Foundation

/// Protocol the host app implements (in app-target Swift code that can see SPM
/// packages) to actually do the Amplify configuration + present the
/// FaceLivenessDetectorView. The pod target itself doesn't import Amplify
/// because that triggers a chain of C-module resolution failures
/// (AwsCAuth, AwsCCommon, ...) that pod targets can't satisfy.
public protocol ExpoAwsLivenessImpl: AnyObject {
  func presentLiveness(
    sessionId: String,
    region: String,
    identityPoolId: String,
    disableStartView: Bool,
    theme: String?,
    completion: @escaping (Result<Bool, NSError>) -> Void
  )
}

/// Process-wide registry. The host app's AppDelegate (or anything that runs at
/// startup) sets `impl` to its concrete implementation. Our config plugin
/// injects that registration line into AppDelegate via withAppDelegate.
public final class ExpoAwsLivenessRegistry {
  public static var impl: ExpoAwsLivenessImpl?
  private init() {}
}
