import { describe, expect, it } from "vitest";

import {
    academyDayEndIso,
    academyDayStartIso,
    academyWallClockToIso,
    addDaysToKey,
    DAY_MS,
    daysBetween,
    daysBetweenKeys,
    formatNumber,
    formatRelative,
    isDateKey,
    isTimeValue,
    toDateTimeInputValue,
} from "./format";

/**
 * Vectors were produced by the private helpers these functions replace (academyTimeToIso in the
 * clinical and medical actions, academyLocalToIso in the admin actions, academyDateTime in the goal
 * actions and the fixed "+07:00" conversions in the training helpers) — all agreed on every case.
 */
describe("academyWallClockToIso", () => {
    it.each([
        ["2026-09-14", "00:00", "2026-09-13T17:00:00.000Z"],
        ["2026-09-14", "06:59", "2026-09-13T23:59:00.000Z"],
        ["2026-09-14", "07:00", "2026-09-14T00:00:00.000Z"],
        ["2026-09-14", "23:59", "2026-09-14T16:59:00.000Z"],
        ["2026-01-01", "00:30", "2025-12-31T17:30:00.000Z"],
        ["2024-02-29", "12:00", "2024-02-29T05:00:00.000Z"],
        ["2026-12-31", "18:45", "2026-12-31T11:45:00.000Z"],
    ])("%s %s → %s", (dateKey, time, iso) => {
        expect(academyWallClockToIso(dateKey, time)).toBe(iso);
    });

    it("throws on input that isn't a real date and time", () => {
        expect(() => academyWallClockToIso("2026-02-30", "10:00")).toThrow(RangeError);
        expect(() => academyWallClockToIso("2026-09-14", "24:00")).toThrow(RangeError);
        expect(() => academyWallClockToIso("", "")).toThrow(RangeError);
    });

    it("round-trips through toDateTimeInputValue", () => {
        expect(toDateTimeInputValue(academyWallClockToIso("2026-09-14", "18:30"))).toBe("2026-09-14T18:30");
        expect(toDateTimeInputValue("2026-09-13T17:00:00.000Z")).toBe("2026-09-14T00:00");
    });
});

describe("academy day bounds", () => {
    it("spans the academy calendar day", () => {
        expect(academyDayStartIso("2026-09-14")).toBe("2026-09-13T17:00:00.000Z");
        expect(academyDayEndIso("2026-09-14")).toBe("2026-09-14T16:59:00.000Z");
    });
});

describe("date keys", () => {
    it("validates real calendar days only", () => {
        expect(isDateKey("2026-09-14")).toBe(true);
        expect(isDateKey("2024-02-29")).toBe(true);
        expect(isDateKey("2026-02-29")).toBe(false);
        expect(isDateKey("2026-13-01")).toBe(false);
        expect(isDateKey("14/09/2026")).toBe(false);
        expect(isDateKey(undefined)).toBe(false);
    });

    it("validates 24-hour times", () => {
        expect(isTimeValue("00:00")).toBe(true);
        expect(isTimeValue("23:59")).toBe(true);
        expect(isTimeValue("24:00")).toBe(false);
        expect(isTimeValue("7:30")).toBe(false);
        expect(isTimeValue(undefined)).toBe(false);
    });

    it("adds days across month and year ends and leaves invalid keys unchanged", () => {
        expect(addDaysToKey("2026-09-14", 1)).toBe("2026-09-15");
        expect(addDaysToKey("2026-12-31", 1)).toBe("2027-01-01");
        expect(addDaysToKey("2024-03-01", -1)).toBe("2024-02-29");
        expect(addDaysToKey("not-a-date", 3)).toBe("not-a-date");
    });

    it("counts whole days between keys", () => {
        expect(daysBetweenKeys("2026-09-14", "2026-09-21")).toBe(7);
        expect(daysBetweenKeys("2026-09-21", "2026-09-14")).toBe(-7);
        expect(daysBetweenKeys("2026-02-28", "2026-03-01")).toBe(1);
    });

    it("counts calendar days in the academy timezone", () => {
        // 23:30 and 00:30 academy time on consecutive days are one calendar day apart.
        expect(daysBetween("2026-09-14T16:30:00Z", "2026-09-14T17:30:00Z")).toBe(1);
        expect(DAY_MS).toBe(86_400_000);
    });
});

describe("formatRelative and formatNumber", () => {
    const now = "2026-09-14T05:00:00Z";

    it("describes relative times", () => {
        expect(formatRelative("2026-09-14T04:59:30Z", now)).toBe("just now");
        expect(formatRelative("2026-09-14T04:55:00Z", now)).toBe("5 minutes ago");
        expect(formatRelative("2026-09-13T05:00:00Z", now)).toBe("yesterday");
        expect(formatRelative("2026-09-17T05:00:00Z", now)).toBe("in 3 days");
    });

    it("formats decimals consistently with a reused formatter", () => {
        expect(formatNumber(1234.567)).toBe("1,235");
        expect(formatNumber(1234.567, 1)).toBe("1,234.6");
        expect(formatNumber(2, 2)).toBe("2.00");
        expect(formatNumber(1234.567, 1)).toBe("1,234.6");
    });
});
