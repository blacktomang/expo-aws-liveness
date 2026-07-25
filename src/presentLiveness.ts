import { requireNativeModule } from "expo";
import { Platform } from "react-native";
import type { LivenessOptions, LivenessResult } from "./types";

type NativeModule = {
  presentLiveness?: (opts: LivenessOptions) => Promise<LivenessResult>;
};

let cached: NativeModule | undefined;

function nativeModule(): NativeModule {
  if (!cached) {
    cached = requireNativeModule<NativeModule>("ExpoAwsLiveness");
  }
  return cached;
}

/** Internal iOS bridge used by the cross-platform component. */
export async function presentLivenessOnIos(
  opts: LivenessOptions,
): Promise<LivenessResult> {
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
