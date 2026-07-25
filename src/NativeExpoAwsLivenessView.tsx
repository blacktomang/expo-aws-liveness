import type { StyleProp, ViewStyle } from "react-native";
import { requireNativeView } from "expo";
import type {
  LivenessError,
  LivenessOptions,
  LivenessResult,
} from "./types";

export type NativeLivenessViewProps = LivenessOptions & {
  /** Keeps the deprecated view API's mount-to-start behaviour. */
  autoStart: boolean;
  /** Identifies an explicit attempt from the cross-platform component. */
  attemptId: number;
  onComplete?: (event: {
    nativeEvent: LivenessResult & { attemptId: number };
  }) => void;
  onError?: (event: {
    nativeEvent: LivenessError & { attemptId: number };
  }) => void;
  style?: StyleProp<ViewStyle>;
};

export const NativeExpoAwsLivenessView =
  requireNativeView<NativeLivenessViewProps>("ExpoAwsLiveness");
