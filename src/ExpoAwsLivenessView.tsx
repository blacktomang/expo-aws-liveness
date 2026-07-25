import * as React from "react";
import type { ViewStyle, StyleProp } from "react-native";
import type { LivenessError } from "./types";
import { requireNativeView } from "expo";

export type LivenessViewProps = {
  sessionId: string;
  region: string;
  identityPoolId: string;
  /** Skip the SDK's intro/instructions screen. Default: false. */
  disableStartView?: boolean;
  /** Force "light" or "dark" colour scheme. Omitted = follow system setting. */
  theme?: "light" | "dark";
  onComplete?: (result: { isLive: boolean }) => void;
  onError?: (error: LivenessError) => void;
  style?: StyleProp<ViewStyle>;
};

type NativeViewProps = Omit<LivenessViewProps, "onComplete" | "onError"> & {
  onComplete?: (event: { nativeEvent: { isLive: boolean } }) => void;
  onError?: (event: { nativeEvent: LivenessError }) => void;
};

const NativeView = requireNativeView<NativeViewProps>("ExpoAwsLiveness");

/**
 * android-only view that wraps the native AWS Liveness Detection SDK. This is not a standalone screen — you need to embed this in your own screen, and provide your own header, instructions, error handling, etc.
 */
export function ExpoAwsLivenessView({
  onComplete,
  onError,
  ...rest
}: LivenessViewProps) {
  return (
    <NativeView
      {...rest}
      onComplete={
        onComplete ? (event) => onComplete(event.nativeEvent) : undefined
      }
      onError={onError ? (event) => onError(event.nativeEvent) : undefined}
    />
  );
}
