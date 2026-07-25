package expo.modules.awsliveness

import android.content.Context
import com.amplifyframework.AmplifyException
import com.amplifyframework.auth.cognito.AWSCognitoAuthPlugin
import com.amplifyframework.core.Amplify
import com.amplifyframework.core.AmplifyConfiguration
import org.json.JSONObject

class AmplifyConfigurationConflict(
  message: String,
  cause: Throwable? = null
) : Exception(message, cause)

object AmplifyConfigurator {
  @Volatile
  private var current: Pair<String, String>? = null
  private val lock = Any()

  val isConfigured: Boolean
    get() = current != null

  fun configure(context: Context, region: String, identityPoolId: String) {
    synchronized(lock) {
      current?.let { (curRegion, curPool) ->
        if (curRegion == region && curPool == identityPoolId) return
        throw AmplifyConfigurationConflict(
          "Amplify is already configured for $curRegion / $curPool; " +
            "cannot reconfigure for $region / $identityPoolId in the same process."
        )
      }

      val json = JSONObject().apply {
        put("UserAgent", "aws-amplify-cli/2.0")
        put("Version", "1.0")
        put(
          "auth",
          JSONObject().put(
            "plugins",
            JSONObject().put(
              "awsCognitoAuthPlugin",
              JSONObject()
                .put("UserAgent", "aws-amplify-cli/2.0")
                .put("Version", "1.0")
                .put("IdentityManager", JSONObject().put("Default", JSONObject()))
                .put(
                  "CredentialsProvider",
                  JSONObject().put(
                    "CognitoIdentity",
                    JSONObject().put(
                      "Default",
                      JSONObject()
                        .put("PoolId", identityPoolId)
                        .put("Region", region)
                    )
                  )
                )
            )
          )
        )
      }

      try {
        Amplify.addPlugin(AWSCognitoAuthPlugin())
        Amplify.configure(
          AmplifyConfiguration.fromJson(json),
          context.applicationContext
        )
      } catch (e: AmplifyException) {
        throw AmplifyConfigurationConflict(
          "Amplify.configure failed — host app may have already configured " +
            "Amplify with different values: ${e.message}",
          e
        )
      }

      current = region to identityPoolId
    }
  }
}
