import * as React from "react";
import { Platform } from "react-native";
import { NativeExpoAwsLivenessView } from "./NativeExpoAwsLivenessView";
import {
  createLivenessFailure,
  normalizeLivenessError,
} from "./normalizeLivenessError";
import { presentLivenessOnIos } from "./presentLiveness";
import type {
  ExpoAwsLivenessHandle,
  ExpoAwsLivenessProps,
  LivenessFailure,
  LivenessOptions,
  LivenessResult,
} from "./types";

type PendingAttempt = {
  attemptId: number;
  onComplete?: (result: LivenessResult) => void;
  onError?: (error: LivenessFailure) => void;
  reject: (reason: LivenessFailure) => void;
  resolve: (result: LivenessResult) => void;
};

function livenessOptions(props: ExpoAwsLivenessProps): LivenessOptions {
  return {
    sessionId: props.sessionId,
    region: props.region,
    identityPoolId: props.identityPoolId,
    disableStartView: props.disableStartView,
    theme: props.theme,
  };
}

function validOptions(options: LivenessOptions): boolean {
  return [options.sessionId, options.region, options.identityPoolId].every(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

function rejectedAttempt(
  error: LivenessFailure,
  onError?: (error: LivenessFailure) => void,
): Promise<LivenessResult> {
  const promise = Promise.reject<LivenessResult>(error);
  // Callbacks are a supported completion channel, so ignoring start() must not
  // create an unhandled-rejection warning. Callers can still await the returned
  // promise and observe the same rejection.
  void promise.catch(() => undefined);
  onError?.(error);
  return promise;
}

/**
 * Cross-platform liveness detector. Call ref.current.start() to begin an
 * attempt; mounting the component does not open the camera or modal.
 */
export const ExpoAwsLiveness = React.forwardRef<
  ExpoAwsLivenessHandle,
  ExpoAwsLivenessProps
>(function ExpoAwsLiveness(props, ref) {
  const [attemptId, setAttemptId] = React.useState(0);
  const currentProps = React.useRef(props);
  const nextAttemptId = React.useRef(0);
  const pendingAttempt = React.useRef<PendingAttempt | null>(null);

  currentProps.current = props;

  const completeAttempt = React.useCallback(
    (id: number, result: LivenessResult) => {
      const pending = pendingAttempt.current;
      if (!pending || pending.attemptId !== id) return;

      pendingAttempt.current = null;
      pending.resolve(result);
      pending.onComplete?.(result);
    },
    [],
  );

  const failAttempt = React.useCallback((id: number, error: LivenessFailure) => {
    const pending = pendingAttempt.current;
    if (!pending || pending.attemptId !== id) return;

    pendingAttempt.current = null;
    pending.reject(error);
    pending.onError?.(error);
  }, []);

  const start = React.useCallback((): Promise<LivenessResult> => {
    const snapshot = currentProps.current;
    const options = livenessOptions(snapshot);
    if (!validOptions(options)) {
      return rejectedAttempt(
        createLivenessFailure(
          "INVALID_PARAMS",
          "sessionId, region, and identityPoolId are all required.",
        ),
        snapshot.onError,
      );
    }
    if (pendingAttempt.current) {
      return rejectedAttempt(
        createLivenessFailure(
          "LIVENESS_IN_PROGRESS",
          "A liveness attempt is already in progress.",
        ),
        snapshot.onError,
      );
    }
    if (Platform.OS !== "android" && Platform.OS !== "ios") {
      return rejectedAttempt(
        createLivenessFailure(
          "UNSUPPORTED_PLATFORM",
          `Face liveness is unsupported on ${Platform.OS}.`,
        ),
        snapshot.onError,
      );
    }

    const id = ++nextAttemptId.current;
    let resolve!: (result: LivenessResult) => void;
    let reject!: (reason: LivenessFailure) => void;
    const promise = new Promise<LivenessResult>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    // See rejectedAttempt: callbacks may be the only API a caller uses.
    void promise.catch(() => undefined);

    pendingAttempt.current = {
      attemptId: id,
      onComplete: snapshot.onComplete,
      onError: snapshot.onError,
      reject,
      resolve,
    };

    if (Platform.OS === "ios") {
      void presentLivenessOnIos(options).then(
        (result) => completeAttempt(id, result),
        (error: unknown) => failAttempt(id, normalizeLivenessError(error)),
      );
    } else {
      setAttemptId(id);
    }

    return promise;
  }, [completeAttempt, failAttempt]);

  React.useImperativeHandle(ref, () => ({ start }), [start]);

  React.useEffect(() => {
    return () => {
      const pending = pendingAttempt.current;
      if (!pending) return;

      pendingAttempt.current = null;
      const error = createLivenessFailure(
        "COMPONENT_UNMOUNTED",
        "The liveness component unmounted before the attempt finished.",
      );
      pending.reject(error);
      pending.onError?.(error);
    };
  }, []);

  const onAndroidComplete = React.useCallback(
    (event: { nativeEvent: LivenessResult & { attemptId: number } }) => {
      completeAttempt(event.nativeEvent.attemptId, {
        isLive: event.nativeEvent.isLive,
      });
    },
    [completeAttempt],
  );

  const onAndroidError = React.useCallback(
    (event: { nativeEvent: { attemptId: number } }) => {
      failAttempt(
        event.nativeEvent.attemptId,
        normalizeLivenessError(event.nativeEvent),
      );
    },
    [failAttempt],
  );

  if (Platform.OS !== "android") return null;

  return React.createElement(NativeExpoAwsLivenessView, {
    sessionId: props.sessionId,
    region: props.region,
    identityPoolId: props.identityPoolId,
    disableStartView: props.disableStartView,
    theme: props.theme,
    style: props.style,
    autoStart: false,
    attemptId,
    onComplete: onAndroidComplete,
    onError: onAndroidError,
  });
});
