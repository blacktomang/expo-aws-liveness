require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ExpoAwsLiveness'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.author         = package['author']
  s.homepage       = package['homepage']
  s.license        = package['license']
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/blacktomang/expo-aws-liveness.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift Package Manager dependencies are declared directly in the podspec.
  # The spm_dependency helper is provided by react-native/scripts/react_native_pods.rb
  # (React Native 0.81+) and wires the packages into the Pods project.
  spm_dependency(s,
    url: 'https://github.com/aws-amplify/amplify-swift.git',
    requirement: { kind: 'exactVersion', version: '2.51.5' },
    products: ['Amplify', 'AWSCognitoAuthPlugin']
  )

  spm_dependency(s,
    url: 'https://github.com/aws-amplify/amplify-ui-swift-liveness.git',
    requirement: { kind: 'exactVersion', version: '1.4.4' },
    products: ['FaceLiveness']
  )

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
