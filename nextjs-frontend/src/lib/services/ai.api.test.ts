import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const getJobProgress = vi.hoisted(() => vi.fn());
const getFighter = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/client", async (loadOriginal) => ({ ...(await loadOriginal<typeof import("@/lib/api/client")>()), authenticatedApiRequest }));
vi.mock("./videos", () => ({ getJobProgress, getVideo: vi.fn(async () => null), listAnalysisJobs: vi.fn(), listVideosAndJobs: vi.fn() }));
vi.mock("./people", () => ({ getFighter }));

import { getAlertDetail, listAlerts } from "./ai.api";

const jobId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const fighterId = "11111111-1111-4111-8111-111111111111";
const videoId = "22222222-2222-4222-8222-222222222222";
const alert = {
    joint: "LEFT_KNEE",
    state: "CONFIRMED_IMPAIRMENT",
    severity: "medium",
    triggerTimeMs: 41_200,
    windowStartMs: 36_000,
    consecutiveLowRom: 4,
    avgRomRatio: 0.62,
    motionClass: "POWER_STRIKE",
    recommendation: "Range of motion stayed below baseline.",
};

describe("AI movement observations from the jobs API", () => {
    beforeEach(() => {
        authenticatedApiRequest.mockReset();
        getJobProgress.mockReset();
        getFighter.mockReset();
    });

    it("turns each health alert on a mapped joint into an observation without a confidence", async () => {
        authenticatedApiRequest.mockResolvedValue([
            { id: jobId, videoId, fighterId, updatedAt: "2026-10-01T10:00:00.000Z", healthAlerts: [alert, { ...alert, joint: "NOSE" }] },
        ]);

        await expect(listAlerts({ fighterIds: [fighterId] })).resolves.toEqual([
            expect.objectContaining({
                id: `${jobId}~0`,
                fighterId,
                videoId,
                bodyRegion: "left_knee",
                pattern: "Possible reduced range of motion during power strikes",
                confidence: null,
                status: "new",
                metric: expect.objectContaining({ observed: 62, baseline: 100, unit: "%" }),
                timestampsMs: [36_000, 41_200],
            }),
        ]);
        expect(authenticatedApiRequest).toHaveBeenCalledWith("/jobs/impairments", expect.anything());
    });

    it("reads one observation back from its id, with no analysis or linked injury", async () => {
        getJobProgress.mockResolvedValue({ id: jobId, videoId, fighterId, finishedAt: "2026-10-01T10:00:00.000Z", queuedAt: "2026-10-01T09:00:00.000Z" });
        authenticatedApiRequest.mockResolvedValue({ healthAlerts: [alert] });
        getFighter.mockResolvedValue({ id: fighterId, name: "Minh Trần" });

        await expect(getAlertDetail(`${jobId}~0`)).resolves.toMatchObject({ alert: { id: `${jobId}~0` }, fighter: { id: fighterId }, analysis: null, linkedInjury: null });
        expect(authenticatedApiRequest).toHaveBeenCalledWith(`/jobs/${jobId}/health-alerts`, expect.anything());
    });

    it("reads a malformed observation id as missing without asking the service", async () => {
        await expect(getAlertDetail("not-a-job~0")).resolves.toBeNull();
        expect(getJobProgress).not.toHaveBeenCalled();
    });
});
