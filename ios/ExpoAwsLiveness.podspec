Pod::Spec.new do |s|
  s.name           = 'ExpoAwsLiveness'
  s.version        = '0.1.0'
  s.summary        = 'AWS Amplify FaceLiveness wrapper for Expo'
  s.description    = 'Bridges the Amplify FaceLivenessDetectorView SwiftUI component to React Native via Expo Modules.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.license        = 'MIT'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  # No Amplify or FaceLiveness deps. The pod has zero Amplify imports — those
  # SPM-only modules are consumed by the host app target (where SPM works
  # natively) via AppLivenessImpl.swift, which the bundled config plugin
  # copies into the app target's source phase at prebuild.

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
