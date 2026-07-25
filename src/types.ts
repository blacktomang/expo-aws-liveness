// Android dispatches `errorCode` as either "AMPLIFY_CONFIG_CONFLICT" (from our
// own configurator) or the simple class name of the AWS Amplify
// FaceLivenessDetectionException subtype (e.g. "AccessDeniedException",
// "FaceLivenessSessionTimeoutException"). Left as `string` so future SDK
// updates don't need a type bump.
export type LivenessError = {
  code?: string;
  errorCode?: string;
  message: string;
};
