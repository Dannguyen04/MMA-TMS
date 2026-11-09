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
        // Tests that load the whole demo store take 5–7 s while every worker imports at once on a busy machine;
        // the 5 s default made them fail at random (T-040 C).
        testTimeout: 20_000,
    },
});
