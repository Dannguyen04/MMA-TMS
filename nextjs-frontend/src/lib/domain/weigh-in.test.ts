import { describe, expect, it } from "vitest";

import type { Bout, BoutStatus, WeightWarningStatus } from "./types";
import { activeBout, parseWeightKg } from "./weigh-in";

function bout(id: string, status: BoutStatus, weighInAt: string, weight: WeightWarningStatus | null = null): Bout {
    return {
        id,
        status,
        weighInAt,
        deletedAt: null,
        weight: weight ? { status: weight, latestKg: null, latestOn: null, remainingPct: null, referencePath: [] } : undefined,
    } as Bout;
}

describe("parseWeightKg", () => {
    it("accepts a comma or a dot as the decimal separator", () => {
        expect(parseWeightKg("66,5")).toEqual({ ok: true, kg: 66.5 });
        expect(parseWeightKg("66.5")).toEqual({ ok: true, kg: 66.5 });
        expect(parseWeightKg(" 70 ")).toEqual({ ok: true, kg: 70 });
    });

    it("rounds to 0.1 kg", () => {
        expect(parseWeightKg("66.46")).toEqual({ ok: true, kg: 66.5 });
    });

    it("rejects empty, non-numeric and out-of-range values", () => {
        expect(parseWeightKg("").ok).toBe(false);
        expect(parseWeightKg("abc").ok).toBe(false);
        expect(parseWeightKg("66kg").ok).toBe(false);
        expect(parseWeightKg("-60").ok).toBe(false);
        expect(parseWeightKg("0").ok).toBe(false);
        expect(parseWeightKg("250").ok).toBe(false);
        expect(parseWeightKg("29.9").ok).toBe(false);
        expect(parseWeightKg("200").ok).toBe(true);
        expect(parseWeightKg("abc")).toEqual({ ok: false, error: "notNumber" });
        expect(parseWeightKg("250")).toEqual({ ok: false, error: "range" });
        expect(parseWeightKg(" ")).toEqual({ ok: false, error: "empty" });
    });
});

describe("activeBout", () => {
    it("picks the earliest weigh-in among running bouts", () => {
        const bouts = [
            bout("later", "SCHEDULED", "2026-11-20T02:00:00.000Z"),
            bout("done", "COMPLETED", "2026-09-01T02:00:00.000Z"),
            bout("soon", "CAMP", "2026-10-22T02:00:00.000Z"),
            bout("cancelled", "CANCELLED", "2026-10-20T02:00:00.000Z"),
        ];
        expect(activeBout(bouts)?.id).toBe("soon");
    });

    it("returns null when every bout is finished", () => {
        expect(activeBout([bout("done", "COMPLETED", "2026-09-01T02:00:00.000Z")])).toBeNull();
        expect(activeBout([])).toBeNull();
    });
});
