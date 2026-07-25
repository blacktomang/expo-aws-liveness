const {
  withAndroidManifest,
  withAppBuildGradle,
  withInfoPlist,
} = require("@expo/config-plugins");

const CAMERA_PERMISSION = "android.permission.CAMERA";
const DEFAULT_IOS_CAMERA_PERMISSION =
  "Allow $(PRODUCT_NAME) to use the camera for face verification.";
const DESUGAR_LIB = "com.android.tools:desugar_jdk_libs:2.1.5";
// 4.x/5.x mixed resolution crashes RN at okhttp3.internal.Util; uniform 5.x
// satisfies both RN's JavaNetCookieJar and AWS Smithy's ConnectionListener.
const OKHTTP_VERSION = "5.0.0-alpha.14";

function ensureCameraPermission(manifest) {
  manifest["uses-permission"] = manifest["uses-permission"] ?? [];
  const already = manifest["uses-permission"].some(
    (p) => p?.$?.["android:name"] === CAMERA_PERMISSION,
  );
  if (!already) {
    manifest["uses-permission"].push({
      $: { "android:name": CAMERA_PERMISSION },
    });
  }
  return manifest;
}

// Amplify AARs declare `requires core library desugaring on the consumer`.
// AGP refuses to link without it, so inject both the build option and the
// dependency into android/app/build.gradle.
function ensureCoreLibraryDesugaring(contents) {
  let out = contents;

  if (!out.includes("coreLibraryDesugaringEnabled")) {
    if (/compileOptions\s*\{/.test(out)) {
      out = out.replace(
        /compileOptions\s*\{/,
        (match) => `${match}\n        coreLibraryDesugaringEnabled true`,
      );
    } else {
      out = out.replace(
        /android\s*\{/,
        (match) =>
          `${match}\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n        sourceCompatibility JavaVersion.VERSION_17\n        targetCompatibility JavaVersion.VERSION_17\n    }`,
      );
    }
  }

  if (
    !out.includes("coreLibraryDesugaring ") &&
    !out.includes("coreLibraryDesugaring(")
  ) {
    const depBlock = /dependencies\s*\{/;
    if (depBlock.test(out)) {
      out = out.replace(
        depBlock,
        (match) => `${match}\n    coreLibraryDesugaring '${DESUGAR_LIB}'`,
      );
    }
  }

  return out;
}

function ensureOkHttpResolution(contents) {
  if (contents.includes("// expo-aws-liveness: pin okhttp")) {
    return contents;
  }
  const block = `
// expo-aws-liveness: pin okhttp\nconfigurations.all {\n    resolutionStrategy {\n        force 'com.squareup.okhttp3:okhttp:${OKHTTP_VERSION}'\n        force 'com.squareup.okhttp3:logging-interceptor:${OKHTTP_VERSION}'\n        force 'com.squareup.okhttp3:okhttp-urlconnection:${OKHTTP_VERSION}'\n    }\n}\n`;
  return contents + block;
}

const withAwsLiveness = (config, props = {}) => {
  let next = withAndroidManifest(config, (cfg) => {
    cfg.modResults.manifest = ensureCameraPermission(cfg.modResults.manifest);
    return cfg;
  });

  next = withAppBuildGradle(next, (cfg) => {
    if (cfg.modResults.language === "groovy") {
      let contents = cfg.modResults.contents;
      contents = ensureCoreLibraryDesugaring(contents);
      contents = ensureOkHttpResolution(contents);
      cfg.modResults.contents = contents;
    }
    return cfg;
  });

  next = withInfoPlist(next, (cfg) => {
    if (!cfg.modResults.NSCameraUsageDescription) {
      cfg.modResults.NSCameraUsageDescription =
        props.cameraPermission || DEFAULT_IOS_CAMERA_PERMISSION;
    }
    return cfg;
  });

  return next;
};

module.exports = withAwsLiveness;
module.exports.default = withAwsLiveness;
