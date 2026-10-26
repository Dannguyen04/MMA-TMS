/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    // Mô hình 3D (.glb) là asset nhị phân: thay bằng id giả trong test.
    "\\.glb$": "<rootDir>/test-stubs/asset-stub.js",
  },
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/", "/.expo/"],
};
