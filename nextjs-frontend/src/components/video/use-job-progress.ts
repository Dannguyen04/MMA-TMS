"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useVisibleInterval } from "@/components/ui/use-visible-interval";
import type { AIJob } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { isJobActive, JOB_POLL_INTERVAL_MS, type AIJobPollResponse } from "@/lib/video/job-progress";

export interface JobProgressState {
    job: AIJob | null;
    analysisId: string | null;
    /** Set when polling can't continue (signed out, job removed). */
    error: string | null;
    /** A request failed but polling continues. */
    reconnecting: boolean;
}

export interface UseJobProgressOptions {
    jobId: string;
    initialJob: AIJob | null;
    /** Called once when the job completes or fails. */
    onSettled?: (response: AIJobPollResponse) => void;
    /** Change to restart polling for the same job (e.g. after a retry). */
    restartKey?: number;
}

/** A job that stops moving (e.g. waiting for a worker) is polled less often, up to this interval. */
const MAX_POLL_INTERVAL_MS = 15_000;

const STOP_MESSAGES: Partial<Record<number, string>> = {
    401: "Your session has expired. Sign in again to follow the analysis.",
    404: "This analysis job no longer exists.",
};

function sameProgress(a: AIJob | null, b: AIJob): boolean {
    return a !== null && a.status === b.status && a.stage === b.stage && a.progressPct === b.progressPct;
}

/**
 * Polls GET /api/ai-jobs/[jobId] every 1.5 s while the job is queued or processing and the tab is
 * visible. Polls back off to 15 s while nothing changes, and stop once the job settles.
 */
export function useJobProgress({ jobId, initialJob, onSettled, restartKey = 0 }: UseJobProgressOptions): JobProgressState {
    const [state, setState] = useState<JobProgressState>({ job: initialJob, analysisId: null, error: null, reconnecting: false });
    const pollKey = `${jobId}:${restartKey}`;
    // Polling stops for one job + restart key; a new key starts it again.
    const [stoppedKey, setStoppedKey] = useState<string | null>(null);
    const settledRef = useRef(onSettled);
    const lastJobRef = useRef<AIJob | null>(initialJob);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        settledRef.current = onSettled;
    }, [onSettled]);

    useEffect(() => () => abortRef.current?.abort(), []);

    const poll = useCallback(async (): Promise<"changed" | "unchanged"> => {
        const controller = new AbortController();
        abortRef.current = controller;
        const reconnect = () => {
            if (!controller.signal.aborted) setState((s) => ({ ...s, reconnecting: true }));
            return "unchanged" as const;
        };
        try {
            const response = await fetch(routes.api.aiJob(jobId), { cache: "no-store", signal: controller.signal });
            const stopMessage = STOP_MESSAGES[response.status];
            if (stopMessage) {
                setState((s) => ({ ...s, error: stopMessage, reconnecting: false }));
                setStoppedKey(pollKey);
                return "unchanged";
            }
            if (!response.ok) return reconnect();

            const body = (await response.json()) as AIJobPollResponse;
            const changed = !sameProgress(lastJobRef.current, body.job);
            lastJobRef.current = body.job;
            setState({ job: body.job, analysisId: body.analysisId, error: null, reconnecting: false });
            if (!isJobActive(body.job)) {
                setStoppedKey(pollKey);
                settledRef.current?.(body);
            }
            return changed ? "changed" : "unchanged";
        } catch {
            return reconnect();
        }
    }, [jobId, pollKey]);

    useVisibleInterval(poll, { intervalMs: JOB_POLL_INTERVAL_MS, maxIntervalMs: MAX_POLL_INTERVAL_MS, enabled: stoppedKey !== pollKey });

    return state;
}
