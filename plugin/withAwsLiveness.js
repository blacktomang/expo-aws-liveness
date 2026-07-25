const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  withAndroidManifest,
  withAppBuildGradle,
  withAppDelegate,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require("@expo/config-plugins");
const {
  mergeContents,
} = require("@expo/config-plugins/build/utils/generateCode");

const APP_TARGET_SOURCE_DIR = path.join(__dirname, "..", "ios-app-target");
// Must equal the pbxproj path written by ensureAppTargetSourceFile —
// otherwise Xcode reports "Build input file cannot be found". Lives at the
// ios/ root because nesting under the EBuddy PBXGroup wasn't reliable.
const APP_TARGET_DEST_SUBDIR = "expo-aws-liveness-impl";

const CAMERA_PERMISSION = "android.permission.CAMERA";
const DEFAULT_IOS_CAMERA_PERMISSION =
  "Allow $(PRODUCT_NAME) to use the camera for face verification.";
const DESUGAR_LIB = "com.android.tools:desugar_jdk_libs:2.1.5";
// 4.x/5.x mixed resolution crashes RN at okhttp3.internal.Util; uniform 5.x
// satisfies both RN's JavaNetCookieJar and AWS Smithy's ConnectionListener.
const OKHTTP_VERSION = "5.0.0-alpha.14";

// FaceLiveness 1.4.4 declares amplify-swift `from: "2.51.5"`. Pinning the two
// together; bump in lockstep — see README.
const SPM_PACKAGES = [
  {
    repo: "https://github.com/aws-amplify/amplify-swift.git",
    exactVersion: "2.51.5",
    products: ["Amplify", "AWSCognitoAuthPlugin"],
    label: "amplify-swift",
  },
  {
    repo: "https://github.com/aws-amplify/amplify-ui-swift-liveness.git",
    exactVersion: "1.4.4",
    products: ["FaceLiveness"],
    label: "amplify-ui-swift-liveness",
  },
];

function pbxObjId(seed) {
  return crypto
    .createHash("md5")
    .update(seed)
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();
}

// xcode 3.0.1 (Expo's bundled version) has no high-level SPM helpers, so we
// write XCRemoteSwiftPackageReference / XCSwiftPackageProductDependency
// sections directly. The pbxWriter serialises any section key it finds.
function ensureSwiftPackage(project, pkg) {
  const { repo, products, label } = pkg;
  const requirement = pkg.exactVersion
    ? { kind: "exactVersion", version: pkg.exactVersion }
    : {
        kind: "upToNextMajorVersion",
        minimumVersion: pkg.minimumVersion,
      };

  const objects = project.hash.project.objects;
  objects.XCRemoteSwiftPackageReference =
    objects.XCRemoteSwiftPackageReference || {};
  objects.XCSwiftPackageProductDependency =
    objects.XCSwiftPackageProductDependency || {};

  const pkgRefId = pbxObjId(`expo-aws-liveness-pkgref::${repo}`);
  const pkgRefComment = `XCRemoteSwiftPackageReference "${label}"`;

  const refSection = objects.XCRemoteSwiftPackageReference;
  if (!refSection[pkgRefId]) {
    refSection[pkgRefId] = {
      isa: "XCRemoteSwiftPackageReference",
      repositoryURL: `"${repo}"`,
      requirement,
    };
    refSection[`${pkgRefId}_comment`] = pkgRefComment;
  }

  const pbxProjectSection = objects.PBXProject || {};
  for (const id of Object.keys(pbxProjectSection)) {
    if (id.endsWith("_comment")) continue;
    const proj = pbxProjectSection[id];
    proj.packageReferences = proj.packageReferences || [];
    if (!proj.packageReferences.find((r) => r.value === pkgRefId)) {
      proj.packageReferences.push({ value: pkgRefId, comment: pkgRefComment });
    }
  }

  const depSection = objects.XCSwiftPackageProductDependency;
  const targetSection = objects.PBXNativeTarget || {};
  const buildFileSection = objects.PBXBuildFile || {};
  objects.PBXBuildFile = buildFileSection;
  const frameworksPhaseSection = objects.PBXFrameworksBuildPhase || {};

  for (const product of products) {
    const depId = pbxObjId(`expo-aws-liveness-proddep::${repo}::${product}`);
    const buildFileId = pbxObjId(
      `expo-aws-liveness-buildfile::${repo}::${product}`,
    );

    if (!depSection[depId]) {
      depSection[depId] = {
        isa: "XCSwiftPackageProductDependency",
        package: pkgRefId,
        package_comment: pkgRefComment,
        productName: product,
      };
      depSection[`${depId}_comment`] = product;
    }

    if (!buildFileSection[buildFileId]) {
      buildFileSection[buildFileId] = {
        isa: "PBXBuildFile",
        productRef: depId,
        productRef_comment: product,
      };
      buildFileSection[`${buildFileId}_comment`] = `${product} in Frameworks`;
    }

    for (const tid of Object.keys(targetSection)) {
      if (tid.endsWith("_comment")) continue;
      const target = targetSection[tid];
      if (target.productType !== '"com.apple.product-type.application"') continue;

      target.packageProductDependencies = target.packageProductDependencies || [];
      if (!target.packageProductDependencies.find((d) => d.value === depId)) {
        target.packageProductDependencies.push({
          value: depId,
          comment: product,
        });
      }

      // Without this PBXFrameworksBuildPhase entry, Xcode declares the package
      // but doesn't add it to the link line — runtime "framework not found".
      const phaseRefs = target.buildPhases || [];
      for (const phaseRef of phaseRefs) {
        const phaseId = phaseRef.value || phaseRef;
        const phase = frameworksPhaseSection[phaseId];
        if (!phase) continue;
        phase.files = phase.files || [];
        if (!phase.files.find((f) => (f.value || f) === buildFileId)) {
          phase.files.push({
            value: buildFileId,
            comment: `${product} in Frameworks`,
          });
        }
      }
    }
  }
}

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
  const block = `\n// expo-aws-liveness: pin okhttp\nconfigurations.all {\n    resolutionStrategy {\n        force 'com.squareup.okhttp3:okhttp:${OKHTTP_VERSION}'\n        force 'com.squareup.okhttp3:logging-interceptor:${OKHTTP_VERSION}'\n        force 'com.squareup.okhttp3:okhttp-urlconnection:${OKHTTP_VERSION}'\n    }\n}\n`;
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

  next = withDangerousMod(next, [
    "ios",
    async (cfg) => {
      const platformProjectRoot = cfg.modRequest.platformProjectRoot;
      const destDir = path.join(platformProjectRoot, APP_TARGET_DEST_SUBDIR);
      try {
        fs.mkdirSync(destDir, { recursive: true });
        const files = fs.readdirSync(APP_TARGET_SOURCE_DIR).filter((f) =>
          f.endsWith(".swift"),
        );
        for (const file of files) {
          fs.copyFileSync(
            path.join(APP_TARGET_SOURCE_DIR, file),
            path.join(destDir, file),
          );
        }
      } catch (err) {
        console.warn(
          "[expo-aws-liveness] Failed to copy app-target Swift files: " +
            (err && err.message ? err.message : err),
        );
      }
      return cfg;
    },
  ]);

  next = withXcodeProject(next, (cfg) => {
    const project = cfg.modResults;
    try {
      for (const pkg of SPM_PACKAGES) {
        ensureSwiftPackage(project, pkg);
      }
    } catch (err) {
      console.warn(
        "[expo-aws-liveness] Failed to add Swift Packages: " +
          (err && err.message ? err.message : err),
      );
    }

    try {
      const files = fs
        .readdirSync(APP_TARGET_SOURCE_DIR)
        .filter((f) => f.endsWith(".swift"));
      for (const file of files) {
        ensureAppTargetSourceFile(project, file);
      }
    } catch (err) {
      console.warn(
        "[expo-aws-liveness] Failed to register app-target Swift files: " +
          (err && err.message ? err.message : err),
      );
    }

    return cfg;
  });

  next = withAppDelegate(next, (cfg) => {
    if (cfg.modResults.language !== "swift") return cfg;
    cfg.modResults.contents = injectRegistryRegistration(
      cfg.modResults.contents,
    );
    return cfg;
  });

  return next;
};

function ensureAppTargetSourceFile(project, swiftFileName) {
  const objects = project.hash.project.objects;

  const refPath = `${APP_TARGET_DEST_SUBDIR}/${swiftFileName}`;
  const fileRefId = pbxObjId(`expo-aws-liveness-fileref::${refPath}`);
  const buildFileId = pbxObjId(`expo-aws-liveness-srcbuildfile::${refPath}`);

  const fileRefSection = (objects.PBXFileReference =
    objects.PBXFileReference || {});
  if (!fileRefSection[fileRefId]) {
    fileRefSection[fileRefId] = {
      isa: "PBXFileReference",
      lastKnownFileType: "sourcecode.swift",
      path: `"${swiftFileName}"`,
      sourceTree: '"<group>"',
    };
    fileRefSection[`${fileRefId}_comment`] = swiftFileName;
  }

  const buildFileSection = (objects.PBXBuildFile = objects.PBXBuildFile || {});
  if (!buildFileSection[buildFileId]) {
    buildFileSection[buildFileId] = {
      isa: "PBXBuildFile",
      fileRef: fileRefId,
      fileRef_comment: swiftFileName,
    };
    buildFileSection[`${buildFileId}_comment`] =
      `${swiftFileName} in Sources`;
  }

  // Locate the app-target group dynamically by matching the application
  // target's name (e.g. "EBuddy" or "RBApp") against PBXGroup `name`/`path`.
  // Hardcoding "EBuddy" broke the RBApp prebuild: no group named "EBuddy"
  // exists in that pbxproj, so the impl group was created as an orphan,
  // Xcode resolved the file path relative to project root, and the build
  // failed with "Build input file cannot be found: ios/AppLivenessImpl.swift".
  const groupSection = objects.PBXGroup || {};
  const appTargetSection = objects.PBXNativeTarget || {};
  const appTargetNames = [];
  for (const tid of Object.keys(appTargetSection)) {
    if (tid.endsWith("_comment")) continue;
    const target = appTargetSection[tid];
    if (target.productType !== '"com.apple.product-type.application"') continue;
    const rawName = target.name;
    if (!rawName) continue;
    appTargetNames.push(String(rawName).replace(/^"|"$/g, ""));
  }

  let appGroupId = null;
  for (const id of Object.keys(groupSection)) {
    if (id.endsWith("_comment")) continue;
    const g = groupSection[id];
    const groupName = String(g.name ?? "").replace(/^"|"$/g, "");
    const groupPath = String(g.path ?? "").replace(/^"|"$/g, "");
    if (
      appTargetNames.includes(groupName) ||
      appTargetNames.includes(groupPath)
    ) {
      appGroupId = id;
      break;
    }
  }
  const implGroupId = pbxObjId("expo-aws-liveness-impl-group");
  if (!groupSection[implGroupId]) {
    groupSection[implGroupId] = {
      isa: "PBXGroup",
      children: [],
      path: '"expo-aws-liveness-impl"',
      sourceTree: '"<group>"',
    };
    groupSection[`${implGroupId}_comment`] = "expo-aws-liveness-impl";
    if (appGroupId) {
      const appGroup = groupSection[appGroupId];
      appGroup.children = appGroup.children || [];
      if (!appGroup.children.find((c) => c.value === implGroupId)) {
        appGroup.children.push({
          value: implGroupId,
          comment: "expo-aws-liveness-impl",
        });
      }
    } else {
      console.warn(
        "[expo-aws-liveness] Could not locate the application target's " +
          "PBXGroup (looked for: " +
          appTargetNames.join(", ") +
          "). The Swift impl file will not be nested in the app group, " +
          "which may cause Xcode to fail with 'Build input file cannot be " +
          "found'.",
      );
    }
  }
  const implGroup = groupSection[implGroupId];
  implGroup.children = implGroup.children || [];
  if (!implGroup.children.find((c) => c.value === fileRefId)) {
    implGroup.children.push({ value: fileRefId, comment: swiftFileName });
  }

  const sourcesPhaseSection = objects.PBXSourcesBuildPhase || {};
  const targetSection = objects.PBXNativeTarget || {};
  for (const tid of Object.keys(targetSection)) {
    if (tid.endsWith("_comment")) continue;
    const target = targetSection[tid];
    if (target.productType !== '"com.apple.product-type.application"') continue;
    for (const phaseRef of target.buildPhases || []) {
      const phaseId = phaseRef.value || phaseRef;
      const phase = sourcesPhaseSection[phaseId];
      if (!phase) continue;
      phase.files = phase.files || [];
      if (!phase.files.find((f) => (f.value || f) === buildFileId)) {
        phase.files.push({
          value: buildFileId,
          comment: `${swiftFileName} in Sources`,
        });
      }
    }
  }
}

function injectRegistryRegistration(contents) {
  let next = contents;
  if (!next.includes("import ExpoAwsLiveness")) {
    const importMerge = mergeContents({
      tag: "expo-aws-liveness-import",
      src: next,
      newSrc: "import ExpoAwsLiveness",
      anchor: /^import Expo$/m,
      offset: 1,
      comment: "//",
    });
    if (importMerge.didMerge || importMerge.didClear) {
      next = importMerge.contents;
    }
  }

  // Anchor on bindReactNativeFactory(factory) so the registry is set before
  // the JS bridge starts running.
  if (!next.includes("ExpoAwsLivenessRegistry.impl")) {
    const registerMerge = mergeContents({
      tag: "expo-aws-liveness-registry",
      src: next,
      newSrc: "    ExpoAwsLivenessRegistry.impl = AppLivenessImpl()",
      anchor: /bindReactNativeFactory\(factory\)/,
      offset: 1,
      comment: "//",
    });
    if (registerMerge.didMerge || registerMerge.didClear) {
      next = registerMerge.contents;
    }
  }

  return next;
}

module.exports = withAwsLiveness;
module.exports.default = withAwsLiveness;
