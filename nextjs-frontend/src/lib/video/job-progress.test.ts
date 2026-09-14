import { describe, expect, it } from "vitest";

import type { AIJob } from "@/lib/domain/types";
import { detailedStageState, stageState } from "./job-progress";
import { AI_JOB_ERROR_CODES, isAIJobErrorCode, JOB_ERROR_RETRY_HELPS } from "./job-errors";

type JobState = Pick<AIJob, "status" | "stage" | "errorCode">;

const job = (overrides: Partial<JobState>): JobState => ({ status: "processing", stage: "pose_estimation", errorCode: null, ...overrides });

describe("detailedStageState", () => {
    it("marks earlier stages done, the current stage in progress and later stages upcoming", () => {
        const processing = job({});
        expect(detailedStageState(processing, "decoding")).toBe("done");
        expect(detailedStageState(processing, "pose_estimation")).toBe("current");
        expect(detailedStageState(processing, "done")).toBe("upcoming");
    });

    it("shows a queued job as waiting", () => {
        expect(detailedStageState(job({ status: "queued", stage: "queued" }), "queued")).toBe("waiting");
    });

    it("distinguishes a failure from a cancellation and skips the rest", () => {
        const failed = job({ status: "failed", errorCode: "WORKER_TIMEOUT" });
        expect(detailedStageState(failed, "pose_estimation")).toBe("failed");
        expect(detailedStageState(failed, "done")).toBe("skipped");
        expect(detailedStageState(job({ status: "failed", errorCode: "CANCELLED" }), "pose_estimation")).toBe("stopped");
    });

    it("marks every stage done for a completed job", () => {
        expect(detailedStageState(job({ status: "completed", stage: "done" }), "queued")).toBe("done");
    });

    it("leaves the simple stageState contract unchanged", () => {
        expect(stageState(job({ status: "failed" }), "pose_estimation")).toBe("pending");
    });
});

describe("job error codes", () => {
    it("recognises known codes only", () => {
        expect(isAIJobErrorCode("OUT_OF_MEMORY")).toBe(true);
        expect(isAIJobErrorCode("SOMETHING_NEW")).toBe(false);
        expect(isAIJobErrorCode(null)).toBe(false);
    });

    it("has a retry decision for every code", () => {
        expect(Object.keys(JOB_ERROR_RETRY_HELPS).sort()).toEqual([...AI_JOB_ERROR_CODES].sort());
        expect(JOB_ERROR_RETRY_HELPS.VIDEO_NOT_FOUND).toBe(false);
    });
});
