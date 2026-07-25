import { requireNativeModule } from "expo";
import { Platform } from "react-native";

export { ExpoAwsLivenessView } from "./src/ExpoAwsLivenessView";
export type { LivenessViewProps } from "./src/ExpoAwsLivenessView";
export type { LivenessError } from "./src/types";

export type LivenessOptions = {
  sessionId: string;
  region: string;
  identityPoolId: string;
  /** Skip the SDK's intro/instructions screen. Default: false. */
  disableStartView?: boolean;
  /** Force "light" or "dark" colour scheme. Omitted = follow system setting. */
  theme?: "light" | "dark";
};

type NativeModule = {
  presentLiveness?: (opts: LivenessOptions) => Promise<{ isLive: boolean }>;
};

// Lazy require so importing this module on Android (where the function isn't
// implemented) doesn't throw at JS load time. The function only exists on iOS
// in this module's current shape.
let cached: NativeModule | undefined;
function nativeModule(): NativeModule {
  if (!cached) {
    cached = requireNativeModule<NativeModule>("ExpoAwsLiveness");
  }
  return cached;
}

/**
 * iOS only. Presents the FaceLivenessDetectorView modally and resolves with
 * the result. On Android, render <ExpoAwsLivenessView /> instead — the native
 * view component is the Android-side API.
 *
 * The split exists because Amplify Swift v2 is SwiftPM-only, and consuming
 * SwiftPM-only Swift modules from a CocoaPods-based Expo module hits
 * compile-time C-module resolution errors. The Amplify-using Swift code lives
 * in the host app target instead, presented via a function call here.
 */
export async function presentLiveness(
  opts: LivenessOptions,
): Promise<{ isLive: boolean }> {
  if (Platform.OS !== "ios") {
    throw new Error(
      "presentLiveness() is iOS-only. On Android, render <ExpoAwsLivenessView /> instead.",
    );
  }
  const fn = nativeModule().presentLiveness;
  if (!fn) {
    throw new Error(
      "ExpoAwsLiveness.presentLiveness is unavailable. Did the AppDelegate registry injection run?",
    );
  }
  return fn(opts);
}
