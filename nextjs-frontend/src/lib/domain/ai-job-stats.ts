import { DAY_MS, dayKey } from "@/lib/format";
import { average, round } from "@/lib/utils";
import type { AIJob } from "./types";

export interface AIJobStats {
    last24h: { completed: number; failed: number; processing: number; queued: number };
    /** Failed share of jobs finished in the last 7 days, 0–100. */
    failureRate7d: number;
    /** Mean processing time of jobs completed in the last 7 days, seconds. */
    avgDurationSec7d: number;
    /** Low-confidence share of jobs completed in the last 7 days, 0–100; null when jobs report no confidence. */
    lowConfidenceRate7d: number | null;
    /** One entry per calendar day (academy timezone), oldest first, 14 days ending today. */
    dailyThroughput: { date: string; completed: number; failed: number }[];
}

export interface JobStatsOptions {
    /** How long a completed job took, in seconds; null when unknown. */
    durationSec: (job: AIJob) => number | null;
    /** Whether jobs report a confidence at all; the training service's jobs don't. */
    reportsConfidence: boolean;
}

/**
 * Pipeline health for the admin dashboard. `last24h.completed/failed` count jobs finished in the last 24 hours;
 * `processing/queued` are the jobs currently in flight.
 */
export function jobStats(jobs: readonly AIJob[], nowMs: number, { durationSec, reportsConfidence }: JobStatsOptions): AIJobStats {
    const finishedWithin = (ms: number) => jobs.filter((j) => j.finishedAt !== null && nowMs - Date.parse(j.finishedAt) <= ms && Date.parse(j.finishedAt) <= nowMs);
    const day = finishedWithin(DAY_MS);
    const week = finishedWithin(7 * DAY_MS);
    const weekCompleted = week.filter((j) => j.status === "completed");
    const weekFailed = week.filter((j) => j.status === "failed");
    const pct = (part: number, whole: number) => (whole === 0 ? 0 : round((part / whole) * 100, 1));
    const durations = weekCompleted.flatMap((j) => {
        const seconds = durationSec(j);
        return seconds === null ? [] : [seconds];
    });

    const dailyThroughput = Array.from({ length: 14 }, (_, i) => {
        const date = dayKey(new Date(nowMs - (13 - i) * DAY_MS));
        const onDay = jobs.filter((j) => j.finishedAt !== null && dayKey(j.finishedAt) === date);
        return { date, completed: onDay.filter((j) => j.status === "completed").length, failed: onDay.filter((j) => j.status === "failed").length };
    });

    return {
        last24h: {
            completed: day.filter((j) => j.status === "completed").length,
            failed: day.filter((j) => j.status === "failed").length,
            processing: jobs.filter((j) => j.status === "processing").length,
            queued: jobs.filter((j) => j.status === "queued").length,
        },
        failureRate7d: pct(weekFailed.length, week.length),
        avgDurationSec7d: Math.round(average(durations)),
        lowConfidenceRate7d: reportsConfidence ? pct(weekCompleted.filter((j) => j.lowConfidence).length, weekCompleted.length) : null,
        dailyThroughput,
    };
}
