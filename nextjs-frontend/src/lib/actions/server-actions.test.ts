import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Next.js refuses a `"use server"` module that exports anything but async functions, and the error only
 * shows when a page loads the module: typecheck and unit tests pass. This keeps the rule visible.
 */
describe("server action modules", () => {
    const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
    const files = readdirSync(dir).filter((file) => /\.tsx?$/.test(file) && !file.includes(".test."));

    it("export only async functions", () => {
        const offenders: string[] = [];
        for (const file of files) {
            const source = readFileSync(path.join(dir, file), "utf8");
            if (!/^\s*["']use server["'];?/.test(source)) continue;
            for (const line of source.split(/\r?\n/)) {
                if (/^export\s/.test(line) && !/^export\s+async\s+function\s/.test(line) && !/^export\s+(type|interface)\s/.test(line)) {
                    offenders.push(`${file}: ${line.trim()}`);
                }
            }
        }
        expect(offenders).toEqual([]);
    });
});
