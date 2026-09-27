import { describe, expect, it } from "vitest";

import type { ClinicalRestrictions, MedicalEligibility } from "./medical-contract";
import {
    clearanceStateFromEligibility,
    isRestricted,
    jointForRegion,
    latestRevisions,
    milestoneProgressPct,
    restrictionFromAllowLists,
    sessionTypesFor,
    standardMilestones,
} from "./medical-mappings";

const eligibility = (eligible: boolean, reasons: MedicalEligibility["reasons"] = []): MedicalEligibility => ({ scope: "TRAINING", eligible, reasons });
const lists = (overrides: Partial<ClinicalRestrictions> = {}): ClinicalRestrictions => ({
    allowedSessionTypes: null,
    allowedTechniqueTypes: null,
    excludedJoints: null,
    notes: null,
    ...overrides,
});

describe("body and training vocabularies", () => {
    it("maps regions back to service joints where the service records them", () => {
        expect(jointForRegion("left_hand")).toBe("LEFT_WRIST");
        expect(jointForRegion("lower_back")).toBe("SPINE_CORE");
        expect(jointForRegion("head")).toBeNull();
    });

    it("groups session types under frontend training types", () => {
        expect(sessionTypesFor("recovery_mobility")).toEqual(["RECOVERY", "PHYSICAL_THERAPY"]);
        expect(sessionTypesFor("technical_drilling")).toEqual([]);
    });
});

describe("restrictionFromAllowLists", () => {
    it("blocks everything the allow-lists leave out, and technical drilling whenever sessions are limited", () => {
        const restriction = restrictionFromAllowLists(
            lists({ allowedSessionTypes: ["SHADOW_BOXING", "RECOVERY"], allowedTechniqueTypes: ["JAB", "LEAD_HOOK"], excludedJoints: ["LEFT_KNEE", "RIGHT_WRIST"], notes: "No sparring" }),
            "r-1",
        );
        expect(restriction).toEqual({
            id: "r-1",
            label: "No sparring",
            blockedTrainingTypes: ["pad_work", "heavy_bag", "sparring", "technical_drilling", "grappling", "strength_conditioning"],
            blockedTechniques: ["cross", "kick"],
            blockedRegions: ["left_knee", "right_hand"],
            maxRpe: null,
        });
    });

    it("blocks nothing for open lists", () => {
        expect(restrictionFromAllowLists(lists(), "r-2")).toMatchObject({ label: "Medical restrictions", blockedTrainingTypes: [], blockedTechniques: [], blockedRegions: [] });
        expect(isRestricted(lists({ notes: "Warm up well" }))).toBe(false);
        expect(isRestricted(lists({ excludedJoints: ["SPINE_CORE"] }))).toBe(true);
    });
});

describe("clearanceStateFromEligibility", () => {
    it("reads nothing on file as no clearance yet", () => {
        expect(clearanceStateFromEligibility(eligibility(false, ["CLEARANCE_REQUIRED"]), null, false)).toBe("none");
    });

    it("pauses training for a pending review, a not-eligible examination or a missing clearance", () => {
        const exam = { decision: "ELIGIBLE" as const };
        expect(clearanceStateFromEligibility(eligibility(false, ["REVIEW_REQUEST_PENDING"]), exam, false)).toBe("not_cleared");
        expect(clearanceStateFromEligibility(eligibility(false, ["EXAMINATION_NOT_ELIGIBLE"]), { decision: "NOT_ELIGIBLE" }, false)).toBe("not_cleared");
        expect(clearanceStateFromEligibility(eligibility(false, ["CLEARANCE_REQUIRED"]), exam, false)).toBe("not_cleared");
    });

    it("tells an expired clearance apart", () => {
        expect(clearanceStateFromEligibility(eligibility(false, ["CLEARANCE_EXPIRED"]), { decision: "ELIGIBLE" }, false)).toBe("expired");
    });

    it("colours an eligible fighter by restrictions", () => {
        expect(clearanceStateFromEligibility(eligibility(true), { decision: "ELIGIBLE" }, false)).toBe("full");
        expect(clearanceStateFromEligibility(eligibility(true), { decision: "ELIGIBLE_WITH_RESTRICTIONS" }, false)).toBe("restricted");
        expect(clearanceStateFromEligibility(eligibility(true), { decision: "ELIGIBLE" }, true)).toBe("restricted");
    });
});

describe("history and milestones", () => {
    it("keeps the newest revision of each record, newest first", () => {
        const entries = [
            { recordId: "a", revision: 1, recordedAt: "2026-09-01T00:00:00Z" },
            { recordId: "a", revision: 2, recordedAt: "2026-09-03T00:00:00Z" },
            { recordId: "b", revision: 1, recordedAt: "2026-09-02T00:00:00Z" },
        ];
        expect(latestRevisions(entries).map((entry) => `${entry.recordId}@${entry.revision}`)).toEqual(["a@2", "b@1"]);
    });

    it("recognises standard milestones and leaves legacy arrays alone", () => {
        const standard = [{ id: "m1", title: "Full range", criteria: "Pain-free", targetDate: null, isCompleted: true, completedAt: "2026-09-01T00:00:00Z", notes: null }];
        expect(standardMilestones(standard)).toEqual(standard);
        expect(standardMilestones([{ label: "Old style", done: true }])).toBeNull();
        expect(milestoneProgressPct([...standard, { ...standard[0], id: "m2", isCompleted: false, completedAt: null }])).toBe(50);
        expect(milestoneProgressPct([])).toBe(0);
    });
});
