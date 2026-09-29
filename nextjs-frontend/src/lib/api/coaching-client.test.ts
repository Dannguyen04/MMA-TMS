import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { coachingApiClient, CoachingApiError } from "./coaching-client";
import {
    COACHING_FINDING_STATE_LABELS,
    COACHING_FINDING_STATE_STYLES,
    resolveFindingState,
} from "../domain/labels";
import { getPipelineBadge, isMockMode, VIDEO_PIPELINE_MODE } from "./pipeline-mode";

describe("Task TL-11 — Real Web Integration for MVP Workflow", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ─── 1. 8 Distinct Finding & Review States ────────────────────────────────

    it("1.1 defines all 8 distinct states with labels and badge styling", () => {
        const requiredStates = [
            "ai_generated",
            "needs_review",
            "coach_approved",
            "coach_corrected",
            "coach_rejected",
            "insufficient_evidence",
            "shadow",
            "not_validated",
        ] as const;

        for (const state of requiredStates) {
            expect(COACHING_FINDING_STATE_LABELS[state]).toBeDefined();
            expect(COACHING_FINDING_STATE_STYLES[state]).toBeDefined();
            expect(COACHING_FINDING_STATE_STYLES[state].badgeColor).toBeDefined();
            expect(COACHING_FINDING_STATE_STYLES[state].textColor).toBeDefined();
            expect(COACHING_FINDING_STATE_STYLES[state].description).toBeDefined();
        }
    });

    it("1.2 resolveFindingState correctly maps domain finding attributes to 8 states", () => {
        // Shadow state overrides
        expect(resolveFindingState({ isShadow: true })).toBe("shadow");

        // Not validated state
        expect(resolveFindingState({ validationStatus: "NOT_VALIDATED" })).toBe("not_validated");
        expect(resolveFindingState({ validationStatus: "SHADOW_NOT_VALIDATED" })).toBe("not_validated");

        // Coach review decisions
        expect(resolveFindingState({ reviewStatus: "coach_approved" })).toBe("coach_approved");
        expect(resolveFindingState({ reviewStatus: "confirmed" })).toBe("coach_approved");
        expect(resolveFindingState({ reviewStatus: "coach_corrected" })).toBe("coach_corrected");
        expect(resolveFindingState({ reviewStatus: "corrected" })).toBe("coach_corrected");
        expect(resolveFindingState({ reviewStatus: "coach_rejected" })).toBe("coach_rejected");
        expect(resolveFindingState({ reviewStatus: "rejected" })).toBe("coach_rejected");
        expect(resolveFindingState({ reviewStatus: "insufficient_evidence" })).toBe("insufficient_evidence");
        expect(resolveFindingState({ reviewStatus: "needs_review" })).toBe("needs_review");

        // Default AI generated
        expect(resolveFindingState({ status: "ai_generated" })).toBe("ai_generated");
        expect(resolveFindingState({})).toBe("ai_generated");
    });

    // ─── 2. Coaching API Client ───────────────────────────────────────────────

    it("2.1 createAssignment sends POST /coaching/assignments with x-user-id header", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ id: "asgn_1", title: "Jab Drills" }), {
                status: 201,
                headers: { "Content-Type": "application/json" },
            }),
        );

        const res = await coachingApiClient.createAssignment(
            {
                coachId: "coach_1",
                fighterId: "ath_1",
                title: "Jab Drills",
                martialArt: "boxing",
                targetReps: 50,
            },
            "usr_coach_user_1",
        );

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining("/coaching/assignments"),
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    "x-user-id": "usr_coach_user_1",
                    "Content-Type": "application/json",
                }),
            }),
        );
        expect(res).toEqual({ id: "asgn_1", title: "Jab Drills" });
    });

    it("2.2 uploadVideo and createAnalysisJob invoke corresponding endpoints", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ id: "vid_1", title: "Morning Sparring" }), { status: 201 }),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ jobId: "job_1", analysisId: "ana_1", status: "QUEUED" }), { status: 201 }),
            );

        const videoRes = await coachingApiClient.uploadVideo(
            {
                fighterId: "ath_1",
                title: "Morning Sparring",
                storageKey: "videos/vid_1.mp4",
            },
            "usr_athlete_1",
        );
        expect(videoRes).toEqual({ id: "vid_1", title: "Morning Sparring" });

        const jobRes = await coachingApiClient.createAnalysisJob(
            {
                videoId: "vid_1",
                fighterId: "ath_1",
            },
            "usr_athlete_1",
        );
        expect(jobRes).toEqual({ jobId: "job_1", analysisId: "ana_1", status: "QUEUED" });
    });

    it("2.3 handles HTTP error responses throwing CoachingApiError", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ message: "Assignment target fighter not found." }), {
                status: 404,
                statusText: "Not Found",
            }),
        );

        await expect(
            coachingApiClient.createAssignment({
                coachId: "coach_1",
                fighterId: "nonexistent_ath",
                title: "Test",
                martialArt: "boxing",
            }),
        ).rejects.toThrow("Assignment target fighter not found.");
    });

    // ─── 3. Pipeline Mode & Mock Guarding ──────────────────────────────────────

    it("3.1 pipeline badge provides clear visual warning when mock mode is active", () => {
        const badge = getPipelineBadge();
        expect(badge.label).toBeDefined();
        if (isMockMode()) {
            expect(badge.isMock).toBe(true);
            expect(badge.label).toBe("DEMO / MOCK MODE");
            expect(badge.warningText).toContain("Data shown is simulated");
        } else {
            expect(badge.isMock).toBe(false);
            expect(badge.label).toBe("AUTHORITATIVE AI PIPELINE");
        }
    });
});

