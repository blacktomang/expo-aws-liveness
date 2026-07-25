import type { LivenessFailure, LivenessFailureCode } from "./types";

const CODE_MAP: Record<string, LivenessFailureCode> = {
  AMPLIFY_CONFIG_CONFLICT: "AMPLIFY_CONFIG_CONFLICT",
  AccessDeniedException: "ACCESS_DENIED",
  CameraNotAvailableException: "CAMERA_NOT_AVAILABLE",
  CameraPermissionDeniedException: "CAMERA_PERMISSION_DENIED",
  FaceLivenessSessionTimeoutException: "SESSION_TIMED_OUT",
  InternalServerException: "INTERNAL_SERVER_ERROR",
  InvalidRegionException: "INVALID_REGION",
  InvalidSignatureException: "INVALID_SIGNATURE",
  NO_PRESENTER: "NO_PRESENTER",
  NOT_REGISTERED: "NOT_REGISTERED",
  ServiceQuotaExceededException: "SERVICE_QUOTA_EXCEEDED",
  ServiceUnavailableException: "SERVICE_UNAVAILABLE",
  SessionNotFoundException: "SESSION_NOT_FOUND",
  SessionTimedOutException: "SESSION_TIMED_OUT",
  SocketClosedException: "CONNECTION_CLOSED",
  ThrottlingException: "THROTTLED",
  UNKNOWN: "UNKNOWN",
  UnknownException: "UNKNOWN",
  UserCancelledException: "USER_CANCELLED",
  ValidationException: "VALIDATION_FAILED",
};

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function errorRecord(error: unknown): Record<string, unknown> | undefined {
  return typeof error === "object" && error !== null
    ? (error as Record<string, unknown>)
    : undefined;
}

export function createLivenessFailure(
  code: LivenessFailureCode,
  message: string,
  nativeErrorCode?: string,
): LivenessFailure {
  return {
    code,
    ...(nativeErrorCode ? { nativeErrorCode } : {}),
    message,
  };
}

/** Converts Android event payloads and iOS promise rejections to one shape. */
export function normalizeLivenessError(error: unknown): LivenessFailure {
  const record = errorRecord(error);
  const nativeErrorCode =
    stringValue(record?.errorCode) ?? stringValue(record?.code);
  const message =
    stringValue(record?.message) ??
    (error instanceof Error ? error.message : undefined) ??
    "An unknown liveness error occurred.";

  return createLivenessFailure(
    nativeErrorCode ? (CODE_MAP[nativeErrorCode] ?? "UNKNOWN") : "UNKNOWN",
    message,
    nativeErrorCode,
  );
}
