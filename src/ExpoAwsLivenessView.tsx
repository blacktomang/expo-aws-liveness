import * as React from "react";
import type { ViewStyle, StyleProp } from "react-native";
import type { LivenessError, LivenessOptions, LivenessResult } from "./types";
import { NativeExpoAwsLivenessView } from "./NativeExpoAwsLivenessView";

export type LivenessViewProps = LivenessOptions & {
  onComplete?: (result: LivenessResult) => void;
  onError?: (error: LivenessError) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * @deprecated Use <ExpoAwsLiveness ref={ref} /> for a cross-platform API.
 *
 * Android-only view that wraps the native AWS Liveness Detection SDK. This is
 * not a standalone screen — you need to embed this in your own screen, and
 * provide your own header, instructions, error handling, etc.
 */
export function ExpoAwsLivenessView({
  onComplete,
  onError,
  ...rest
}: LivenessViewProps) {
  return (
    <NativeExpoAwsLivenessView
      {...rest}
      autoStart
      attemptId={0}
      onComplete={
        onComplete ? (event) => onComplete(event.nativeEvent) : undefined
      }
      onError={onError ? (event) => onError(event.nativeEvent) : undefined}
    />
  );
}
