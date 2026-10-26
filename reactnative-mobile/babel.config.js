module.exports = function (api) {
  const isTest = api.env("test");
  api.cache.using(() => process.env.NODE_ENV ?? "development");
  return {
    presets: isTest
      ? ["babel-preset-expo"]
      : [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
    // Must stay last.
    plugins: ["react-native-worklets/plugin"],
  };
};
