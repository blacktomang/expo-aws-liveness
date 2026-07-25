import type { StyleProp, ViewStyle } from "react-native";

export type LivenessResult = {
  isLive: boolean;
};

export type LivenessOptions = {
  sessionId: string;
  region: string;
  identityPoolId: string;
  /** Skip the SDK's intro/instructions screen. Default: false. */
  disableStartView?: boolean;
  /** Force "light" or "dark" colour scheme. Omitted = follow system setting. */
  theme?: "light" | "dark";
};

export type LivenessFailureCode =
  | "ACCESS_DENIED"
  | "AMPLIFY_CONFIG_CONFLICT"
  | "CAMERA_NOT_AVAILABLE"
  | "CAMERA_PERMISSION_DENIED"
  | "COMPONENT_UNMOUNTED"
  | "CONNECTION_CLOSED"
  | "INTERNAL_SERVER_ERROR"
  | "INVALID_PARAMS"
  | "INVALID_REGION"
  | "INVALID_SIGNATURE"
  | "LIVENESS_IN_PROGRESS"
  | "NO_PRESENTER"
  | "NOT_REGISTERED"
  | "SERVICE_QUOTA_EXCEEDED"
  | "SERVICE_UNAVAILABLE"
  | "SESSION_NOT_FOUND"
  | "SESSION_TIMED_OUT"
  | "THROTTLED"
  | "UNKNOWN"
  | "UNSUPPORTED_PLATFORM"
  | "USER_CANCELLED"
  | "VALIDATION_FAILED";

/** A platform-neutral liveness failure used by <ExpoAwsLiveness />. */
export type LivenessFailure = {
  /** Stable, documented error category. */
  code: LivenessFailureCode;
  /** Original iOS or Android native error code, when one was provided. */
  nativeErrorCode?: string;
  message: string;
};

export type ExpoAwsLivenessProps = LivenessOptions & {
  onComplete?: (result: LivenessResult) => void;
  onError?: (error: LivenessFailure) => void;
  /** Sizes the embedded detector on Android. iOS always presents modally. */
  style?: StyleProp<ViewStyle>;
};

export type ExpoAwsLivenessHandle = {
  /** Starts one liveness attempt with the component's current props. */
  start: () => Promise<LivenessResult>;
};

// Android dispatches `errorCode` as either "AMPLIFY_CONFIG_CONFLICT" (from our
// own configurator) or the simple class name of the AWS Amplify
// FaceLivenessDetectionException subtype (e.g. "AccessDeniedException",
// "FaceLivenessSessionTimeoutException"). Left as `string` so future SDK
// updates don't need a type bump. This is retained for the deprecated
// ExpoAwsLivenessView API; use LivenessFailure with ExpoAwsLiveness instead.
export type LivenessError = {
  code?: string;
  errorCode?: string;
  message: string;
};
