module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/src/**/__tests__/**/*.(test|spec).[jt]s?(x)"],
  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      { configFile: require.resolve("expo-module-scripts/babel.config.cli.js") },
    ],
  },
  watchman: false,
};
