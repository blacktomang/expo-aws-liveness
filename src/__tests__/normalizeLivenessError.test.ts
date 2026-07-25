import {
  createLivenessFailure,
  normalizeLivenessError,
} from "../normalizeLivenessError";

describe("normalizeLivenessError", () => {
  it("maps Android timeout errors to a stable code", () => {
    expect(
      normalizeLivenessError({
        errorCode: "FaceLivenessSessionTimeoutException",
        message: "Timed out",
      }),
    ).toEqual({
      code: "SESSION_TIMED_OUT",
      nativeErrorCode: "FaceLivenessSessionTimeoutException",
      message: "Timed out",
    });
  });

  it("maps iOS promise rejection codes to the same stable code", () => {
    expect(
      normalizeLivenessError({
        code: "SessionTimedOutException",
        message: "The session expired.",
      }),
    ).toEqual({
      code: "SESSION_TIMED_OUT",
      nativeErrorCode: "SessionTimedOutException",
      message: "The session expired.",
    });
  });

  it("preserves unknown native codes for diagnostics", () => {
    expect(
      normalizeLivenessError({
        errorCode: "FutureSdkError",
        message: "Something new happened.",
      }),
    ).toEqual({
      code: "UNKNOWN",
      nativeErrorCode: "FutureSdkError",
      message: "Something new happened.",
    });
  });

  it("creates wrapper failures without inventing a native code", () => {
    expect(
      createLivenessFailure("LIVENESS_IN_PROGRESS", "Already running."),
    ).toEqual({
      code: "LIVENESS_IN_PROGRESS",
      message: "Already running.",
    });
  });
});
