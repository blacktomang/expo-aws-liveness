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

## iOS first build: please be patient

The first iOS build can take noticeably longer than Android. This package uses
AWS's native SwiftUI liveness component, which Xcode downloads through Swift
Package Manager along with its AWS dependencies.

On a new machine, a clean cache, or a fresh CI runner, Xcode may spend several
minutes at **Resolving Package Graph** or **Planning build**. It can look like
the build has stopped, but it is usually downloading and preparing those Swift
packages. Once they are cached, later iOS builds are much faster.

If you want to see package-resolution progress directly, run this from your
generated iOS directory (replace `<AppName>` with your app's iOS project name):

```sh
cd ios
xcodebuild -workspace <AppName>.xcworkspace \
  -scheme <AppName> \
  -resolvePackageDependencies
```

For CI, cache the Xcode/Swift Package Manager dependency cache when possible.
The module pins its native AWS dependency versions so the resolved build stays
reproducible.

## Usage

```tsx
import { Platform } from "react-native";
import {
  ExpoAwsLivenessView,
  presentLiveness,
} from "@blacktomang/expo-aws-liveness";

if (Platform.OS === "android") {
  return (
    <ExpoAwsLivenessView
      sessionId={sessionId}
      region="us-east-1"
      identityPoolId="us-east-1:your-identity-pool-id"
      onComplete={() => getLivenessResult(sessionId)}
      onError={(error) => console.error(error.errorCode, error.message)}
      style={{ flex: 1 }}
    />
  );
}

await presentLiveness({
  sessionId,
  region: "us-east-1",
  identityPoolId: "us-east-1:your-identity-pool-id",
});
await getLivenessResult(sessionId);
```

Create the liveness session and retrieve its score on your backend. The client
should receive a one-time `sessionId` and temporary Cognito permissions only
for `rekognition:StartFaceLivenessSession`.
