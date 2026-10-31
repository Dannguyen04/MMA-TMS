import { beforeEach, describe, expect, it, vi } from "vitest";

const services = vi.hoisted(() => ({
    recordExaminationDecision: vi.fn(),
    issueClearance: vi.fn(),
    getClinicalDossier: vi.fn(),
    rereadClinicalDossier: vi.fn(),
}));
const session = vi.hoisted(() => ({ authorizeAction: vi.fn(), authorizeClinicalAction: vi.fn() }));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn((href: string) => {
        throw new Error(`redirect:${href}`);
    }),
}));

vi.mock("@/lib/services/medical", () => services);
vi.mock("@/lib/auth/session", () => session);
vi.mock("@/lib/auth/access", () => ({ canAccessFighter: () => true, canAccessFighterClinically: () => true }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { ApiError } from "@/lib/api/client";
import type { ClinicalDossier, CurrentExamination } from "@/lib/services/medical";
import { issueClearanceAction, recordExaminationDecisionAction } from "./medical-contract";
import type { MedicalWriteData } from "@/lib/domain/medical-flow";
import type { ActionState } from "./state";

/** The idle state, typed for the medical actions' result data. */
const START: ActionState<MedicalWriteData> = { status: "idle" };

const FIGHTER = "f-1";
const doctor = { id: "u-doc", role: "doctor", profileId: "doc-1" };

function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
}

/** A routine training examination (no SCAT6), as the stepped form posts it. */
const examFields = { fighterId: FIGHTER, scope: "TRAINING", decision: "ELIGIBLE", examinedAt: "2026-10-01T09:00", reason: "Healthy routine check.", type: "routine", assessments: "[]", knownCurrentId: "" };
/** 09:00 academy time on 1 Oct 2026. */
const EXAMINED_AT = "2026-10-01T02:00:00.000Z";

const exam = (overrides: Partial<CurrentExamination> = {}): CurrentExamination => ({
    id: "exam-9",
    scope: "TRAINING",
    decision: "ELIGIBLE",
    examinedAt: EXAMINED_AT,
    reason: "Healthy routine check.",
    restrictions: null,
    validUntil: null,
    details: null,
    ...overrides,
});

const dossier = (overrides: Partial<ClinicalDossier> = {}): ClinicalDossier => ({
    fighterId: FIGHTER,
    currentExaminations: { TRAINING: null, COMPETITION: null },
    activeClearances: [],
    openReviewRequests: [],
    eligibility: { TRAINING: { scope: "TRAINING", eligible: false, reasons: ["CLEARANCE_REQUIRED"] }, COMPETITION: { scope: "COMPETITION", eligible: false, reasons: [] } },
    activeInjuries: [],
    activeRecoveryPlans: [],
    ...overrides,
});

const timeout = () => new ApiError({ message: "slow", kind: "timeout", code: "API_TIMEOUT" });

describe("recording an examination the service didn't confirm", () => {
    beforeEach(() => {
        for (const mock of [...Object.values(services), ...Object.values(session)]) mock.mockReset();
        navigation.redirect.mockClear();
        session.authorizeClinicalAction.mockResolvedValue({ ok: true, user: doctor });
    });

    it("reads the record first and goes on to the clearance when the examination was saved after all", async () => {
        services.recordExaminationDecision.mockRejectedValue(timeout());
        services.rereadClinicalDossier.mockResolvedValue(dossier({ currentExaminations: { TRAINING: exam(), COMPETITION: null } }));

        await expect(recordExaminationDecisionAction(START, form(examFields))).rejects.toThrow(`redirect:/doctor/medical-clearance/new?fighter=${FIGHTER}&exam=exam-9&notice=examination-recorded`);
        expect(services.recordExaminationDecision).toHaveBeenCalledTimes(1);
    });

    it("keeps the answers and asks to try again, without a reload, when the record doesn't have it", async () => {
        services.recordExaminationDecision.mockRejectedValue(new ApiError({ message: "down", kind: "http", status: 503, code: "SERVICE_UNAVAILABLE" }));
        services.rereadClinicalDossier.mockResolvedValue(dossier());

        const state = await recordExaminationDecisionAction(START, form(examFields));
        expect(state).toMatchObject({ status: "error", data: { unconfirmed: true } });
        expect(state.message).toContain("try again");
        expect(state.message).not.toMatch(/reload/i);
    });

    it("says it couldn't check when the record can't be read either", async () => {
        services.recordExaminationDecision.mockRejectedValue(timeout());
        services.rereadClinicalDossier.mockRejectedValue(timeout());

        await expect(recordExaminationDecisionAction(START, form(examFields))).resolves.toMatchObject({ status: "error", data: { unconfirmed: true }, message: expect.stringContaining("couldn't check") });
    });

    it("on the retry, checks the record before sending and never sends a saved examination twice", async () => {
        services.rereadClinicalDossier.mockResolvedValue(dossier({ currentExaminations: { TRAINING: exam(), COMPETITION: null } }));

        await expect(recordExaminationDecisionAction(START, form({ ...examFields, reconcile: "1" }))).rejects.toThrow("exam=exam-9");
        expect(services.recordExaminationDecision).not.toHaveBeenCalled();

        // Still unreadable: nothing is sent, and the retry stays a checked retry.
        services.rereadClinicalDossier.mockRejectedValue(timeout());
        await expect(recordExaminationDecisionAction(START, form({ ...examFields, reconcile: "1" }))).resolves.toMatchObject({ data: { unconfirmed: true } });
        expect(services.recordExaminationDecision).not.toHaveBeenCalled();

        // Not there: it is sent once.
        services.rereadClinicalDossier.mockResolvedValue(dossier());
        services.recordExaminationDecision.mockResolvedValue({ id: "exam-10" });
        await expect(recordExaminationDecisionAction(START, form({ ...examFields, reconcile: "1" }))).rejects.toThrow("exam=exam-10");
        expect(services.recordExaminationDecision).toHaveBeenCalledTimes(1);
    });

    it("stops when a different examination was recorded since the form opened", async () => {
        services.recordExaminationDecision.mockRejectedValue(timeout());
        services.rereadClinicalDossier.mockResolvedValue(dossier({ currentExaminations: { TRAINING: exam({ id: "exam-other", reason: "Someone else's visit." }), COMPETITION: null } }));

        const state = await recordExaminationDecisionAction(START, form(examFields));
        expect(state).toMatchObject({ status: "error", message: expect.stringContaining("recorded since you opened this form") });
        expect(state.data).toBeUndefined();
    });

    it("still reports a refusal on its field, without checking the record", async () => {
        services.recordExaminationDecision.mockRejectedValue(new ApiError({ message: "Invalid", kind: "http", status: 422, code: "VALIDATION_ERROR", details: [{ path: ["reason"], message: "Too short" }] }));

        await expect(recordExaminationDecisionAction(START, form(examFields))).resolves.toMatchObject({ fieldErrors: { reason: "Too short." } });
        expect(services.rereadClinicalDossier).not.toHaveBeenCalled();
    });
});

describe("issuing a clearance from an examination", () => {
    const clearanceFields = { fighterId: FIGHTER, examinationId: "exam-9", clearanceType: "TRAINING" };
    const issued = { id: "cl-1", examinationId: "exam-9", clearanceType: "TRAINING" as const, status: "active" as const, issuedAt: "2026-10-01T03:00:00.000Z", validUntil: null };

    beforeEach(() => {
        for (const mock of [...Object.values(services), ...Object.values(session)]) mock.mockReset();
        session.authorizeClinicalAction.mockResolvedValue({ ok: true, user: doctor });
        services.getClinicalDossier.mockResolvedValue(dossier({ currentExaminations: { TRAINING: exam(), COMPETITION: null } }));
    });

    it("shows a clearance already issued from the examination instead of issuing a duplicate", async () => {
        services.getClinicalDossier.mockResolvedValue(dossier({ currentExaminations: { TRAINING: exam(), COMPETITION: null }, activeClearances: [issued as never] }));

        await expect(issueClearanceAction(START, form(clearanceFields))).resolves.toMatchObject({ status: "error", data: { existingClearance: { id: "cl-1", clearanceType: "TRAINING" } } });
        expect(services.issueClearance).not.toHaveBeenCalled();
    });

    it("treats a clearance that timed out but is on the record as issued, retrying only the clearance", async () => {
        services.issueClearance.mockRejectedValue(timeout());
        services.rereadClinicalDossier.mockResolvedValue(dossier({ activeClearances: [issued as never] }));

        await expect(issueClearanceAction(START, form(clearanceFields))).rejects.toThrow(`redirect:/doctor/fighters/${FIGHTER}?notice=clearance-issued`);
        expect(services.recordExaminationDecision).not.toHaveBeenCalled();
    });

    it("asks to try again when the timed-out clearance isn't on the record, and checks before resending", async () => {
        services.issueClearance.mockRejectedValue(timeout());
        services.rereadClinicalDossier.mockResolvedValue(dossier());
        await expect(issueClearanceAction(START, form(clearanceFields))).resolves.toMatchObject({ data: { unconfirmed: true } });

        services.issueClearance.mockReset();
        services.rereadClinicalDossier.mockResolvedValue(dossier({ activeClearances: [issued as never] }));
        await expect(issueClearanceAction(START, form({ ...clearanceFields, reconcile: "1" }))).rejects.toThrow("notice=clearance-issued");
        expect(services.issueClearance).not.toHaveBeenCalled();
    });

    it("shows the existing clearance after a 409 conflict", async () => {
        services.issueClearance.mockRejectedValue(new ApiError({ message: "Conflict", kind: "http", status: 409, code: "MEDICAL_RECORD_CONFLICT" }));
        services.rereadClinicalDossier.mockResolvedValue(dossier({ activeClearances: [issued as never] }));

        await expect(issueClearanceAction(START, form(clearanceFields))).resolves.toMatchObject({ data: { existingClearance: { id: "cl-1" } }, fieldErrors: { clearanceType: expect.any(String) } });
    });
});
