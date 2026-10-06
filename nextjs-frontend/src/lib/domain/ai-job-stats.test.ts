import { describe, expect, it } from "vitest";

import { jobStats } from "./ai-job-stats";
import type { AIJob } from "./types";

const NOW = Date.parse("2026-10-03T05:00:00.000Z");

function job(status: AIJob["status"], finishedAt: string | null, extra: Partial<AIJob> = {}): AIJob {
    return {
        id: `job-${status}-${finishedAt}`,
        videoId: "video-1",
        fighterId: "fighter-1",
        status,
        stage: "done",
        progressPct: 100,
        modelIds: [],
        workerId: null,
        attempts: 1,
        queuedAt: "2026-10-03T04:00:00.000Z",
        startedAt: null,
        finishedAt,
        durationSec: null,
        avgConfidence: null,
        lowConfidence: false,
        errorCode: null,
        errorMessage: null,
        ...extra,
    };
}

describe("jobStats", () => {
    const jobs = [job("completed", "2026-10-03T04:30:00.000Z"), job("failed", "2026-10-02T10:00:00.000Z"), job("processing", null), job("completed", "2026-10-03T04:50:00.000Z", { durationSec: 120 })];

    it("counts finished, running and queued jobs and the failure rate", () => {
        const stats = jobStats(jobs, NOW, { durationSec: (j) => j.durationSec, reportsConfidence: true });
        expect(stats.last24h).toEqual({ completed: 2, failed: 1, processing: 1, queued: 0 });
        expect(stats.failureRate7d).toBe(33.3);
        expect(stats.dailyThroughput.at(-1)).toEqual({ date: "2026-10-03", completed: 2, failed: 0 });
    });

    it("averages only the durations it knows and reports no confidence share for jobs without one", () => {
        const stats = jobStats(jobs, NOW, { durationSec: (j) => j.durationSec, reportsConfidence: false });
        expect(stats.avgDurationSec7d).toBe(120);
        expect(stats.lowConfidenceRate7d).toBeNull();
    });
});
