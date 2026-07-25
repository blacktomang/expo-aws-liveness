const React = require("react");
const TestRenderer = require("react-test-renderer");

global.IS_REACT_ACT_ENVIRONMENT = true;

let mockNativeViewProps;
const mockPresentLiveness = jest.fn();

jest.mock("expo", () => ({
  requireNativeView: () => {
    return function MockNativeView(props) {
      mockNativeViewProps = props;
      return null;
    };
  },
  requireNativeModule: () => ({ presentLiveness: mockPresentLiveness }),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "android" },
}));

const { Platform } = require("react-native");
const { ExpoAwsLiveness } = require("../ExpoAwsLiveness");

const options = {
  sessionId: "session-id",
  region: "us-east-1",
  identityPoolId: "us-east-1:identity-pool-id",
};

function renderDetector(extraProps = {}) {
  const ref = React.createRef();
  let renderer;
  TestRenderer.act(() => {
    renderer = TestRenderer.create(
      React.createElement(ExpoAwsLiveness, { ...options, ...extraProps, ref }),
    );
  });
  return { ref, renderer };
}

describe("ExpoAwsLiveness", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    Platform.OS = "android";
    mockNativeViewProps = undefined;
    mockPresentLiveness.mockReset();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("does not launch Android liveness until start() is called", () => {
    renderDetector();

    expect(mockNativeViewProps.autoStart).toBe(false);
    expect(mockNativeViewProps.attemptId).toBe(0);
  });

  it("settles the Android promise and callback from its matching attempt", async () => {
    const onComplete = jest.fn();
    const { ref } = renderDetector({ onComplete });
    let attempt;

    TestRenderer.act(() => {
      attempt = ref.current.start();
    });
    expect(mockNativeViewProps.attemptId).toBe(1);

    await TestRenderer.act(async () => {
      mockNativeViewProps.onComplete({
        nativeEvent: { attemptId: 1, isLive: true },
      });
    });

    await expect(attempt).resolves.toEqual({ isLive: true });
    expect(onComplete).toHaveBeenCalledWith({ isLive: true });
  });

  it("rejects overlapping starts without replacing the active Android attempt", async () => {
    const onError = jest.fn();
    const { ref } = renderDetector({ onError });
    let firstAttempt;

    TestRenderer.act(() => {
      firstAttempt = ref.current.start();
    });
    const secondAttempt = ref.current.start();

    await expect(secondAttempt).rejects.toMatchObject({
      code: "LIVENESS_IN_PROGRESS",
    });
    expect(mockNativeViewProps.attemptId).toBe(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "LIVENESS_IN_PROGRESS" }),
    );

    await TestRenderer.act(async () => {
      mockNativeViewProps.onError({
        nativeEvent: {
          attemptId: 1,
          errorCode: "AccessDeniedException",
          message: "Denied",
        },
      });
    });
    await expect(firstAttempt).rejects.toMatchObject({
      code: "ACCESS_DENIED",
      nativeErrorCode: "AccessDeniedException",
    });
  });

  it("rejects invalid runtime options before starting a native attempt", async () => {
    const onError = jest.fn();
    const { ref } = renderDetector({ sessionId: "", onError });

    await expect(ref.current.start()).rejects.toMatchObject({
      code: "INVALID_PARAMS",
    });
    expect(mockNativeViewProps.attemptId).toBe(0);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "INVALID_PARAMS" }),
    );
  });

  it("ignores a stale Android event after a later attempt starts", async () => {
    const { ref } = renderDetector();
    let firstAttempt;

    TestRenderer.act(() => {
      firstAttempt = ref.current.start();
    });
    await TestRenderer.act(async () => {
      mockNativeViewProps.onComplete({
        nativeEvent: { attemptId: 1, isLive: true },
      });
    });
    await expect(firstAttempt).resolves.toEqual({ isLive: true });

    let secondAttempt;
    TestRenderer.act(() => {
      secondAttempt = ref.current.start();
    });
    mockNativeViewProps.onComplete({
      nativeEvent: { attemptId: 1, isLive: true },
    });

    let settled = false;
    void secondAttempt.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await TestRenderer.act(async () => {
      mockNativeViewProps.onComplete({
        nativeEvent: { attemptId: 2, isLive: true },
      });
    });
    await expect(secondAttempt).resolves.toEqual({ isLive: true });
  });

  it("uses the iOS presenter and normalizes its rejected error", async () => {
    Platform.OS = "ios";
    const onError = jest.fn();
    const { ref } = renderDetector({ onError });
    mockPresentLiveness.mockRejectedValue({
      code: "UserCancelledException",
      message: "Cancelled",
    });

    const attempt = ref.current.start();

    await expect(attempt).rejects.toEqual({
      code: "USER_CANCELLED",
      nativeErrorCode: "UserCancelledException",
      message: "Cancelled",
    });
    expect(mockPresentLiveness).toHaveBeenCalledWith(options);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: "USER_CANCELLED" }),
    );
  });
});
