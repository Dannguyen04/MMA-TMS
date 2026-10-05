import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pipelineApiRequest = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/pipeline-auth", () => ({ pipelineApiRequest }));
vi.mock("./people", () => ({ getFighter: vi.fn() }));

import { ApiError } from "@/lib/api/client";
import { listVideos, listVideosAndJobs } from "./videos";

const fighterId = "11111111-1111-4111-8111-111111111111";
const videoId = "22222222-2222-4222-8222-222222222222";
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
const videoPage = { items: [video], pageInfo: { hasNextPage: false, endCursor: null }, total: 1 };
const serviceDown = new ApiError({ message: "Internal server error", kind: "http", status: 500 });

/** Answers the video list, and fails the jobs read with `jobsError`. */
function answerVideos(jobsError: ApiError) {
    pipelineApiRequest.mockImplementation(async (path: string) => {
        if (path.startsWith("/videos?")) return videoPage;
        if (path === "/jobs") throw jobsError;
        throw new Error(`Unexpected request ${path}`);
    });
}

describe("video lists when the analysis service fails", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        pipelineApiRequest.mockReset();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("lists the videos with their own status when the jobs read fails", async () => {
        answerVideos(serviceDown);

        await expect(listVideos({ fighterIds: [fighterId] })).resolves.toEqual([expect.objectContaining({ id: videoId, status: "completed", jobId: null })]);
    });

    it("still fails when the video list itself fails", async () => {
        pipelineApiRequest.mockRejectedValue(serviceDown);

        await expect(listVideos({ fighterIds: [fighterId] })).rejects.toBe(serviceDown);
    });

    it("still fails on a lapsed session", async () => {
        const expired = new ApiError({ message: "Session expired", kind: "unauthorized", status: 401 });
        answerVideos(expired);

        await expect(listVideos({ fighterIds: [fighterId] })).rejects.toBe(expired);
    });

    it("keeps the jobs read strict for callers that list the jobs themselves", async () => {
        answerVideos(serviceDown);

        await expect(listVideosAndJobs()).rejects.toBe(serviceDown);
    });
});
