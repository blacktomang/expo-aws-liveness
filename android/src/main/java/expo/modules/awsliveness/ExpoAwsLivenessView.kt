package expo.modules.awsliveness

import android.content.Context
import android.content.ContextWrapper
import android.util.Log
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.lifecycle.findViewTreeLifecycleOwner
import androidx.lifecycle.findViewTreeViewModelStoreOwner
import androidx.lifecycle.setViewTreeLifecycleOwner
import androidx.lifecycle.setViewTreeViewModelStoreOwner
import androidx.savedstate.findViewTreeSavedStateRegistryOwner
import androidx.savedstate.setViewTreeSavedStateRegistryOwner
import com.amplifyframework.ui.liveness.ui.FaceLivenessDetector
import com.amplifyframework.ui.liveness.ui.LivenessColorScheme
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

private const val TAG = "ExpoAwsLiveness"

class ExpoAwsLivenessView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {

  val onComplete by EventDispatcher()
  val onError by EventDispatcher()

  var sessionId: String = ""
    set(value) {
      field = value
      tryMount()
    }

  var region: String = ""
    set(value) {
      field = value
      tryMount()
    }

  var identityPoolId: String = ""
    set(value) {
      field = value
      tryMount()
    }

  var disableStartView: Boolean = false
    set(value) {
      field = value
      tryMount()
    }

  var theme: String? = null
    set(value) {
      field = value
      tryMount()
    }

  // The deprecated ExpoAwsLivenessView starts when mounted. The new
  // cross-platform component opts out and supplies an incrementing attemptId
  // each time its imperative start() method is called.
  var autoStart: Boolean = false
    set(value) {
      field = value
      tryMount()
    }

  var attemptId: Int = 0
    set(value) {
      field = value
      tryMount()
    }

  private val composeView = ComposeView(context).apply {
    layoutParams = FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT)
    setViewCompositionStrategy(
      ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed
    )
  }

  private var mountedAttemptId: Int? = null

  init {
    addView(composeView)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    // RN wraps the activity in a ThemedReactContext (a ContextWrapper), so a
    // direct cast to ComponentActivity returns null. Walk up the wrapper chain
    // — and fall back to AppContext.currentActivity — so Compose's tree owners
    // actually get set. Without these, the ComposeView never composes.
    val activity = findActivity()
    if (activity == null) {
      Log.w(TAG, "Could not resolve a ComponentActivity; ComposeView won't compose.")
    } else {
      if (composeView.findViewTreeLifecycleOwner() == null) {
        composeView.setViewTreeLifecycleOwner(activity)
      }
      if (composeView.findViewTreeViewModelStoreOwner() == null) {
        composeView.setViewTreeViewModelStoreOwner(activity)
      }
      if (composeView.findViewTreeSavedStateRegistryOwner() == null) {
        composeView.setViewTreeSavedStateRegistryOwner(activity)
      }
    }
    tryMount()
  }

  private fun findActivity(): ComponentActivity? {
    var ctx: Context? = context
    while (ctx is ContextWrapper) {
      if (ctx is ComponentActivity) return ctx
      ctx = ctx.baseContext
    }
    val fallback = appContext.currentActivity
    return fallback as? ComponentActivity
  }

  private fun tryMount() {
    val requestedAttemptId = if (autoStart) 0 else attemptId.takeIf { it > 0 }
    if (requestedAttemptId == null) {
      Log.d(TAG, "tryMount: waiting for an explicit attempt")
      return
    }
    if (mountedAttemptId == requestedAttemptId) {
      Log.d(TAG, "tryMount: attempt $requestedAttemptId already mounted, skipping")
      return
    }
    if (sessionId.isEmpty() || region.isEmpty() || identityPoolId.isEmpty()) {
      Log.d(
        TAG,
        "tryMount: waiting for props (sessionId=${sessionId.isNotEmpty()}, " +
          "region=${region.isNotEmpty()}, identityPoolId=${identityPoolId.isNotEmpty()})"
      )
      return
    }
    if (!isAttachedToWindow) {
      Log.d(TAG, "tryMount: not yet attached to window")
      return
    }

    Log.d(
      TAG,
      "tryMount: configuring Amplify and mounting FaceLivenessDetector for attempt $requestedAttemptId"
    )

    // A completed or failed detector can be started again only by replacing
    // its Compose composition. The JS wrapper prevents overlapping attempts,
    // so this only happens between settled attempts.
    if (mountedAttemptId != null) {
      composeView.disposeComposition()
      mountedAttemptId = null
    }

    try {
      AmplifyConfigurator.configure(context, region, identityPoolId)
    } catch (e: AmplifyConfigurationConflict) {
      Log.e(TAG, "AmplifyConfigurationConflict", e)
      onError(
        mapOf(
          "message" to (e.message ?: "Amplify configuration conflict"),
          "errorCode" to "AMPLIFY_CONFIG_CONFLICT",
          "attemptId" to requestedAttemptId
        )
      )
      return
    } catch (e: Throwable) {
      Log.e(TAG, "Amplify configure threw", e)
      onError(
        mapOf(
          "message" to (e.message ?: "Failed to configure Amplify"),
          "errorCode" to e::class.simpleName.orEmpty(),
          "attemptId" to requestedAttemptId
        )
      )
      return
    }

    val capturedSessionId = sessionId
    val capturedRegion = region
    val capturedDisableStartView = disableStartView
    val capturedTheme = theme
    val capturedAttemptId = requestedAttemptId

    Log.d(
      TAG,
      "tryMount: theme=$capturedTheme, disableStartView=$capturedDisableStartView",
    )

    composeView.setContent {
      val colorScheme = when (capturedTheme) {
        // The lib only exposes light/dark as properties on a nested Defaults
        // object — confirmed by inspecting liveness-1.5.0.aar. The top-level
        // default() picks based on isSystemInDarkTheme().
        "light" -> LivenessColorScheme.Defaults.lightColorScheme
        "dark" -> LivenessColorScheme.Defaults.darkColorScheme
        else -> LivenessColorScheme.default()
      }
      MaterialTheme(colorScheme = colorScheme) {
        FaceLivenessDetector(
          sessionId = capturedSessionId,
          region = capturedRegion,
          disableStartView = capturedDisableStartView,
          onComplete = {
            Log.d(TAG, "FaceLivenessDetector onComplete")
            onComplete(
              mapOf(
                "isLive" to true,
                "attemptId" to capturedAttemptId
              )
            )
          },
          onError = { error ->
            // FaceLivenessDetectionException is not a Throwable in liveness:1.5.0
            // (despite what the AWS docs imply), so we can't pass it as Log.e's
            // third arg — log its class + message instead.
            Log.e(TAG, "FaceLivenessDetector onError: ${error::class.simpleName}: ${error.message}")
            onError(
              mapOf(
                "message" to error.message,
                "errorCode" to error::class.simpleName.orEmpty(),
                "attemptId" to capturedAttemptId
              )
            )
          },
        )
      }
    }
    mountedAttemptId = requestedAttemptId
    // Force a relayout — on RN Fabric, child native views sometimes need a
    // nudge after setContent runs.
    composeView.requestLayout()
    requestLayout()
  }

  override fun onDetachedFromWindow() {
    composeView.disposeComposition()
    mountedAttemptId = null
    super.onDetachedFromWindow()
  }
}
