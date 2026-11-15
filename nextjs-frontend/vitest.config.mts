import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            // Services guard against client bundling with `server-only`; tests run on the server.
            "server-only": fileURLToPath(new URL("./src/test/server-only-stub.ts", import.meta.url)),
        },
    },
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
        setupFiles: ["./src/test/i18n-setup.ts"],
        // Tests run in demo mode whatever the shell or CI sets: CI exports APP_DATA_MODE=api for typecheck and
        // build (next.config refuses demo in production builds), and 60 demo-store tests failed under it.
        // A test that needs API mode stubs it itself (vi.stubEnv("APP_DATA_MODE", "api")).
        env: { APP_DATA_MODE: "demo" },
        // Tests that load the whole demo store take 5–7 s while every worker imports at once on a busy machine;
        // the 5 s default made them fail at random (T-040 C).
        testTimeout: 20_000,
    },
});
