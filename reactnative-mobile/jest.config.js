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
  // Screen tests render whole trees; with one worker per core they starve each other and
  // waitFor/act time out (16 false failures on a 16-core machine). Half the cores keeps them stable.
  maxWorkers: "50%",
  // A whole doctor-detail tree takes ~4 s alone; the 5 s default fails it under full-suite load.
  testTimeout: 15000,
};
