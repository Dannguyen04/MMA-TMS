import { describe, expect, it } from "vitest";

import { addDaysToKey, dayKey } from "@/lib/format";
import {
    calculateSnapshotAcuteLimit,
    calculateWeightWarning,
    canEnterFightWeek,
    computeWeightPoints,
    evaluateGate1,
} from "./bout-rules";
import type { BoutRequirement } from "./types";

describe("bout-rules", () => {
    describe("Criteria 2: Snapshot acute loss limit threshold", () => {
        const base = new Date("2026-10-20T10:00:00Z");

        it("returns 8.0 when weigh-in is 24 hours before the bout", () => {
            const weighIn = new Date(base.getTime() - 24 * 60 * 60 * 1000);
            expect(calculateSnapshotAcuteLimit(weighIn, base)).toBe(8.0);
        });

        it("returns 5.0 when weigh-in is 6 hours before the bout", () => {
            const weighIn = new Date(base.getTime() - 6 * 60 * 60 * 1000);
            expect(calculateSnapshotAcuteLimit(weighIn, base)).toBe(5.0);
        });

        it("returns 8.0 when weigh-in is exactly 12 hours before the bout", () => {
            const weighIn = new Date(base.getTime() - 12 * 60 * 60 * 1000);
            expect(calculateSnapshotAcuteLimit(weighIn, base)).toBe(8.0);
        });

        it("respects custom ruleset threshold percentages", () => {
            const ruleset = { acuteLossLimitPctLong: 10.0, acuteLossLimitPctShort: 6.0 };
            const weighInLong = new Date(base.getTime() - 24 * 60 * 60 * 1000);
            const weighInShort = new Date(base.getTime() - 4 * 60 * 60 * 1000);
            expect(calculateSnapshotAcuteLimit(weighInLong, base, ruleset)).toBe(10.0);
            expect(calculateSnapshotAcuteLimit(weighInShort, base, ruleset)).toBe(6.0);
        });
    });

    describe("Criteria 4: Gate 1 checklist evaluation", () => {
        const boutDate = "2026-11-15T19:00:00+07:00"; // Academy day: 2026-11-15

        it("fails Gate 1 and lists missing items when a required item is MISSING", () => {
            const requirements: BoutRequirement[] = [
                {
                    id: "r1",
                    boutId: "b1",
                    code: "HEALTH_CERT",
                    label: "Medical Certificate",
                    required: true,
                    status: "MISSING",
                    issuedOn: null,
                    validUntil: null,
                    source: "PRESET",
                    statusReason: null,
                },
                {
                    id: "r2",
                    boutId: "b1",
                    code: "BLOOD_TEST",
                    label: "Blood Test",
                    required: true,
                    status: "PROVIDED",
                    issuedOn: "2026-10-01",
                    validUntil: "2026-12-01",
                    source: "PRESET",
                    statusReason: null,
                },
            ];

            const result = evaluateGate1(requirements, boutDate);
            expect(result.passed).toBe(false);
            expect(result.missing).toEqual(["Medical Certificate"]);
            expect(result.expiring).toEqual([]);
        });

        it("fails Gate 1 when a required PROVIDED item has validUntil before the bout date", () => {
            const requirements: BoutRequirement[] = [
                {
                    id: "r1",
                    boutId: "b1",
                    code: "HEALTH_CERT",
                    label: "Medical Certificate",
                    required: true,
                    status: "PROVIDED",
                    issuedOn: "2026-05-01",
                    validUntil: "2026-11-14", // 1 day before boutDate (2026-11-15)
                    source: "PRESET",
                    statusReason: null,
                },
            ];

            const result = evaluateGate1(requirements, boutDate);
            expect(result.passed).toBe(false);
            expect(result.missing).toEqual([]);
            expect(result.expiring).toEqual(["Medical Certificate"]);
        });

        it("passes Gate 1 when an optional (required: false) item is MISSING", () => {
            const requirements: BoutRequirement[] = [
                {
                    id: "r1",
                    boutId: "b1",
                    code: "HEALTH_CERT",
                    label: "Medical Certificate",
                    required: true,
                    status: "PROVIDED",
                    issuedOn: "2026-05-01",
                    validUntil: "2026-11-20",
                    source: "PRESET",
                    statusReason: null,
                },
                {
                    id: "r2",
                    boutId: "b1",
                    code: "OPTIONAL_SCAN",
                    label: "Optional Brain MRI",
                    required: false,
                    status: "MISSING",
                    issuedOn: null,
                    validUntil: null,
                    source: "COACH",
                    statusReason: null,
                },
            ];

            const result = evaluateGate1(requirements, boutDate);
            expect(result.passed).toBe(true);
            expect(result.missing).toEqual([]);
            expect(result.expiring).toEqual([]);
        });
    });

    describe("Criteria 1: Weight warning calculation", () => {
        const today = new Date("2026-10-15T09:00:00+07:00");
        const todayKey = dayKey(today); // 2026-10-15

        it("returns OVER_LIMIT when 2 days remain and remaining cut % exceeds L (W = 66, limit = 60, L = 8)", () => {
            const weighInDate = addDaysToKey(todayKey, 2); // 2 days left (d = 2 <= A = 7)
            const campStart = addDaysToKey(todayKey, -30);

            const result = calculateWeightWarning({
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                weighInAt: `${weighInDate}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [
                    { date: `${campStart}T10:00:00+07:00`, kg: 68 },
                    { date: `${todayKey}T08:00:00+07:00`, kg: 66 },
                ],
                now: today,
            });

            expect(result.status).toBe("OVER_LIMIT");
            expect(result.remainingPct).toBe(9.1); // (66-60)/66 * 100 = 9.09%
            expect(result.latestKg).toBe(66);
        });

        it("returns ON_TRACK when 2 days remain and remaining cut % is within L (W = 64.5, limit = 60, L = 8)", () => {
            const weighInDate = addDaysToKey(todayKey, 2);
            const campStart = addDaysToKey(todayKey, -30);

            const result = calculateWeightWarning({
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                weighInAt: `${weighInDate}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [
                    { date: `${campStart}T10:00:00+07:00`, kg: 68 },
                    { date: `${todayKey}T08:00:00+07:00`, kg: 64.5 },
                ],
                now: today,
            });

            expect(result.status).toBe("ON_TRACK");
            expect(result.remainingPct).toBe(7.0); // (64.5-60)/64.5 * 100 = 6.976%
            expect(result.latestKg).toBe(64.5);
        });

        it("returns NOT_WEIGHED when there are no weigh-ins in the last 3 days", () => {
            const weighInDate = addDaysToKey(todayKey, 2);
            const campStart = addDaysToKey(todayKey, -30);
            const threeDaysAgo = addDaysToKey(todayKey, -3);

            const result = calculateWeightWarning({
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                weighInAt: `${weighInDate}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [
                    { date: `${campStart}T10:00:00+07:00`, kg: 68 },
                    { date: `${threeDaysAgo}T08:00:00+07:00`, kg: 64.5 },
                ],
                now: today,
            });

            expect(result.status).toBe("NOT_WEIGHED");
        });

        it("returns NEUTRAL from WEIGHED_IN on, even when the rehydrated weight is far above the limit", () => {
            const campStart = addDaysToKey(todayKey, -30);
            const params = {
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                weighInAt: `${addDaysToKey(todayKey, -1)}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [{ date: `${todayKey}T07:00:00+07:00`, kg: 66 }],
                now: today,
            };

            for (const boutStatus of ["WEIGHED_IN", "COMPLETED", "CANCELLED"] as const) {
                const result = calculateWeightWarning({ ...params, boutStatus });
                expect(result.status).toBe("NEUTRAL");
                expect(result.latestKg).toBe(66);
            }
            expect(calculateWeightWarning({ ...params, boutStatus: "FIGHT_WEEK" }).status).toBe("OVER_LIMIT");
            expect(calculateWeightWarning({ ...params, boutStatus: "COMPLETED", measurements: [] }).status).toBe("NEUTRAL");
        });

        it("returns ABOVE_TARGET when 20 days remain and W is > reference + 1.0 kg tolerance", () => {
            const weighInDate = addDaysToKey(todayKey, 20); // 20 days left (d = 20 > A = 7)
            const campStart = addDaysToKey(todayKey, -20); // 40-day camp total
            // Camp start: W0 = 70 kg at day -20.
            // Acute window date: weighIn - 7 = day +13.
            // targetAtWindow for 60 kg with L = 8% is 60 / 0.92 = 65.217 kg.
            // At day 0 (today), elapsed is 20 days out of 33 days (from day -20 to day +13).
            // ref = 70 + (20/33)*(65.217 - 70) = 70 - 2.898 = 67.10 kg.

            // If W = 67.10 + 1.5 = 68.6 kg (> ref + 1.0 kg tolerance):
            const resultYellow = calculateWeightWarning({
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                tolKg: 1.0,
                weighInAt: `${weighInDate}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [
                    { date: `${campStart}T10:00:00+07:00`, kg: 70 },
                    { date: `${todayKey}T08:00:00+07:00`, kg: 68.6 },
                ],
                now: today,
            });

            expect(resultYellow.status).toBe("ABOVE_TARGET");

            // If W = ref + 0.5 kg (<= ref + 1.0 kg tolerance):
            const resultGreen = calculateWeightWarning({
                limitKg: 60,
                acuteLossLimitPct: 8,
                acuteWindowDays: 7,
                tolKg: 1.0,
                weighInAt: `${weighInDate}T10:00:00+07:00`,
                campStartDate: `${campStart}T10:00:00+07:00`,
                measurements: [
                    { date: `${campStart}T10:00:00+07:00`, kg: 70 },
                    { date: `${todayKey}T08:00:00+07:00`, kg: 67.6 },
                ],
                now: today,
            });

            expect(resultGreen.status).toBe("ON_TRACK");
        });
    });

    describe("canEnterFightWeek", () => {
        const now = new Date("2026-10-15T09:00:00+07:00");
        const todayKey = dayKey(now);

        it("allows entering fight week when status is CAMP, Gate 1 is passed, and date is within fight_week_days", () => {
            const weighInAt = `${addDaysToKey(todayKey, 5)}T10:00:00+07:00`;
            const gate1 = { passed: true, missing: [], expiring: [] };
            expect(canEnterFightWeek({ status: "CAMP", weighInAt }, gate1, 7, now)).toBe(true);
        });

        it("disallows entering fight week if Gate 1 is not passed", () => {
            const weighInAt = `${addDaysToKey(todayKey, 5)}T10:00:00+07:00`;
            const gate1 = { passed: false, missing: ["Health cert"], expiring: [] };
            expect(canEnterFightWeek({ status: "CAMP", weighInAt }, gate1, 7, now)).toBe(false);
        });

        it("disallows entering fight week if too early (more than fight_week_days away)", () => {
            const weighInAt = `${addDaysToKey(todayKey, 14)}T10:00:00+07:00`;
            const gate1 = { passed: true, missing: [], expiring: [] };
            expect(canEnterFightWeek({ status: "CAMP", weighInAt }, gate1, 7, now)).toBe(false);
        });

        it("disallows entering fight week if status is not CAMP (e.g. SCHEDULED)", () => {
            const weighInAt = `${addDaysToKey(todayKey, 5)}T10:00:00+07:00`;
            const gate1 = { passed: true, missing: [], expiring: [] };
            expect(canEnterFightWeek({ status: "SCHEDULED", weighInAt }, gate1, 7, now)).toBe(false);
        });
    });

    describe("Criteria 3: Academy date timezone", () => {
        it("evaluates 2026-10-20T17:30:00Z as 2026-10-21 in Vietnam (UTC+7)", () => {
            expect(dayKey("2026-10-20T17:30:00Z")).toBe("2026-10-21");
        });
    });

    describe("Criteria 12b: Weight points deduplication", () => {
        it("takes the latest measurement in the same academy day and sorts chronologically", () => {
            const measurements = [
                { date: "2026-10-10T07:00:00+07:00", kg: 66.0 },
                { date: "2026-10-10T18:00:00+07:00", kg: 65.4 },
                { date: "2026-10-11T07:30:00+07:00", kg: 64.8 },
            ];

            const points = computeWeightPoints(measurements);
            expect(points).toEqual([
                { date: "2026-10-10", kg: 65.4 },
                { date: "2026-10-11", kg: 64.8 },
            ]);
        });
    });
});

