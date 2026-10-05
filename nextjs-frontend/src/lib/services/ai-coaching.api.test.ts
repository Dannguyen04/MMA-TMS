import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIAnalysis } from "@/lib/domain/types";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/api/pipeline-auth", () => ({ pipelineApiRequest: request }));
import { applyPersistedReviews, persistEvidenceReview, persistCoachSummary } from "./ai-coaching.api";

const state = { jobId: "job", videoId: "video", fighterId: "fighter", analysisId: "analysis", reviews: [], corrections: [] };
beforeEach(() => request.mockReset());

describe("authoritative coach reviews", () => {
    it("uses the backend analysis and worker target identities; never a browser-supplied coach ID", async () => {
        request.mockResolvedValueOnce(state).mockResolvedValueOnce({ id: "review" });
        await persistEvidenceReview("job", "action_1", "finding_1", { decision: "corrected", correctedLabel: "cross", note: "Verified" });
        const body = JSON.parse(request.mock.calls[1][2].body);
        expect(body).toEqual({ analysisId: "analysis", actionId: "action_1", findingId: "finding_1", status: "corrected", correctedLabel: "cross", notes: "Verified" });
        expect(body).not.toHaveProperty("coachId");
    });
    it("refuses to write when structured evidence is missing", async () => {
        request.mockResolvedValue({ ...state, analysisId: null });
        await expect(persistEvidenceReview("job", "action_1", "@action", { decision: "confirmed", correctedLabel: null, note: null })).rejects.toThrow("not been persisted");
        expect(request).toHaveBeenCalledTimes(1);
    });
    it("propagates API failures instead of modifying demo data", async () => {
        request.mockResolvedValueOnce(state).mockRejectedValueOnce(new Error("Forbidden"));
        await expect(persistCoachSummary("job", { rating: 3, summary: "Check guard" })).rejects.toThrow("Forbidden");
    });
    it("hydrates latest reviews by stable IDs without replacing the original model label", () => {
        const analysis = { detections: [{ id: "det-ui", workerActionId: "action_1", type: "jab", review: null }],
            findings: [{ id: "finding-ui", workerActionId: "action_1", workerFindingId: "finding_1", review: null }], coachReview: null } as unknown as AIAnalysis;
        const review = { actionId: "action_1", findingId: "@action", coachId: "coach", status: "corrected" as const, correctedLabel: "cross", notes: "Latest", createdAt: "2026-10-03T01:00:00Z" };
        applyPersistedReviews(analysis, { ...state, reviews: [review, { ...review, status: "approved", notes: "Earlier" }] });
        expect(analysis.detections[0].type).toBe("jab");
        expect(analysis.detections[0].review).toMatchObject({ decision: "corrected", correctedLabel: "cross", note: "Latest" });
        expect(analysis.findings[0].review).toBeNull();
    });
});
