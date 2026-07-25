export { ExpoAwsLiveness } from "./src/ExpoAwsLiveness";
export { ExpoAwsLivenessView } from "./src/ExpoAwsLivenessView";
export type { LivenessViewProps } from "./src/ExpoAwsLivenessView";
export type {
  ExpoAwsLivenessHandle,
  ExpoAwsLivenessProps,
  LivenessError,
  LivenessFailure,
  LivenessFailureCode,
  LivenessOptions,
  LivenessResult,
} from "./src/types";
import { presentLivenessOnIos } from "./src/presentLiveness";
import type { LivenessOptions, LivenessResult } from "./src/types";

/**
 * @deprecated Use <ExpoAwsLiveness ref={ref} /> and ref.current.start() for a
 * cross-platform API.
 *
 * iOS only. Presents the FaceLivenessDetectorView modally and resolves with
 * the result. On Android, render <ExpoAwsLivenessView /> instead.
 *
 * The split exists because Amplify Swift v2 is SwiftPM-only, and consuming
 * SwiftPM-only Swift modules from a CocoaPods-based Expo module hits
 * compile-time C-module resolution errors. The Amplify-using Swift code lives
 * in the host app target instead, presented via a function call here.
 */
export async function presentLiveness(
  opts: LivenessOptions,
): Promise<LivenessResult> {
  return presentLivenessOnIos(opts);
}
