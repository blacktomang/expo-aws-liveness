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

## Publish privately

Commit this directory to a private Git repository, tag releases, then either
install by Git URL or publish it to a private npm-compatible registry.

```sh
pnpm build
npm pack                 # inspect the actual archive first
npm publish              # after configuring your registry and credentials
```

Change the `name` field in `package.json` if your npm scope is not `@blacktomang`.
