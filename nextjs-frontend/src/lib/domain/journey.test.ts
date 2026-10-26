import { describe, expect, it } from "vitest";

import { buildFighterJourney, journeyOwnerLabel, journeyStep, type JourneyInput } from "./journey";

const DR_THU = { id: "d-thu", name: "Dr. Thu Lê" };
const RAFAEL = { id: "c-rafael", name: "Rafael Costa" };

/** A fighter fresh from activation: nothing assigned, no baseline, no plan, no uploads. */
function input(overrides: Partial<JourneyInput> = {}): JourneyInput {
    return {
        viewer: "fighter",
        doctors: [],
        coaches: [],
        eligibility: { eligible: false, reasons: ["EXAMINATION_REQUIRED"] },
        restricted: false,
        plans: [],
        videos: [],
        ...overrides,
    };
}

const statuses = (journey: ReturnType<typeof buildFighterJourney>) => Object.fromEntries(journey.steps.map((step) => [step.id, step.status]));

describe("buildFighterJourney", () => {
    it("waits on the academy to assign a doctor right after activation", () => {
        const journey = buildFighterJourney(input());
        expect(statuses(journey)).toEqual({
            account: "done",
            doctor: "waiting",
            baseline: "upcoming",
            clearance: "upcoming",
            plan: "upcoming",
            analysis: "upcoming",
        });
        expect(journey.active?.id).toBe("doctor");
        expect(journey.active?.owner).toBe("admin");
        expect(journey.active?.detail).toBe("Waiting for the academy to assign your sports doctor");
        expect(journey.cleared).toBe(false);
        expect(journey.complete).toBe(false);
        expect(journey.doneCount).toBe(1);
    });

    it("makes the doctor assignment the admin's own move", () => {
        const journey = buildFighterJourney(input({ viewer: "admin" }));
        expect(journey.active?.status).toBe("current");
        expect(journey.active?.detail).toBe("Assign a sports doctor");
    });

    it("names the doctor who holds the baseline exam", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU] }));
        expect(journeyStep(journey, "doctor")).toMatchObject({ status: "done", detail: "Dr. Thu Lê" });
        expect(journey.active).toMatchObject({ id: "baseline", status: "waiting", code: "baseline_pending", person: "Dr. Thu Lê" });
        expect(journey.active?.detail).toBe("Your baseline exam is with Dr. Thu Lê");

        expect(buildFighterJourney(input({ doctors: [DR_THU], viewer: "coach" })).active?.detail).toBe("Baseline exam with Dr. Thu Lê");
        const doctorView = buildFighterJourney(input({ doctors: [DR_THU], viewer: "doctor" })).active;
        expect(doctorView).toMatchObject({ status: "current", detail: "Record the baseline exam" });
    });

    it("waits for the clearance once the baseline is on file", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: false, reasons: ["CLEARANCE_REQUIRED"] } }));
        expect(journeyStep(journey, "baseline").status).toBe("done");
        expect(journey.active).toMatchObject({ id: "clearance", code: "clearance_pending", attention: false });
        expect(journey.active?.detail).toBe("Waiting for your Medical Clearance from Dr. Thu Lê");
    });

    it("never reads a verdict without reasons as eligible", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: false, reasons: [] } }));
        expect(journey.cleared).toBe(false);
        // The verdict can't tell whether the baseline is on file, so that step stays unknown rather than guessed.
        expect(journeyStep(journey, "baseline").status).toBe("unknown");
        expect(journey.active).toMatchObject({ id: "clearance", code: "clearance_unspecified", attention: true, detail: "Not cleared to train yet" });
    });

    it("keeps a reason it doesn't know as a blocker", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: false, reasons: ["SOMETHING_NEW"] } }));
        expect(journey.cleared).toBe(false);
        expect(journeyStep(journey, "baseline").status).toBe("done");
        expect(journey.active).toMatchObject({ id: "clearance", code: "clearance_unspecified", attention: true });
    });

    it("explains the most serious reason first", () => {
        const reasons = (list: string[]) => buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: false, reasons: list } })).active?.code;
        expect(reasons(["REVIEW_REQUEST_PENDING", "EXAMINATION_NOT_ELIGIBLE"])).toBe("not_eligible");
        expect(reasons(["CLEARANCE_EXPIRED", "REVIEW_REQUEST_PENDING"])).toBe("review_pending");
        expect(reasons(["CLEARANCE_EXPIRED"])).toBe("clearance_expired");
    });

    it("leaves the clearance waiting behind a missing baseline, whatever else is pending", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: false, reasons: ["EXAMINATION_REQUIRED", "REVIEW_REQUEST_PENDING"] } }));
        expect(journey.active?.id).toBe("baseline");
        expect(journeyStep(journey, "clearance")).toMatchObject({ status: "upcoming", detail: "After the baseline exam" });
    });

    it("trusts the verdict for clearance, with or without restrictions", () => {
        const cleared = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: true, reasons: [] } }));
        expect(journeyStep(cleared, "clearance")).toMatchObject({ status: "done", code: "cleared", detail: "Cleared to train" });
        expect(cleared.cleared).toBe(true);
        const restricted = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: true, reasons: [] }, restricted: true }));
        expect(journeyStep(restricted, "clearance")).toMatchObject({ code: "cleared_restricted", detail: "Cleared with restrictions" });
    });

    it("marks what couldn't be read as unknown instead of failing or guessing", () => {
        const journey = buildFighterJourney(input({ doctors: null, eligibility: null, plans: null, videos: null }));
        expect(statuses(journey)).toEqual({ account: "done", doctor: "unknown", baseline: "unknown", clearance: "unknown", plan: "unknown", analysis: "unknown" });
        expect(journey.active).toBeNull();
        expect(journey.complete).toBe(false);
        expect(journey.cleared).toBeNull();
    });

    it("counts the doctor step done when a baseline is on file, even if assignments can't be read", () => {
        const journey = buildFighterJourney(input({ doctors: null, eligibility: { eligible: false, reasons: ["CLEARANCE_REQUIRED"] } }));
        expect(journeyStep(journey, "doctor")).toMatchObject({ status: "done", detail: "Assigned" });
        expect(journey.active?.detail).toBe("Waiting for your Medical Clearance");
    });

    it("moves on to the plan, naming the coach preparing a draft", () => {
        const cleared = { eligible: true, reasons: [] };
        const draft = buildFighterJourney(input({ doctors: [DR_THU], coaches: [RAFAEL], eligibility: cleared, plans: [{ status: "draft", title: "Base block", coachId: "c-rafael" }] }));
        expect(draft.active).toMatchObject({ id: "plan", code: "plan_draft", detail: "Rafael Costa is preparing your plan", status: "waiting" });

        const coachView = buildFighterJourney(input({ viewer: "coach", doctors: [DR_THU], coaches: [RAFAEL], eligibility: cleared }));
        expect(coachView.active).toMatchObject({ id: "plan", status: "current", detail: "Build a training plan" });

        const active = buildFighterJourney(input({ doctors: [DR_THU], eligibility: cleared, plans: [{ status: "active", title: "Base block", coachId: "c-rafael" }] }));
        expect(journeyStep(active, "plan")).toMatchObject({ status: "done", detail: "Base block" });
        expect(active.active).toMatchObject({ id: "analysis", status: "current", detail: "Upload a video for AI analysis" });
    });

    it("reads the newest upload for the analysis step, and any finished analysis completes it", () => {
        const base = { doctors: [DR_THU], eligibility: { eligible: true, reasons: [] }, plans: [{ status: "active" as const, title: "Base", coachId: "c" }] };
        const processing = buildFighterJourney(input({ ...base, videos: [{ status: "processing", uploadedAt: "2026-10-10T08:00:00Z" }, { status: "failed", uploadedAt: "2026-10-01T08:00:00Z" }] }));
        expect(processing.active?.code).toBe("analysis_processing");
        const failed = buildFighterJourney(input({ ...base, videos: [{ status: "failed", uploadedAt: "2026-10-10T08:00:00Z" }] }));
        expect(failed.active?.code).toBe("analysis_failed");

        const done = buildFighterJourney(input({ ...base, videos: [{ status: "failed", uploadedAt: "2026-10-10T08:00:00Z" }, { status: "completed", uploadedAt: "2026-10-01T08:00:00Z" }] }));
        expect(done.complete).toBe(true);
        expect(done.active).toBeNull();
        expect(done.doneCount).toBe(6);
    });

    it("shows an analysis done before the plan, without skipping the plan", () => {
        const journey = buildFighterJourney(input({ doctors: [DR_THU], eligibility: { eligible: true, reasons: [] }, videos: [{ status: "completed", uploadedAt: "2026-10-01T08:00:00Z" }] }));
        expect(journey.active?.id).toBe("plan");
        expect(journeyStep(journey, "analysis").status).toBe("done");
        expect(journey.complete).toBe(false);
    });
});

describe("journeyOwnerLabel", () => {
    it("says You when the viewer owns the step", () => {
        expect(journeyOwnerLabel("fighter", "fighter")).toBe("You");
        expect(journeyOwnerLabel("admin", "fighter")).toBe("Academy admin");
        expect(journeyOwnerLabel("doctor", "doctor")).toBe("You");
    });
});
