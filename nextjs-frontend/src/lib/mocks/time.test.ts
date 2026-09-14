import { describe, expect, it } from "vitest";

import { dayKey } from "@/lib/format";

import { clampPastToday, daysAgo, fromToday, mapPastToday, MOCK_ANCHOR_ISO, MOCK_ANCHOR_MS, pastToday, shiftPastToday, TODAY_KEY } from "./time";

const DAY = "2026-09-14";
const MINUTE_MS = 60_000;

const pad = (n: number) => String(n).padStart(2, "0");
const localMs = (hour: number, minute: number) => Date.parse(`${DAY}T${pad(hour)}:${pad(minute)}:00+07:00`);

const DAY_START = localMs(0, 0);
/** 00:00–22:00 in 15-minute steps. */
const GRID = Array.from({ length: 22 * 4 + 1 }, (_, step) => DAY_START + step * 15 * MINUTE_MS);

describe("mapPastToday", () => {
    it.each([
        [0, 2],
        [6, 0],
        [8, 30],
        [10, 35],
        [21, 59],
        [23, 30],
    ])("keeps order and stays before an anchor at %i:%i", (hour, minute) => {
        const anchor = localMs(hour, minute);
        const mapped = GRID.map((t) => mapPastToday(t, anchor, DAY));
        const elapsed = anchor - DAY_START;
        const latest = elapsed > 5 * MINUTE_MS ? anchor - 5 * MINUTE_MS : DAY_START + elapsed / 2;

        expect(mapped.slice(1).filter((value, index) => value <= mapped[index])).toEqual([]);
        expect(mapped.filter((value) => value > latest)).toEqual([]);
    });

    it.each([
        [22, 5],
        [23, 30],
    ])("keeps every authored time once the anchor is %i:%i", (hour, minute) => {
        const anchor = localMs(hour, minute);
        expect(GRID.map((t) => mapPastToday(t, anchor, DAY))).toEqual(GRID);
    });

    it("keeps early times exact and compresses later ones", () => {
        const anchor = localMs(10, 35);
        expect(mapPastToday(localMs(7, 0), anchor, DAY)).toBe(localMs(7, 0));
        expect(mapPastToday(localMs(18, 0), anchor, DAY)).toBeGreaterThan(localMs(7, 0));
        expect(mapPastToday(localMs(18, 0), anchor, DAY)).toBeLessThan(localMs(10, 30));
    });
});

describe("mock anchor", () => {
    it("derives today and the ISO anchor from the shared instant", () => {
        expect((globalThis as { __mmaMockAnchorMs?: number }).__mmaMockAnchorMs).toBe(MOCK_ANCHOR_MS);
        expect(Date.parse(MOCK_ANCHOR_ISO)).toBe(MOCK_ANCHOR_MS);
        expect(TODAY_KEY).toBe(dayKey(new Date(MOCK_ANCHOR_MS)));
    });

    it("places today's past events before the anchor, in order", () => {
        const times = [pastToday(0, 30), pastToday(7, 0), pastToday(8, 14), pastToday(12, 0), pastToday(21, 45)].map(Date.parse);
        expect(times.filter((value) => value >= MOCK_ANCHOR_MS)).toEqual([]);
        expect(times.slice(1).filter((value, index) => value < times[index])).toEqual([]);
    });

    it("leaves other days unchanged", () => {
        const others = [daysAgo(1, 23, 30), daysAgo(40, 9, 0), fromToday(1, 6, 0), fromToday(14, 18, 0)];
        expect(others.map(clampPastToday)).toEqual(others);
    });

    it("shifts derived events in authored time", () => {
        const upload = pastToday(8, 14);
        const later = shiftPastToday(upload, 1);
        const earlier = shiftPastToday(upload, -4);
        // Timestamps have millisecond resolution, so seconds after midnight can collapse neighbours.
        expect(Date.parse(later)).toBeGreaterThanOrEqual(Date.parse(upload));
        expect(Date.parse(later)).toBeLessThan(MOCK_ANCHOR_MS);
        expect(Date.parse(earlier)).toBeLessThanOrEqual(Date.parse(upload));
        expect(shiftPastToday(daysAgo(3, 10, 0), 45)).toBe(daysAgo(3, 10, 45));
    });
});
