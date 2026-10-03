import { describe, expect, it } from "vitest";

import { foldName } from "./query";

describe("foldName", () => {
    it("matches Vietnamese names whether or not they carry accents", () => {
        expect(foldName("Minh  Trần")).toBe(foldName("minh tran"));
        expect(foldName("Đặng Văn Đức")).toBe("dang van duc");
    });

    it("keeps different names apart", () => {
        expect(foldName("Minh Trần")).not.toBe(foldName("Minh Tân"));
    });
});
