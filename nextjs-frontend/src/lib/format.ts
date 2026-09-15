/**
 * Formatting helpers. All dates render in the academy's timezone so server and
 * client output match and hydration stays stable.
 */

export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";
const LOCALE = "en-GB";

export const DAY_MS = 86_400_000;

const dateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, day: "numeric", month: "short" });
const weekdayDateFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, weekday: "short", day: "numeric", month: "short" });
const timeFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const monthYearFmt = new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIMEZONE, month: "long", year: "numeric" });

const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

/** 14 Sept 2026 */
export function formatDate(value: string | Date): string {
    return dateFmt.format(toDate(value));
}

/** 14 Sept */
export function formatShortDate(value: string | Date): string {
    return shortDateFmt.format(toDate(value));
}

/** Mon, 14 Sept */
export function formatWeekdayDate(value: string | Date): string {
    return weekdayDateFmt.format(toDate(value));
}

/** 18:30 */
export function formatTime(value: string | Date): string {
    return timeFmt.format(toDate(value));
}

/** 14 Sept 2026, 18:30 */
export function formatDateTime(value: string | Date): string {
    return dateTimeFmt.format(toDate(value));
}

/** September 2026 */
export function formatMonthYear(value: string | Date): string {
    return monthYearFmt.format(toDate(value));
}

/** Calendar day key in the academy timezone, e.g. 2026-09-14. */
export function dayKey(value: string | Date): string {
    return dayKeyFmt.format(toDate(value));
}

/** Whole calendar days from `from` to `to` in the academy timezone (negative when `to` is earlier). */
export function daysBetween(from: string | Date, to: string | Date): number {
    return daysBetweenKeys(dayKey(from), dayKey(to));
}

/* ─── Academy wall-clock values (date and time inputs) ────────────────────── */

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const wallClockFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
});

/** A real calendar day written as YYYY-MM-DD (rejects overflow such as 2026-02-30). */
export function isDateKey(value: string | undefined): value is string {
    if (value === undefined || !DATE_KEY_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** A 24-hour HH:mm time. */
export function isTimeValue(value: string | undefined): value is string {
    return value !== undefined && TIME_PATTERN.test(value);
}

/** Milliseconds the academy timezone is ahead of UTC at `instant`, read from Intl so offset changes are respected. */
function academyOffsetMs(instant: number): number {
    const parts = wallClockFmt.formatToParts(new Date(instant));
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value);
    const shownAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
    return shownAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "2026-09-14" + "18:30" on the academy wall clock → UTC ISO timestamp. Both parts must be valid
 * (check with `isDateKey` / `isTimeValue`); invalid input throws a RangeError.
 */
export function academyWallClockToIso(dateKey: string, time: string): string {
    if (!isDateKey(dateKey) || !isTimeValue(time)) throw new RangeError(`Invalid academy date or time: "${dateKey}" "${time}".`);
    const asUtc = Date.parse(`${dateKey}T${time}:00Z`);
    // Second pass settles wall-clock times next to an offset change; a no-op for fixed-offset zones.
    const firstGuess = asUtc - academyOffsetMs(asUtc);
    return new Date(asUtc - academyOffsetMs(firstGuess)).toISOString();
}

/** Start (00:00) of an academy calendar day as a UTC ISO timestamp. `key` must be a valid date key. */
export function academyDayStartIso(key: string): string {
    return academyWallClockToIso(key, "00:00");
}

/** Last minute (23:59) of an academy calendar day as a UTC ISO timestamp. `key` must be a valid date key. */
export function academyDayEndIso(key: string): string {
    return academyWallClockToIso(key, "23:59");
}

/** The date key `days` after `key` (negative moves back). An invalid key is returned unchanged. */
export function addDaysToKey(key: string, days: number): string {
    if (!isDateKey(key)) return key;
    return new Date(Date.parse(`${key}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from one date key to another (negative when `to` is earlier). */
export function daysBetweenKeys(from: string, to: string): number {
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** YYYY-MM-DDTHH:mm on the academy wall clock, for a datetime-local input. */
export function toDateTimeInputValue(value: string | Date): string {
    return `${dayKey(value)}T${formatTime(value)}`;
}

/** A valid YYYY-MM-DDTHH:mm datetime-local value (the inverse of `toDateTimeInputValue`). */
export function isDateTimeInputValue(value: string | undefined): value is string {
    const [day, time, ...rest] = value?.split("T") ?? [];
    return rest.length === 0 && isDateKey(day) && isTimeValue(time);
}

const relativeFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 3 days", "yesterday", "5 min ago". `now` must come from the server when rendered on the client. */
export function formatRelative(value: string | Date, now: string | Date = new Date()): string {
    const target = toDate(value).getTime();
    const base = toDate(now).getTime();
    const diffMs = target - base;
    const abs = Math.abs(diffMs);

    if (abs < 60_000) return "just now";
    if (abs < 3_600_000) return relativeFmt.format(Math.round(diffMs / 60_000), "minute");
    if (abs < DAY_MS) return relativeFmt.format(Math.round(diffMs / 3_600_000), "hour");
    const days = daysBetween(new Date(base), new Date(target));
    if (Math.abs(days) < 7) return relativeFmt.format(days, "day");
    if (Math.abs(days) < 35) return relativeFmt.format(Math.round(days / 7), "week");
    if (Math.abs(days) < 365) return relativeFmt.format(Math.round(days / 30), "month");
    return relativeFmt.format(Math.round(days / 365), "year");
}

/** 1:05 or 1:02:05 from seconds. */
export function formatClock(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 00:12.4 from milliseconds — used on analysis timelines. */
export function formatTimestamp(ms: number): string {
    const totalTenths = Math.max(0, Math.round(ms / 100));
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** 90 → "1h 30m", 45 → "45 min". */
export function formatMinutes(minutes: number): string {
    const m = Math.round(minutes);
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest === 0 ? `${h}h` : `${h}h ${rest}m`;
}

const numberFmt = new Intl.NumberFormat("en-US");
const decimalFmts = new Map<number, Intl.NumberFormat>();

function decimalFmt(decimals: number): Intl.NumberFormat {
    let fmt = decimalFmts.get(decimals);
    if (!fmt) {
        fmt = new Intl.NumberFormat("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
        decimalFmts.set(decimals, fmt);
    }
    return fmt;
}

export function formatNumber(value: number, decimals = 0): string {
    return decimals === 0 ? numberFmt.format(Math.round(value)) : decimalFmt(decimals).format(value);
}

/** 0.873 → "87%" */
export function formatConfidence(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
}

/** 42.5 → "43%" (value already on a 0–100 scale). */
export function formatPercent(value: number, decimals = 0): string {
    return `${formatNumber(value, decimals)}%`;
}

/** Signed delta, e.g. "+4.2" or "−1". */
export function formatDelta(value: number, decimals = 0): string {
    const rounded = Number(value.toFixed(decimals));
    if (rounded === 0) return "0";
    const abs = formatNumber(Math.abs(rounded), decimals);
    return rounded > 0 ? `+${abs}` : `−${abs}`;
}

export function formatFileSize(mb: number): string {
    return mb >= 1024 ? `${formatNumber(mb / 1024, 1)} GB` : `${formatNumber(mb, mb < 10 ? 1 : 0)} MB`;
}

export function ageFromBirthDate(dateOfBirth: string, now: string | Date = new Date()): number {
    const birth = toDate(dateOfBirth);
    const ref = toDate(now);
    let age = ref.getUTCFullYear() - birth.getUTCFullYear();
    const beforeBirthday =
        ref.getUTCMonth() < birth.getUTCMonth() ||
        (ref.getUTCMonth() === birth.getUTCMonth() && ref.getUTCDate() < birth.getUTCDate());
    if (beforeBirthday) age -= 1;
    return age;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
    return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
