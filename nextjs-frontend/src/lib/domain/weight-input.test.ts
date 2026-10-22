import { describe, expect, it } from "vitest";

import { parseSelfWeight } from "./weight-input";

describe("parseSelfWeight", () => {
    it("accepts a comma or a dot and one decimal place", () => {
        expect(parseSelfWeight("66,5")).toEqual({ ok: true, kg: 66.5 });
        expect(parseSelfWeight("66.5")).toEqual({ ok: true, kg: 66.5 });
        expect(parseSelfWeight("66")).toEqual({ ok: true, kg: 66 });
        expect(parseSelfWeight(" 30 ")).toEqual({ ok: true, kg: 30 });
        expect(parseSelfWeight("200")).toEqual({ ok: true, kg: 200 });
    });

    it("rejects an empty, out-of-range, or non-numeric value", () => {
        for (const raw of ["", "0", "250", "heavy", "29.9", "200.1", "66.55", "66,50"]) {
            const result = parseSelfWeight(raw);
            expect(result.ok, raw).toBe(false);
        }
    });
});
