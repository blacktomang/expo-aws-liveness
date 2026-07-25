package expo.modules.awsliveness

// Wraps com.amplifyframework.ui:liveness:1.5.0 (FaceLivenessDetector Compose UI).
//
// Credentials path: programmatic Amplify.configure() at runtime, built from the
// region + identityPoolId props the host JS passes in. Limitation —
// Amplify.configure can only be called once per process; reconfiguring with a
// different identity pool throws AmplifyConfigurationConflict, surfaced to JS
// as errorCode "AMPLIFY_CONFIG_CONFLICT".
//
// Docs: https://ui.docs.amplify.aws/android/connected-components/liveness

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ExpoAwsLivenessModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoAwsLiveness")

    View(ExpoAwsLivenessView::class) {
      Events("onComplete", "onError")

      Prop("sessionId") { view: ExpoAwsLivenessView, sessionId: String ->
        view.sessionId = sessionId
      }

      Prop("region") { view: ExpoAwsLivenessView, region: String ->
        view.region = region
      }

      Prop("identityPoolId") { view: ExpoAwsLivenessView, identityPoolId: String ->
        view.identityPoolId = identityPoolId
      }

      Prop("disableStartView") { view: ExpoAwsLivenessView, disableStartView: Boolean ->
        view.disableStartView = disableStartView
      }

      Prop("theme") { view: ExpoAwsLivenessView, theme: String? ->
        view.theme = theme
      }
    }
  }
}
