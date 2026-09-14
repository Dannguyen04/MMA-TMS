import { describe, expect, it } from "vitest";

import { roleForPath, routes, safeRedirectPath } from "./routes";

/** A redirect target is safe when it is null or a path that stays on the current origin. */
function staysOnOrigin(target: string | null): boolean {
    if (target === null) return true;
    const base = "https://academy.example";
    return target.startsWith("/") && !target.startsWith("//") && new URL(target, base).origin === base;
}

describe("safeRedirectPath", () => {
    const hostile = [
        "/\t/evil.example",
        "/\n/evil.example",
        "/\r/x",
        "/\\evil.example",
        "//evil.example",
        "/%2F/evil.example",
        "https://evil.example",
        "",
        "/.//evil.example",
        "/..//evil.example",
        "\\/evil.example",
        "/\u0000/evil.example",
    ];

    it.each(hostile)("never leaves the origin for %j", (value) => {
        expect(staysOnOrigin(safeRedirectPath(value))).toBe(true);
    });

    it("rejects control characters, backslashes, encoded separators and other hosts outright", () => {
        for (const value of [
            "/\t/evil.example",
            "/\n/evil.example",
            "/\r/x",
            "/\\evil.example",
            "//evil.example",
            "/%2F/evil.example",
            "/%5cevil.example",
            "https://evil.example",
            "",
            "/.//evil.example",
        ]) {
            expect(safeRedirectPath(value)).toBeNull();
        }
        expect(safeRedirectPath(null)).toBeNull();
        expect(safeRedirectPath(undefined)).toBeNull();
    });

    it("allows encoded characters in the query string", () => {
        expect(safeRedirectPath("/admin/audit-logs?q=a%2Fb")).toBe("/admin/audit-logs?q=a%2Fb");
    });

    it("returns ordinary in-app paths unchanged", () => {
        expect(safeRedirectPath("/coach/sessions?week=2#x")).toBe("/coach/sessions?week=2#x");
        expect(safeRedirectPath(routes.fighter.dashboard)).toBe("/fighter/dashboard");
    });

    it("normalizes dot segments so the role check sees the real area", () => {
        const target = safeRedirectPath("/fighter/../admin/users");
        expect(target).toBe("/admin/users");
        expect(roleForPath(target ?? "")).toBe("admin");
    });
});

describe("routes.api", () => {
    it("encodes job ids into the polling URL", () => {
        expect(routes.api.aiJob("job-minh-bag-today")).toBe("/api/ai-jobs/job-minh-bag-today");
        expect(routes.api.aiJob("a/b?c")).toBe("/api/ai-jobs/a%2Fb%3Fc");
    });
});
