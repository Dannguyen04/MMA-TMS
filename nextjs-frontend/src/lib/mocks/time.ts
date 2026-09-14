import { dayKey } from "@/lib/format";

/**
 * Mock timeline anchors. All mock dates are relative to "today" in the academy
 * timezone (UTC+7, no DST) so the demo always looks current.
 *
 * Everything is anchored to one instant: when the server process first loaded the seed.
 * Pages, Server Actions and Route Handlers are bundled separately and each evaluate this
 * module, so the instant lives on globalThis and every bundle builds the same seed (see db.ts).
 */

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const TZ_OFFSET = "+07:00";

const pad = (n: number) => String(n).padStart(2, "0");

const anchorStore = globalThis as { __mmaMockAnchorMs?: number };
anchorStore.__mmaMockAnchorMs ??= Date.now();

/** The instant the mock timeline is anchored to (server start), shared by every bundle. */
export const MOCK_ANCHOR_MS: number = anchorStore.__mmaMockAnchorMs;
export const MOCK_ANCHOR_ISO = new Date(MOCK_ANCHOR_MS).toISOString();

/** Today's calendar date (YYYY-MM-DD) in the academy timezone at the anchor. */
export const TODAY_KEY = dayKey(new Date(MOCK_ANCHOR_MS));

function atLocal(dateKey: string, hour: number, minute: number): Date {
    return new Date(`${dateKey}T${pad(hour)}:${pad(minute)}:00${TZ_OFFSET}`);
}

/** ISO timestamp `days` from today (negative = past) at a local wall-clock time. */
export function fromToday(days: number, hour = 9, minute = 0): string {
    const base = atLocal(TODAY_KEY, hour, minute);
    return new Date(base.getTime() + days * DAY_MS).toISOString();
}

export const daysAgo = (days: number, hour = 9, minute = 0) => fromToday(-days, hour, minute);
export const daysFromNow = (days: number, hour = 9, minute = 0) => fromToday(days, hour, minute);

/** Offset (in days) from today back to this week's Monday. */
export function mondayOffset(): number {
    const weekday = atLocal(TODAY_KEY, 12, 0).getUTCDay(); // 0 = Sunday
    return weekday === 0 ? -6 : 1 - weekday;
}

/** ISO timestamp of Monday 00:00 local, `weeksAgo` weeks before the current week. */
export function weekStart(weeksAgo: number): string {
    return fromToday(mondayOffset() - weeksAgo * 7, 0, 0);
}

/** Date-only ISO key (YYYY-MM-DD) `days` from today — used for birthdays and due dates. */
export function dateKeyFromToday(days: number): string {
    return dayKey(fromToday(days, 12, 0));
}

/* ─── Past events earlier today ───────────────────────────────────────────── */

/** Local wall-clock hour that today's seeded events are authored against. */
const DAY_END_HOUR = 22;
/** Today's past events end at least this long before the anchor. */
const ANCHOR_MARGIN_MS = 5 * MINUTE_MS;
/**
 * Authored times stay exact until this long before the latest allowed instant; only later times are
 * compressed. Keeps sessions that genuinely finished before server start at their real clock times.
 */
const COMPRESSION_WINDOW_MS = 45 * MINUTE_MS;

interface PastTodayWindow {
    todayStart: number;
    dayEnd: number;
    /** Latest instant a past event of today may have. */
    latest: number;
    /** Authored times up to here are kept as they are; later ones are compressed into (knee, latest]. */
    knee: number;
}

function pastTodayWindow(anchorMs: number, todayKey: string): PastTodayWindow {
    const todayStart = atLocal(todayKey, 0, 0).getTime();
    const dayEnd = atLocal(todayKey, DAY_END_HOUR, 0).getTime();
    let latest = anchorMs - ANCHOR_MARGIN_MS;
    if (latest <= todayStart) latest = Math.floor(todayStart + (anchorMs - todayStart) / 2);
    return { todayStart, dayEnd, latest, knee: Math.max(todayStart, latest - COMPRESSION_WINDOW_MS) };
}

/**
 * Maps a time authored for today onto the part of today that has already happened.
 *
 * Seeds write today's events at realistic wall-clock times (07:00 session, 08:14 upload…), which
 * are still in the future when the server starts early. Times up to the knee stay exact; later ones
 * are compressed linearly into (knee, anchor − 5 min]. The mapping is strictly increasing, so the
 * order of today's events is preserved. From 22:05 on, every authored time is kept.
 */
export function mapPastToday(intendedMs: number, anchorMs: number, todayKey: string): number {
    const { todayStart, dayEnd, latest, knee } = pastTodayWindow(anchorMs, todayKey);
    const t = Math.min(Math.max(intendedMs, todayStart), dayEnd);
    if (latest >= dayEnd || t <= knee) return t;
    return knee + ((t - knee) * (latest - knee)) / (dayEnd - knee);
}

/** Inverse of `mapPastToday` on its range; values after the latest instant map past the day end. */
function unmapPastToday(mappedMs: number, anchorMs: number, todayKey: string): number {
    const { dayEnd, latest, knee } = pastTodayWindow(anchorMs, todayKey);
    if (latest >= dayEnd || mappedMs <= knee) return mappedMs;
    if (mappedMs >= latest) return Math.max(mappedMs, dayEnd);
    return knee + ((mappedMs - knee) * (dayEnd - knee)) / (latest - knee);
}

const TODAY_START_MS = atLocal(TODAY_KEY, 0, 0).getTime();
const isToday = (ms: number) => ms >= TODAY_START_MS && ms < TODAY_START_MS + DAY_MS;
const toIso = (ms: number) => new Date(Math.floor(ms)).toISOString();

/** A past event earlier today, authored at a local wall-clock time. Always before the anchor. */
export function pastToday(hour: number, minute = 0): string {
    return toIso(mapPastToday(atLocal(TODAY_KEY, hour, minute).getTime(), MOCK_ANCHOR_MS, TODAY_KEY));
}

/** Maps an authored past timestamp that falls on today; other days are returned unchanged. */
export function clampPastToday(iso: string): string {
    const ms = Date.parse(iso);
    return isToday(ms) ? toIso(mapPastToday(ms, MOCK_ANCHOR_MS, TODAY_KEY)) : iso;
}

/**
 * A past event `minutes` after (or before, when negative) a seed timestamp. The offset is applied to
 * the authored time behind a mapped timestamp, so derived events keep their order and stay before the
 * anchor. Use it instead of plain date arithmetic whenever the base can fall on today.
 */
export function shiftPastToday(iso: string, minutes: number): string {
    const ms = Date.parse(iso);
    const intended = isToday(ms) ? unmapPastToday(ms, MOCK_ANCHOR_MS, TODAY_KEY) : ms;
    return clampPastToday(toIso(intended + minutes * MINUTE_MS));
}
