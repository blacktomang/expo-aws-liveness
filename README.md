# @blacktomang/expo-aws-liveness

An Expo native module for Amazon Rekognition Face Liveness. It bridges AWS's
official Android Compose and iOS SwiftUI liveness components to an Expo app.

This package requires a native build. It does **not** run in Expo Go.

## Install

```sh
pnpm add @blacktomang/expo-aws-liveness
```

Add the plugin to your Expo configuration. It adds Android camera permission
and, unless you already set one, an iOS camera-usage description.

```ts
// app.config.ts
export default {
  expo: {
    plugins: [
      [
        "@blacktomang/expo-aws-liveness",
        {
          cameraPermission:
            "Allow $(PRODUCT_NAME) to use the camera for face verification.",
        },
      ],
    ],
  },
};
```

Rebuild native projects after adding or upgrading the package:

```sh
npx expo prebuild --clean
npx expo run:android
# or: npx expo run:ios
```

## Usage

```tsx
import { useRef } from "react";
import { Button } from "react-native";
import {
  ExpoAwsLiveness,
  type ExpoAwsLivenessHandle,
} from "@blacktomang/expo-aws-liveness";

function VerifyFace() {
  const liveness = useRef<ExpoAwsLivenessHandle>(null);

  const startLiveness = async () => {
    if (!liveness.current) return;

    try {
      await liveness.current.start();
      await getLivenessResult(sessionId);
    } catch (error) {
      // onError receives the same normalized failure.
    }
  };

  return (
    <>
      <ExpoAwsLiveness
        ref={liveness}
        sessionId={sessionId}
        region="us-east-1"
        identityPoolId="us-east-1:your-identity-pool-id"
        onError={(error) =>
          console.error(error.code, error.nativeErrorCode, error.message)
        }
        style={{ flex: 1 }}
      />
      <Button title="Verify face" onPress={startLiveness} />
    </>
  );
}
```

`start()` returns `{ isLive: true }` on completion and invokes `onComplete` / `onError` with the same outcome. An overlapping call rejects with `LIVENESS_IN_PROGRESS`. Errors use a stable `code` and retain the iOS or Android SDK value in `nativeErrorCode`.

Android displays the detector inside `ExpoAwsLiveness`, so `style` controls its layout. iOS presents the detector full-screen and ignores `style`.

## Why iOS and Android differ internally

Android can embed AWS Face Liveness directly: the AWS SDK exposes a Jetpack Compose component, which this module mounts inside a React Native native view.

iOS uses the same public `ExpoAwsLiveness` API, but presents the detector modally. AWS Face Liveness and its Amplify dependencies are Swift Package Manager packages, while Expo modules compile as CocoaPods. Importing those Swift packages from the Expo pod fails native AWS C-module resolution. To work around that limitation, the config plugin adds the Swift packages and a small liveness implementation to the host app target, where SwiftPM dependencies link correctly.

This means that on iOS the detector:

- Is always presented full-screen from the active view controller; it cannot be embedded or styled as a React Native view.
- Requires the config plugin's generated AppDelegate registration and host-app Swift source.
- Returns its result after the modal screen finishes, while Android receives native view events. `ExpoAwsLiveness` normalizes both approaches behind `start()`, `onComplete`, and `onError`.

On both platforms, Amplify can only be configured once per app process. Reusing the module with a different region or identity pool returns `AMPLIFY_CONFIG_CONFLICT`.

## Legacy APIs

`ExpoAwsLivenessView` (Android-only) and `presentLiveness` (iOS-only) remain available for existing applications, but are deprecated. Migrate to `ExpoAwsLiveness` to remove platform branches from application code.

```tsx
// Deprecated Android-only API
<ExpoAwsLivenessView
  sessionId={sessionId}
  region="us-east-1"
  identityPoolId="us-east-1:your-identity-pool-id"
  onComplete={() => getLivenessResult(sessionId)}
  onError={(error) => console.error(error.errorCode, error.message)}
  style={{ flex: 1 }}
/>
```

Create the liveness session and retrieve its score on your backend. The client
should receive a one-time `sessionId` and temporary Cognito permissions only
for `rekognition:StartFaceLivenessSession`.

## Publish privately

Commit this directory to a private Git repository, tag releases, then either
install by Git URL or publish it to a private npm-compatible registry.

```sh
pnpm build
npm pack                 # inspect the actual archive first
npm publish              # after configuring your registry and credentials
```

Change the `name` field in `package.json` if your npm scope is not `@blacktomang`.
