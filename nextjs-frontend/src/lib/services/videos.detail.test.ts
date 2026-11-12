import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pipelineApiRequest = vi.hoisted(() => vi.fn());
const getFighter = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/pipeline-auth", () => ({ pipelineApiRequest }));
vi.mock("./people", () => ({ getFighter }));

import { ApiError } from "@/lib/api/client";
import { clearJobResultCache, getVideoDetail } from "./videos";

/*
 * A5 and A9 (docs/PERFORMANCE-PLAN.md) for the video detail: the fighter and the job are read together, then the result
 * and the review state together; a completed job's result is kept by job id, behind the video's own access check.
 */

const fighterId = "11111111-1111-4111-8111-111111111111";
const videoId = "22222222-2222-4222-8222-222222222222";
const jobId = "44444444-4444-4444-8444-444444444444";
const video = {
    id: videoId,
    fighterId,
    uploadedById: "33333333-3333-4333-8333-333333333333",
    sessionId: null,
    title: "Pad work, round 2",
    description: null,
    trainingType: "PAD_WORK",
    cameraAngle: "FRONT",
    status: "PROCESSED",
    originalFilename: "pads.mp4",
    fileSizeBytes: 2_097_152,
    mimeType: "video/mp4",
    durationMs: 61_000,
    sourceUrl: "videos/pads.mp4",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:05:00.000Z",
};
const job = {
    id: jobId,
    videoId,
    fighterId,
    status: "DONE",
    score: 80,
    resultUrl: "results/job.json",
    createdAt: "2026-10-01T10:05:00.000Z",
    updatedAt: "2026-10-01T10:09:00.000Z",
};
const result = { meta: { fps: 30, totalFrames: 0, durationMs: 61_000 }, frames: [], kicks: [] };
const reviewState = { jobId, videoId, fighterId, analysisId: null, reviews: [], corrections: [] };
const notFound = new ApiError({ message: "Not found", kind: "http", status: 404 });

/** The pipeline as the viewer sees it; `hidden` answers 404 for the video, as the service does for one out of scope. */
function answer(path: string, hidden: boolean) {
    if (path === `/videos/${videoId}`) {
        if (hidden) throw notFound;
        return video;
    }
    if (path === "/jobs") return hidden ? [] : [job];
    if (path === `/jobs/${jobId}`) return job;
    if (path === `/jobs/${jobId}/result`) return structuredClone(result);
    if (path === `/coaching/jobs/${jobId}/state`) return reviewState;
    throw new Error(`Unexpected request ${path}`);
}

const reads = (path: string) => pipelineApiRequest.mock.calls.filter(([called]) => called === path).length;

describe("video detail", () => {
    let hidden = false;
    let pending = 0;
    let overlaps: string[] = [];

    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        clearJobResultCache();
        hidden = false;
        pending = 0;
        overlaps = [];
        pipelineApiRequest.mockReset();
        pipelineApiRequest.mockImplementation(async (path: string) => {
            pending += 1;
            if (pending > 1) overlaps.push(path);
            await new Promise((resolve) => setTimeout(resolve, 2));
            pending -= 1;
            return answer(path, hidden);
        });
        getFighter.mockReset();
        getFighter.mockImplementation(async () => {
            pending += 1;
            if (pending > 1) overlaps.push("fighter");
            await new Promise((resolve) => setTimeout(resolve, 2));
            pending -= 1;
            return { id: fighterId, name: "Lan", heightCm: 170 };
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it("reads the fighter with the job, and the result with the review state", async () => {
        const detail = await getVideoDetail(videoId);
        expect(detail?.analysis?.jobId).toBe(jobId);
        expect(detail?.fighter.id).toBe(fighterId);
        expect(overlaps.some((path) => path === "fighter" || path === `/jobs/${jobId}`)).toBe(true);
        expect(overlaps.some((path) => path.endsWith("/result") || path.endsWith("/state"))).toBe(true);
    });

    it("downloads a completed job's result once, and the same analysis comes back", async () => {
        const first = await getVideoDetail(videoId);
        const second = await getVideoDetail(videoId);
        expect(second?.analysis).toEqual(first?.analysis);
        expect(reads(`/jobs/${jobId}/result`)).toBe(1);
        // Everything else is still asked each time, the review state included.
        expect(reads(`/videos/${videoId}`)).toBe(2);
        expect(reads(`/coaching/jobs/${jobId}/state`)).toBe(2);
    });

    it("asks again after ten minutes", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-12T09:00:00.000Z"));
        await getVideoDetail(videoId);
        vi.setSystemTime(new Date("2026-11-12T09:10:01.000Z"));
        await getVideoDetail(videoId);
        expect(reads(`/jobs/${jobId}/result`)).toBe(2);
    });

    it("still refuses a viewer who may not see the video when its result is cached", async () => {
        await getVideoDetail(videoId);
        hidden = true;
        await expect(getVideoDetail(videoId)).resolves.toBeNull();
        expect(reads(`/jobs/${jobId}/result`)).toBe(1);
        expect(getFighter).toHaveBeenCalledTimes(1);
    });
});
