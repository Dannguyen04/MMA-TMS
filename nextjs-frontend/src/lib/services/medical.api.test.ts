import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedApiRequest = vi.hoisted(() => vi.fn());
const people = vi.hoisted(() => ({
    getFighter: vi.fn(),
    getDoctor: vi.fn(),
    listFighters: vi.fn(),
    listScopedFighterIds: vi.fn(),
}));

vi.mock("@/lib/api/client", async (loadOriginal) => {
    const original = await loadOriginal<typeof import("@/lib/api/client")>();
    return { ...original, authenticatedApiRequest };
});
vi.mock("./people", () => people);
vi.mock("./admin", () => ({ getSettings: vi.fn().mockResolvedValue({ clearanceExpiryWarningDays: 14 }) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn().mockResolvedValue({ id: "u-doc", role: "doctor" }) }));

import { ApiError } from "@/lib/api/client";
import type { Fighter } from "@/lib/domain/types";
import { getClearanceStatus, getFighterHealthSummary, getInjuryDetail, listClearances, listInjuries } from "./medical";

const FIGHTER = "f-1";
const fighter = { id: FIGHTER, name: "Minh Tran", healthStatus: "healthy" } as Fighter;

const examination = {
    id: "exam-1",
    sequenceNo: 1,
    fighterId: FIGHTER,
    doctorId: "doc-1",
    recordedById: "u-doc",
    scope: "TRAINING",
    decision: "ELIGIBLE_WITH_RESTRICTIONS",
    examinedAt: "2026-09-01T02:00:00.000Z",
    reason: "Left knee still sore after sparring.",
    restrictions: { allowedSessionTypes: ["SHADOW_BOXING", "PAD_WORK"], allowedTechniqueTypes: null, excludedJoints: ["LEFT_KNEE"], notes: "No sparring" },
    validUntil: "2026-12-01T00:00:00.000Z",
    supersedesId: null,
    createdAt: "2026-09-01T02:00:00.000Z",
};

const clearance = {
    id: "cl-1",
    fighterId: FIGHTER,
    examinationId: "exam-1",
    issuedById: "doc-1",
    clearanceType: "TRAINING",
    status: "ACTIVE",
    validFrom: "2026-09-01T02:00:00.000Z",
    validUntil: "2026-12-01T00:00:00.000Z",
    notes: null,
    restrictions: { allowedSessionTypes: ["SHADOW_BOXING", "PAD_WORK"], allowedTechniqueTypes: null, excludedJoints: ["LEFT_KNEE"], notes: "No sparring" },
    revokedAt: null,
    revokedById: null,
    revokedReason: null,
    revision: 1,
    createdAt: "2026-09-01T02:00:00.000Z",
    isCurrentlyValid: true,
};

const injury = {
    id: "inj-1",
    fighterId: FIGHTER,
    reportedById: "doc-1",
    affectedJoint: "LEFT_KNEE",
    injuryType: "MCL sprain",
    severity: "MODERATE",
    occurredAt: "2026-08-28T10:00:00.000Z",
    description: "Twisted in sparring.",
    status: "RECOVERING",
    resolvedAt: null,
    sourceAlertId: null,
    triggerVideoId: null,
    revision: 2,
    createdAt: "2026-08-28T10:00:00.000Z",
    updatedAt: "2026-09-01T02:00:00.000Z",
};

const plan = {
    id: "plan-1",
    fighterId: FIGHTER,
    injuryId: "inj-1",
    doctorId: "doc-1",
    title: "Knee return",
    description: null,
    startDate: "2026-09-01",
    estimatedEndDate: "2026-10-15",
    actualEndDate: null,
    status: "ACTIVE",
    milestones: [
        { id: "m-1", title: "Full range", criteria: "Pain-free flexion", targetDate: "2026-09-15", isCompleted: true, completedAt: "2026-09-14T00:00:00.000Z", notes: null },
        { id: "m-2", title: "Jogging", criteria: "20 minutes", targetDate: "2026-10-01", isCompleted: false, completedAt: null, notes: null },
    ],
    revision: 1,
    createdAt: "2026-09-01T02:00:00.000Z",
    updatedAt: "2026-09-14T00:00:00.000Z",
};

const eligible = { scope: "TRAINING", eligible: true, reasons: [] };
const dossier = {
    fighterId: FIGHTER,
    activeInjuries: [injury],
    activeRecoveryPlans: [plan],
    currentExaminations: { training: examination, competition: null },
    activeClearances: [clearance],
    openReviewRequests: [],
    eligibility: { training: eligible, competition: { ...eligible, scope: "COMPETITION" } },
};

const page = <T>(data: T[]) => ({ data, total: data.length, hasNextPage: false });

function history(recordType: string, entries: { recordId: string; revision: number; recordedAt: string; snapshot: Record<string, unknown> }[]) {
    return page(entries.map((entry) => ({ recordType, source: "APPLICATION", recordedByUserId: "u-doc", ...entry })));
}

type Schema = { parse: (value: unknown) => unknown };

/** Answers like the real client: the first matching route's body, validated with the caller's schema. */
function respond(routes: Record<string, unknown>) {
    authenticatedApiRequest.mockImplementation(async (path: string, schema: Schema) => {
        const key = Object.keys(routes).find((prefix) => path.startsWith(prefix));
        if (!key) throw new ApiError({ message: "not found", kind: "http", status: 404, code: "NOT_FOUND" });
        return schema.parse(routes[key]);
    });
}

describe("medical service reads in API mode", () => {
    beforeEach(() => {
        vi.stubEnv("APP_DATA_MODE", "api");
        authenticatedApiRequest.mockReset();
        people.getFighter.mockResolvedValue(fighter);
        people.getDoctor.mockResolvedValue({ id: "doc-1", name: "Dr. Thu Le" });
        people.listFighters.mockResolvedValue([fighter]);
        people.listScopedFighterIds.mockResolvedValue([FIGHTER]);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("builds the health summary from the dossier", async () => {
        respond({ [`/fighters/${FIGHTER}/medical`]: dossier });

        const summary = await getFighterHealthSummary(FIGHTER);

        expect(summary).toMatchObject({
            clearanceState: "restricted",
            clearance: {
                id: "cl-1",
                level: "restricted",
                status: "active",
                clearanceType: "TRAINING",
                restrictions: [{ label: "No sparring", blockedRegions: ["left_knee"] }],
            },
            activeInjuries: [{ id: "inj-1", type: null, typeLabel: "MCL sprain", bodyRegion: "left_knee", joint: "LEFT_KNEE", severity: "moderate", status: "recovering" }],
            activeRecoveryPlan: { progressPct: 50, currentPhase: null, plan: { targetReturnDate: "2026-10-15", phases: [] } },
            latestExamination: { id: "exam-1", scope: "TRAINING", outcome: "fit_with_restrictions", vitals: null, type: null },
            nextFollowUp: null,
        });
        expect(authenticatedApiRequest).toHaveBeenCalledWith(`/fighters/${FIGHTER}/medical`, expect.anything());
    });

    it("takes the clearance state from the eligibility verdict, not from picking a clearance", async () => {
        respond({
            [`/fighters/${FIGHTER}/medical`]: {
                ...dossier,
                activeClearances: [],
                currentExaminations: { training: null, competition: null },
                eligibility: { training: { scope: "TRAINING", eligible: false, reasons: ["CLEARANCE_REQUIRED"] }, competition: eligible },
            },
        });
        await expect(getClearanceStatus(FIGHTER)).resolves.toMatchObject({ state: "none", clearance: null });

        respond({
            [`/fighters/${FIGHTER}/medical`]: {
                ...dossier,
                eligibility: { training: { scope: "TRAINING", eligible: false, reasons: ["REVIEW_REQUEST_PENDING", "SOMETHING_NEW"] }, competition: eligible },
            },
        });
        await expect(getClearanceStatus(FIGHTER)).resolves.toMatchObject({ state: "not_cleared", eligibility: { reasons: ["REVIEW_REQUEST_PENDING"] } });
    });

    it("merges active injuries with the newest history revision of closed ones", async () => {
        const resolvedV1 = { ...injury, id: "inj-0", injuryType: "Wrist sprain", affectedJoint: "RIGHT_WRIST", status: "ACTIVE", resolvedAt: null };
        const resolvedV2 = { ...resolvedV1, status: "RESOLVED", resolvedAt: "2026-07-01T00:00:00.000Z" };
        respond({
            [`/fighters/${FIGHTER}/medical/history`]: history("INJURY", [
                { recordId: "inj-0", revision: 1, recordedAt: "2026-06-01T00:00:00.000Z", snapshot: resolvedV1 },
                { recordId: "inj-0", revision: 2, recordedAt: "2026-07-01T00:00:00.000Z", snapshot: resolvedV2 },
                { recordId: "inj-1", revision: 1, recordedAt: "2026-08-28T10:00:00.000Z", snapshot: injury },
            ]),
            [`/fighters/${FIGHTER}/medical`]: dossier,
        });

        const injuries = await listInjuries({ fighterIds: [FIGHTER] });

        expect(injuries.map((i) => [i.id, i.status, i.bodyRegion])).toEqual([
            ["inj-1", "recovering", "left_knee"],
            ["inj-0", "resolved", "right_hand"],
        ]);
        expect(await listInjuries({ fighterIds: [FIGHTER], status: "resolved" })).toHaveLength(1);
    });

    it("finds an injury by id across the fighters in scope, with its treatments from history", async () => {
        const treatment = {
            id: "tr-1",
            injuryId: "inj-1",
            doctorId: "doc-1",
            treatmentDate: "2026-09-02T02:00:00.000Z",
            treatmentType: "Physiotherapy",
            description: "Quad activation",
            outcomeNotes: "Less swelling",
            nextReviewAt: "2026-09-09T02:00:00.000Z",
            createdAt: "2026-09-02T02:00:00.000Z",
        };
        authenticatedApiRequest.mockImplementation(async (path: string, schema: Schema) => {
            if (path.includes("recordType=TREATMENT")) return schema.parse(history("TREATMENT", [{ recordId: "tr-1", revision: 1, recordedAt: treatment.createdAt, snapshot: treatment }]));
            if (path.includes("/medical/history")) return schema.parse(page([]));
            if (path.endsWith("/medical")) return schema.parse(dossier);
            throw new ApiError({ message: "not found", kind: "http", status: 404, code: "NOT_FOUND" });
        });

        const detail = await getInjuryDetail("inj-1");

        expect(detail).toMatchObject({
            injury: { id: "inj-1" },
            treatments: [{ id: "tr-1", typeLabel: "Physiotherapy", type: null, status: null, notes: "Less swelling", nextReviewAt: "2026-09-09T02:00:00.000Z" }],
            recoveryPlan: { id: "plan-1" },
            recordedBy: { name: "Dr. Thu Le" },
            linkedAlert: null,
        });
        await expect(getInjuryDetail("missing")).resolves.toBeNull();
    });

    it("reads revoked clearances from history, whose lists are flat", async () => {
        const revoked = {
            id: "cl-0",
            fighterId: FIGHTER,
            examinationId: "exam-0",
            issuedById: "doc-1",
            clearanceType: "TRAINING",
            status: "REVOKED",
            validFrom: "2026-06-01T00:00:00.000Z",
            validUntil: null,
            notes: "Baseline",
            allowedSessionTypes: null,
            allowedTechniqueTypes: null,
            excludedJoints: null,
            revokedAt: "2026-08-28T12:00:00.000Z",
            revokedById: "u-doc",
            revokedReason: "Knee injury",
            createdAt: "2026-06-01T00:00:00.000Z",
            updatedAt: "2026-08-28T12:00:00.000Z",
        };
        respond({
            [`/fighters/${FIGHTER}/medical/history`]: history("MEDICAL_CLEARANCE", [{ recordId: "cl-0", revision: 2, recordedAt: revoked.updatedAt, snapshot: revoked }]),
            [`/fighters/${FIGHTER}/medical`]: dossier,
        });

        const clearances = await listClearances({ fighterIds: [FIGHTER] });

        expect(clearances.map((c) => [c.id, c.status, c.level])).toEqual([
            ["cl-1", "active", "restricted"],
            ["cl-0", "revoked", "full"],
        ]);
        expect(clearances[1]).toMatchObject({ reason: "Baseline", revokedReason: "Knee injury", isCurrentlyValid: false });
    });

    it("leaves out fighters whose records the caller can't read", async () => {
        authenticatedApiRequest.mockRejectedValue(new ApiError({ message: "denied", kind: "http", status: 403, code: "MEDICAL_ACCESS_DENIED" }));
        await expect(getFighterHealthSummary(FIGHTER)).resolves.toBeNull();
        await expect(listInjuries({ fighterIds: [FIGHTER] })).resolves.toEqual([]);
    });
});
