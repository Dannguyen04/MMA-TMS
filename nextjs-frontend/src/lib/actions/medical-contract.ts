"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { canAccessFighter, canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeAction, authorizeClinicalAction } from "@/lib/auth/session";
import { milestoneDrafts, widenedLists, type MilestoneDraft, type RestrictionLists } from "@/lib/domain/medical-bodies";
import {
    API_INJURY_SEVERITIES,
    BODY_JOINTS,
    CLEARANCE_TYPE_LABELS,
    CLEARANCE_TYPES,
    CLEARANCE_TYPES_BY_SCOPE,
    EXAMINATION_DECISIONS,
    EXAMINATION_DETAIL_LIMITS,
    EXAMINATION_SCOPES,
    MEDICAL_TEXT_LIMITS,
    RECOVERY_MILESTONES_MAX,
    SESSION_TYPES,
    TECHNIQUE_TYPES,
    type ClearanceType,
    type ExaminationScope,
} from "@/lib/domain/medical-contract";
import { clearanceFromExamination, isRecordedAttempt, RECONCILE_FIELD, type ExaminationAttempt, type MedicalWriteData } from "@/lib/domain/medical-flow";
import { friendlyScat6Issues } from "@/lib/domain/medical-scat6";
import type { MedicalClearance } from "@/lib/domain/types";
import { academyWallClockToIso, dayKey, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { getTranslator } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/translate";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import {
    createMilestonePlan,
    createReviewRequest,
    getClinicalDossier,
    issueClearance,
    listRecoveryPlans,
    recordExaminationDecision,
    recordInjury,
    recordTreatment,
    rereadClinicalDossier,
    updateMilestonePlan,
} from "@/lib/services/medical";
import { isUnconfirmedWrite, medicalWriteFailure, unconfirmedWriteMessages, type MedicalWriteErrorOptions } from "@/lib/services/medical-errors";
import { allBlank } from "@/lib/utils";
import { assessmentSchema, checkBloodPressure, checkFollowUpDate, EXAMINATION_TYPES, issuesOf, readVitals, scat6Field, scat6Issues, toVitals, VITAL_FIELDS } from "./examination-fields";
import { NOT_ASSIGNED, checked, isInFuture, jsonArray, optionalDate, revalidateClinical, text, texts } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/*
 * Server Actions for the medical service's own records (API mode). Each one validates the form, checks the
 * caller's assignment, sends one request and maps a refusal back onto the form. A failed request is never retried.
 */

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const required = (message: string) => z.string().trim().min(1, message);

const boundedText = (label: string, max: number, min = 0, minMessage = "", t?: Translator) =>
    z
        .string()
        .trim()
        .min(min, minMessage)
        .max(max, t ? t("validation.maxChars", { label, max: max.toLocaleString("en-US") }) : `${label} tối đa ${max.toLocaleString("vi-VN")} ký tự.`);

/** A datetime-local value in academy time, as an ISO timestamp. */
function wallClockIso(value: string): string {
    const [day, time] = value.split("T");
    return academyWallClockToIso(day, time);
}

/** A date the doctor picked as a time on that day: now for today, else midday academy time. */
function dayIso(key: string): string {
    return key === dayKey(new Date()) ? new Date().toISOString() : academyWallClockToIso(key, "12:00");
}

const maxIso = (a: string, b: string) => (Date.parse(a) >= Date.parse(b) ? a : b);

function failed(error: unknown, options?: MedicalWriteErrorOptions): ActionState<never> {
    const failure = medicalWriteFailure(error, options);
    return actionError(failure.message, failure.fieldErrors);
}

/* ─── Restriction lists (shared by examinations and clearances) ───────────── */

const RESTRICTION_FIELDS: Record<string, string> = {
    restrictions: "restrictions",
    "restrictions.allowedSessionTypes": "allowedSessionTypes",
    "restrictions.allowedTechniqueTypes": "allowedTechniqueTypes",
    "restrictions.excludedJoints": "excludedJoints",
    "restrictions.notes": "restrictionNotes",
};

const restrictionListsSchema = z
    .object({
        limitSessions: z.boolean(),
        allowedSessionTypes: z.array(z.enum(SESSION_TYPES)),
        limitTechniques: z.boolean(),
        allowedTechniqueTypes: z.array(z.enum(TECHNIQUE_TYPES)),
        excludedJoints: z.array(z.enum(BODY_JOINTS)),
    })
    .superRefine((lists, ctx) => {
        if (lists.limitSessions && lists.allowedSessionTypes.length === 0) {
            ctx.addIssue({ code: "custom", path: ["allowedSessionTypes"], message: "Chọn ít nhất một loại buổi tập võ sĩ được làm, hoặc tắt giới hạn này." });
        }
        if (lists.limitTechniques && lists.allowedTechniqueTypes.length === 0) {
            ctx.addIssue({ code: "custom", path: ["allowedTechniqueTypes"], message: "Chọn ít nhất một kỹ thuật võ sĩ được dùng, hoặc tắt giới hạn này." });
        }
    });

function restrictionListsFrom(formData: FormData) {
    return {
        limitSessions: checked(formData, "limitSessions"),
        allowedSessionTypes: texts(formData, "allowedSessionTypes"),
        limitTechniques: checked(formData, "limitTechniques"),
        allowedTechniqueTypes: texts(formData, "allowedTechniqueTypes"),
        excludedJoints: texts(formData, "excludedJoints"),
    };
}

function toLists(lists: z.output<typeof restrictionListsSchema>): RestrictionLists {
    return {
        allowedSessionTypes: lists.limitSessions ? lists.allowedSessionTypes : null,
        allowedTechniqueTypes: lists.limitTechniques ? lists.allowedTechniqueTypes : null,
        excludedJoints: lists.excludedJoints.length > 0 ? lists.excludedJoints : null,
    };
}

/** Validation errors with restriction list errors reported under the list's own field name, as the form names them. */
function restrictionFormError(error: z.ZodError): ActionState<never> {
    const state = validationError(error);
    return { ...state, fieldErrors: Object.fromEntries(Object.entries(state.fieldErrors ?? {}).map(([key, message]) => [key.replace(/^lists\./, ""), message])) };
}

const limitsSomething = (lists: RestrictionLists) => lists.allowedSessionTypes !== null || lists.allowedTechniqueTypes !== null || lists.excludedJoints !== null;

/* ─── Review requests ─────────────────────────────────────────────────────── */

const reviewRequestSchema = (t?: Translator) =>
    z.object({
    fighterId: required("Thiếu thông tin võ sĩ. Hãy tải lại trang và thử lại."),
    reason: boundedText("reason", MEDICAL_TEXT_LIMITS.reviewReason, 10, "Hãy nói điều đã xảy ra hoặc điều bạn lo lắng, trong một hai câu.", t),
});

/** A fighter (for themselves), their coach or their doctor asks for a medical review. */
export async function requestMedicalReviewAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [auth, { t }] = await Promise.all([authorizeAction("medical:request_review"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = reviewRequestSchema(t).safeParse({ fighterId: text(formData, "fighterId"), reason: text(formData, "reason") });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, reason } = parsed.data;
    const allowed = auth.user.role === "fighter" ? auth.user.profileId === fighterId : canAccessFighter(auth.user, fighterId);
    if (!allowed) return actionError(t("reviewRequest.unauthorized"));

    try {
        const result = await createReviewRequest(fighterId, reason, auth.user);
        if (!result.ok) return actionError(result.error);
    } catch (error) {
        return failed(error, { fields: { reason: "reason" } });
    }

    revalidateClinical();
    return actionSuccess(t("reviewRequest.actionSuccess"));
}

/* ─── Examination decisions ───────────────────────────────────────────────── */

const examinationSchema = (t?: Translator) =>
    z
    .object({
        fighterId: required("Hãy chọn võ sĩ đã khám."),
        scope: z.enum(EXAMINATION_SCOPES, { error: "Choose what this examination decides." }),
        decision: z.enum(EXAMINATION_DECISIONS, { error: "Choose your decision." }),
        examinedAt: z.string().refine(isDateTimeInputValue, "Hãy nhập ngày giờ khám."),
        reason: boundedText("reasoning", MEDICAL_TEXT_LIMITS.examinationReason, 10, "Giải thích quyết định trong một hai câu.", t),
        lists: restrictionListsSchema,
        restrictionNotes: boundedText("ghi chú hạn chế", MEDICAL_TEXT_LIMITS.restrictionNotes, 0, "", t),
        validUntil: optionalDate("Hãy nhập ngày hợp lệ, hoặc để trống."),
        supersedesId: z.string().trim(),
        reviewRequestIds: z.array(z.string().min(1)).max(50, "Chọn tối đa 50 yêu cầu xem xét."),
        type: z.enum(EXAMINATION_TYPES, { error: "Choose the examination type." }),
        assessments: jsonArray(assessmentSchema, "assessments", {
            max: EXAMINATION_DETAIL_LIMITS.assessments,
            maxMessage: `Ghi tối đa ${EXAMINATION_DETAIL_LIMITS.assessments} đánh giá.`,
        }),
        recommendations: boundedText("recommendations", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
        followUpDate: optionalDate("Hãy nhập ngày tái khám hợp lệ, hoặc để trống."),
    })
    .superRefine((input, ctx) => {
        if (input.decision === "ELIGIBLE_WITH_RESTRICTIONS" && !limitsSomething(toLists(input.lists)) && !input.restrictionNotes) {
            ctx.addIssue({ code: "custom", path: ["restrictions"], message: "Đặt ít nhất một giới hạn hoặc ghi hạn chế trong ghi chú." });
        }
        if (input.validUntil && isDateTimeInputValue(input.examinedAt) && input.validUntil <= input.examinedAt.slice(0, 10)) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Quyết định phải còn hiệu lực sau ngày khám." });
        }
        if (input.type === "baseline" && input.assessments.length === 0) {
            ctx.addIssue({ code: "custom", path: ["assessments"], message: "Khám nền cần ít nhất một vùng được đánh giá." });
        }
        checkFollowUpDate(input.followUpDate, input.examinedAt, ctx);
    });

/** Vitals go together: a baseline needs them, any other examination sends them only when some were entered. */
const vitalsSchema = z.object(VITAL_FIELDS).superRefine(checkBloodPressure);

const EXAMINATION_FIELDS: MedicalWriteErrorOptions = {
    fields: {
        scope: "scope",
        decision: "decision",
        examinedAt: "examinedAt",
        reason: "reason",
        validUntil: "validUntil",
        supersedesId: "supersedesId",
        reviewRequestIds: "reviewRequestIds",
        examinationType: "type",
        ...Object.fromEntries(Object.keys(VITAL_FIELDS).map((key) => [`vitals.${key}`, key])),
        vitals: "weightKg",
        assessments: "assessments",
        recommendations: "recommendations",
        followUpDate: "followUpDate",
        scat6: "scat6",
        ...RESTRICTION_FIELDS,
    },
    conflictFields: { EXAMINATION_CORRECTION_CONFLICT: "supersedesId", REVIEW_REQUEST_NOT_RESOLVABLE: "reviewRequestIds" },
};

/** A failed write's state with the data the form reacts to (a retry that checks the record first, an existing clearance). */
function withData(message: string, data: MedicalWriteData, fieldErrors?: Record<string, string>): ActionState<MedicalWriteData> {
    return { status: "error", message, fieldErrors, data };
}

const EXAMINATION_UNCONFIRMED = unconfirmedWriteMessages("phiếu khám");
const CLEARANCE_UNCONFIRMED = unconfirmedWriteMessages("giấy phép");

type ExaminationCheck = { found: "saved"; id: string } | { found: "other" } | { found: "none" } | { found: "unchecked" };

/**
 * Reads the fighter's record again to tell whether this examination is already saved: the scope's current examination
 * has the same time, decision and reasoning. A different examination recorded since the form opened is reported too,
 * so nothing is sent twice. Never throws: an unreadable record is "unchecked".
 */
async function findRecordedExamination(fighterId: string, scope: ExaminationScope, attempt: ExaminationAttempt, knownCurrentId: string): Promise<ExaminationCheck> {
    try {
        const current = (await rereadClinicalDossier(fighterId))?.currentExaminations[scope] ?? null;
        if (current && isRecordedAttempt(current, attempt)) return { found: "saved", id: current.id };
        if (current && current.id !== knownCurrentId) return { found: "other" };
        return { found: "none" };
    } catch {
        return { found: "unchecked" };
    }
}

const RECORDED_SINCE =
    "Đã có phiếu khám khác cùng phạm vi được ghi từ khi bạn mở biểu mẫu, có thể là lần thử trước của bạn. Hãy mở hồ sơ võ sĩ để kiểm tra trước khi ghi lại.";

export async function recordExaminationDecisionAction(_prev: ActionState<MedicalWriteData>, formData: FormData): Promise<ActionState<MedicalWriteData>> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("medical:write"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = examinationSchema(t).safeParse({
        fighterId: text(formData, "fighterId"),
        scope: text(formData, "scope"),
        decision: text(formData, "decision"),
        examinedAt: text(formData, "examinedAt"),
        reason: text(formData, "reason"),
        lists: restrictionListsFrom(formData),
        restrictionNotes: text(formData, "restrictionNotes"),
        validUntil: text(formData, "validUntil"),
        supersedesId: checked(formData, "correction") ? text(formData, "supersedesId") : "",
        reviewRequestIds: texts(formData, "reviewRequestIds"),
        type: text(formData, "type"),
        assessments: text(formData, "assessments"),
        recommendations: text(formData, "recommendations"),
        followUpDate: text(formData, "followUpDate"),
    });
    const baseline = text(formData, "type") === "baseline";
    const rawVitals = readVitals(formData);
    const vitals = baseline || !allBlank(rawVitals) ? vitalsSchema.safeParse(rawVitals) : undefined;
    const scat6 = baseline ? scat6Field.safeParse(text(formData, "scat6")) : undefined;
    if (!parsed.success || vitals?.success === false || scat6?.success === false) {
        return restrictionFormError(new z.ZodError([...issuesOf(parsed), ...issuesOf(vitals), ...friendlyScat6Issues(scat6Issues(scat6))]));
    }
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    const examinedAt = wallClockIso(input.examinedAt);
    if (isInFuture(examinedAt)) return actionError(FIX_FIELDS, { examinedAt: "Thời điểm khám không thể ở tương lai." });

    const attempt: ExaminationAttempt = { decision: input.decision, examinedAt, reason: input.reason };
    const knownCurrentId = text(formData, "knownCurrentId");
    let examinationId: string | null = null;

    // After a write the service didn't confirm, the record is read before anything is sent again.
    if (text(formData, RECONCILE_FIELD) === "1") {
        const check = await findRecordedExamination(input.fighterId, input.scope, attempt, knownCurrentId);
        if (check.found === "saved") examinationId = check.id;
        else if (check.found === "other") return actionError(RECORDED_SINCE);
        else if (check.found === "unchecked") return withData(EXAMINATION_UNCONFIRMED.unchecked, { unconfirmed: true });
    }

    if (examinationId === null) {
        try {
            const exam = await recordExaminationDecision(input.fighterId, {
                scope: input.scope,
                decision: input.decision,
                examinedAt,
                reason: input.reason,
                restrictions: { ...toLists(input.lists), notes: input.restrictionNotes || null },
                validUntil: input.validUntil ? academyWallClockToIso(input.validUntil, "23:59") : null,
                supersedesId: input.supersedesId || null,
                reviewRequestIds: input.reviewRequestIds,
                details: {
                    type: input.type,
                    vitals: vitals?.success ? toVitals(vitals.data) : null,
                    assessments: input.assessments,
                    recommendations: input.recommendations || null,
                    followUpDate: input.followUpDate || null,
                    scat6: scat6?.success ? scat6.data : null,
                },
            });
            examinationId = exam.id;
        } catch (error) {
            if (!isUnconfirmedWrite(error)) return failed(error, EXAMINATION_FIELDS);
            // The service may have saved it: read the record before telling the doctor anything.
            const check = await findRecordedExamination(input.fighterId, input.scope, attempt, knownCurrentId);
            if (check.found === "other") return actionError(RECORDED_SINCE);
            if (check.found !== "saved") return withData(check.found === "none" ? EXAMINATION_UNCONFIRMED.notFound : EXAMINATION_UNCONFIRMED.unchecked, { unconfirmed: true });
            examinationId = check.id;
        }
    }

    revalidateClinical();
    // A positive decision still needs a clearance before the fighter can train: go straight to issuing it.
    if (input.decision === "NOT_ELIGIBLE") redirect(hrefWith(routes.doctor.fighter(input.fighterId), {}, { notice: "examination-not-eligible" }));
    redirect(hrefWith(routes.doctor.grantClearance, {}, { fighter: input.fighterId, exam: examinationId, notice: "examination-recorded" }));
}

/* ─── Clearances ──────────────────────────────────────────────────────────── */

const clearanceSchema = (t?: Translator) =>
    z
    .object({
        fighterId: required("Hãy chọn võ sĩ được cấp giấy phép."),
        examinationId: required("Hãy chọn phiếu khám làm căn cứ cấp giấy phép."),
        clearanceType: z.enum(CLEARANCE_TYPES, { error: "Choose the type of clearance." }),
        validFrom: optionalDate("Hãy nhập ngày bắt đầu hợp lệ, hoặc để trống để bắt đầu ngay."),
        validUntil: optionalDate("Hãy nhập ngày kết thúc hợp lệ, hoặc để trống để theo phiếu khám."),
        lists: restrictionListsSchema,
        notes: boundedText("notes", MEDICAL_TEXT_LIMITS.clearanceNotes, 0, "", t),
    })
    .superRefine((input, ctx) => {
        if (input.validFrom && input.validUntil && input.validUntil <= input.validFrom) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Giấy phép phải kết thúc sau ngày bắt đầu." });
        }
    });

const CLEARANCE_FIELDS: MedicalWriteErrorOptions = {
    fields: { examinationId: "examinationId", clearanceType: "clearanceType", validFrom: "validFrom", validUntil: "validUntil", notes: "notes", ...RESTRICTION_FIELDS },
    conflictFields: { EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE: "examinationId", MEDICAL_RECORD_CONFLICT: "clearanceType" },
};

/** The clearance from this examination with this type that isn't revoked, read fresh; undefined when the record can't be read. */
async function findIssuedClearance(fighterId: string, examinationId: string, clearanceType: ClearanceType): Promise<MedicalClearance | null | undefined> {
    try {
        const dossier = await rereadClinicalDossier(fighterId);
        return dossier ? clearanceFromExamination(dossier.activeClearances, examinationId, clearanceType) : null;
    } catch {
        return undefined;
    }
}

/** "Already issued": the existing clearance, so the form can show it instead of issuing a duplicate. */
function alreadyIssued(clearance: MedicalClearance, clearanceType: ClearanceType): ActionState<MedicalWriteData> {
    return withData(
        `Giấy phép ${CLEARANCE_TYPE_LABELS[clearanceType].toLowerCase()} từ phiếu khám này đã có hiệu lực nên không cấp mới.`,
        { existingClearance: { id: clearance.id, clearanceType, issuedAt: clearance.issuedAt, validUntil: clearance.validUntil } },
        { clearanceType: "Đã cấp từ phiếu khám này." },
    );
}

export async function issueClearanceAction(_prev: ActionState<MedicalWriteData>, formData: FormData): Promise<ActionState<MedicalWriteData>> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("clearance:manage"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = clearanceSchema(t).safeParse({
        fighterId: text(formData, "fighterId"),
        examinationId: text(formData, "examinationId"),
        clearanceType: text(formData, "clearanceType"),
        validFrom: text(formData, "validFrom"),
        validUntil: text(formData, "validUntil"),
        lists: restrictionListsFrom(formData),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return restrictionFormError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    // Check the rules the service applies, so the doctor sees which field to change instead of a bare refusal.
    let dossier: Awaited<ReturnType<typeof getClinicalDossier>>;
    try {
        dossier = await getClinicalDossier(input.fighterId);
    } catch {
        return withData("Dịch vụ y tế không phản hồi nên chưa cấp gì. Lựa chọn của bạn vẫn được giữ: hãy thử lại sau giây lát.", {});
    }
    const exam = dossier ? Object.values(dossier.currentExaminations).find((current) => current?.id === input.examinationId) : null;
    if (!exam || exam.decision === "NOT_ELIGIBLE") {
        return actionError("Giấy phép chỉ được cấp từ phiếu khám đạt hiện hành của võ sĩ. Hãy tải lại trang và chọn lại.", {
            examinationId: "Hãy chọn phiếu khám hiện hành.",
        });
    }
    if (!CLEARANCE_TYPES_BY_SCOPE[exam.scope].includes(input.clearanceType)) {
        return actionError(FIX_FIELDS, { clearanceType: "Phiếu khám này không làm căn cứ cho loại giấy phép đó được." });
    }
    const lists = toLists(input.lists);
    const examLists: RestrictionLists = exam.restrictions ?? { allowedSessionTypes: null, allowedTechniqueTypes: null, excludedJoints: null };
    const widened = widenedLists(examLists, lists);
    if (widened.length > 0) {
        return actionError(
            "Giấy phép chỉ có thể thu hẹp những gì phiếu khám cho phép.",
            Object.fromEntries(widened.map((name) => [name, name === "excludedJoints" ? "Phải tránh ít nhất các khớp phiếu khám đã loại trừ." : "Chỉ cho phép những gì phiếu khám cho phép."])),
        );
    }
    // Starting on the examination day means starting once the examination was done.
    const validFrom = !input.validFrom ? null : input.validFrom === dayKey(exam.examinedAt) ? maxIso(dayIso(input.validFrom), exam.examinedAt) : dayIso(input.validFrom);
    if (validFrom && validFrom < exam.examinedAt) return actionError(FIX_FIELDS, { validFrom: "Giấy phép không thể bắt đầu trước ngày khám." });
    const validUntil = input.validUntil ? academyWallClockToIso(input.validUntil, "23:59") : null;
    if (validUntil && exam.validUntil && validUntil > exam.validUntil) {
        return actionError(FIX_FIELDS, { validUntil: "Giấy phép không thể kéo dài hơn quyết định của phiếu khám." });
    }

    // One active clearance per examination and type. After a write the service didn't confirm, one found here is that
    // write, saved after all; otherwise it was already there and is shown instead of being issued twice.
    const reconciling = text(formData, RECONCILE_FIELD) === "1";
    const existing = reconciling ? await findIssuedClearance(input.fighterId, exam.id, input.clearanceType) : clearanceFromExamination(dossier?.activeClearances ?? [], exam.id, input.clearanceType);
    if (existing === undefined) return withData(CLEARANCE_UNCONFIRMED.unchecked, { unconfirmed: true });
    if (existing && !reconciling) return alreadyIssued(existing, input.clearanceType);

    if (!existing) {
        try {
            await issueClearance(input.fighterId, {
                examinationId: exam.id,
                clearanceType: input.clearanceType,
                validFrom,
                validUntil,
                restrictions: lists,
                notes: input.notes || null,
            });
        } catch (error) {
            const conflict = error instanceof ApiError && error.status === 409 && error.code === "MEDICAL_RECORD_CONFLICT";
            if (!conflict && !isUnconfirmedWrite(error)) return failed(error, CLEARANCE_FIELDS);
            // Only the clearance is retried: the examination it comes from is already saved.
            const found = await findIssuedClearance(input.fighterId, exam.id, input.clearanceType);
            if (conflict) return found ? alreadyIssued(found, input.clearanceType) : failed(error, CLEARANCE_FIELDS);
            if (!found) return withData(found === null ? CLEARANCE_UNCONFIRMED.notFound : CLEARANCE_UNCONFIRMED.unchecked, { unconfirmed: true });
        }
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.fighter(input.fighterId), {}, { notice: "clearance-issued" }));
}

/* ─── Injuries & treatments ───────────────────────────────────────────────── */

const injurySchema = (t?: Translator) =>
    z.object({
    fighterId: required("Hãy chọn võ sĩ bị chấn thương."),
    affectedJoint: z.enum(BODY_JOINTS, { error: "Choose the affected joint." }),
    injuryType: boundedText("loại chấn thương", MEDICAL_TEXT_LIMITS.injuryType, 2, "Hãy ghi tên chấn thương, VD “Bong gân cổ chân ngoài”.", t),
    severity: z.enum(API_INJURY_SEVERITIES, { error: "Choose a severity." }),
    occurredAt: z.string().refine(isDateTimeInputValue, "Hãy nhập ngày giờ xảy ra chấn thương."),
    description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
});

export async function recordInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("medical:write"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = injurySchema(t).safeParse({
        fighterId: text(formData, "fighterId"),
        affectedJoint: text(formData, "affectedJoint"),
        injuryType: text(formData, "injuryType"),
        severity: text(formData, "severity"),
        occurredAt: text(formData, "occurredAt"),
        description: text(formData, "description"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    const occurredAt = wallClockIso(input.occurredAt);
    if (isInFuture(occurredAt)) return actionError(FIX_FIELDS, { occurredAt: "Thời điểm chấn thương không thể ở tương lai." });

    let injuryId: string;
    try {
        const injury = await recordInjury(input.fighterId, {
            affectedJoint: input.affectedJoint,
            injuryType: input.injuryType,
            severity: input.severity,
            occurredAt,
            description: input.description || null,
        });
        injuryId = injury.id;
    } catch (error) {
        return failed(error, { fields: { affectedJoint: "affectedJoint", injuryType: "injuryType", severity: "severity", occurredAt: "occurredAt", description: "description" } });
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.injury(injuryId), {}, { created: "1" }));
}

const treatmentSchema = (t?: Translator) =>
    z
    .object({
        injuryId: required("Thiếu thông tin chấn thương. Hãy tải lại trang và thử lại."),
        fighterId: required("Thiếu thông tin võ sĩ. Hãy tải lại trang và thử lại."),
        treatmentType: boundedText("treatment", MEDICAL_TEXT_LIMITS.treatmentType, 2, "Hãy ghi tên điều trị, VD “Vật lý trị liệu”.", t),
        treatmentDate: z.string().refine(isDateKey, "Hãy nhập ngày điều trị."),
        description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
        outcomeNotes: boundedText("ghi chú kết quả", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
        nextReviewAt: optionalDate("Hãy nhập ngày đánh giá lại hợp lệ, hoặc để trống."),
    })
    .superRefine((input, ctx) => {
        if (input.nextReviewAt && isDateKey(input.treatmentDate) && input.nextReviewAt < input.treatmentDate) {
            ctx.addIssue({ code: "custom", path: ["nextReviewAt"], message: "Ngày đánh giá lại không thể trước ngày điều trị." });
        }
    });

export async function recordTreatmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("medical:write"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = treatmentSchema(t).safeParse({
        injuryId: text(formData, "injuryId"),
        fighterId: text(formData, "fighterId"),
        treatmentType: text(formData, "treatmentType"),
        treatmentDate: text(formData, "treatmentDate"),
        description: text(formData, "description"),
        outcomeNotes: text(formData, "outcomeNotes"),
        nextReviewAt: text(formData, "nextReviewAt"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);
    if (input.treatmentDate > dayKey(new Date())) return actionError(FIX_FIELDS, { treatmentDate: "Ngày điều trị không thể ở tương lai." });

    try {
        await recordTreatment(
            { id: input.injuryId, fighterId: input.fighterId },
            {
                treatmentType: input.treatmentType,
                treatmentDate: dayIso(input.treatmentDate),
                description: input.description || null,
                outcomeNotes: input.outcomeNotes || null,
                nextReviewAt: input.nextReviewAt ? academyWallClockToIso(input.nextReviewAt, "09:00") : null,
            },
        );
    } catch (error) {
        return failed(error, {
            fields: { treatmentType: "treatmentType", treatmentDate: "treatmentDate", description: "description", outcomeNotes: "outcomeNotes", nextReviewAt: "nextReviewAt" },
        });
    }

    revalidateClinical();
    return actionSuccess(`Đã ghi ${input.treatmentType}. Điều trị không thể sửa sau, hãy thêm điều trị mới nếu có thay đổi.`);
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

const milestoneSchema = (t?: Translator) =>
    z.object({
    title: boundedText("milestone", MEDICAL_TEXT_LIMITS.planTitle, 2, "Hãy đặt tên mốc.", t),
    criteria: boundedText("criteria", MEDICAL_TEXT_LIMITS.clinicalText, 3, "Hãy ghi tiêu chí đạt.", t),
    targetDate: optionalDate("Hãy nhập ngày mục tiêu hợp lệ, hoặc để trống."),
    notes: boundedText("notes", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
});

const milestoneList = (t?: Translator) => jsonArray(milestoneSchema(t), "milestones", { max: RECOVERY_MILESTONES_MAX, maxMessage: `Tối đa ${RECOVERY_MILESTONES_MAX} mốc.` });

const recoveryPlanSchema = (t?: Translator) =>
    z
    .object({
        fighterId: required("Thiếu thông tin võ sĩ. Hãy tải lại trang và thử lại."),
        injuryId: required("Hãy chọn chấn thương cho kế hoạch."),
        title: boundedText("title", MEDICAL_TEXT_LIMITS.planTitle, 3, "Hãy đặt tên ngắn cho kế hoạch.", t),
        description: boundedText("description", MEDICAL_TEXT_LIMITS.clinicalText, 0, "", t),
        startDate: z.string().refine(isDateKey, "Hãy nhập ngày bắt đầu kế hoạch."),
        estimatedEndDate: optionalDate("Hãy nhập ngày kết thúc hợp lệ, hoặc để trống."),
        milestones: milestoneList(t),
    })
    .superRefine((plan, ctx) => {
        if (plan.estimatedEndDate && isDateKey(plan.startDate) && plan.estimatedEndDate < plan.startDate) {
            ctx.addIssue({ code: "custom", path: ["estimatedEndDate"], message: "Kế hoạch không thể kết thúc trước khi bắt đầu." });
        }
    });

const toDraft = (milestone: z.output<ReturnType<typeof milestoneSchema>>): MilestoneDraft => ({
    title: milestone.title,
    criteria: milestone.criteria,
    targetDate: milestone.targetDate || null,
    notes: milestone.notes || null,
    isCompleted: false,
});

const PLAN_FIELDS: Record<string, string> = {
    injuryId: "injuryId",
    title: "title",
    description: "description",
    startDate: "startDate",
    estimatedEndDate: "estimatedEndDate",
    milestones: "milestones",
};

export async function createMilestonePlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("medical:write"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);

    const parsed = recoveryPlanSchema(t).safeParse({
        fighterId: text(formData, "fighterId"),
        injuryId: text(formData, "injuryId"),
        title: text(formData, "title"),
        description: text(formData, "description"),
        startDate: text(formData, "startDate"),
        estimatedEndDate: text(formData, "estimatedEndDate"),
        milestones: text(formData, "milestones"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);

    let planId: string;
    try {
        const plan = await createMilestonePlan(input.fighterId, {
            injuryId: input.injuryId,
            title: input.title,
            description: input.description || null,
            startDate: input.startDate,
            estimatedEndDate: input.estimatedEndDate || null,
            milestones: input.milestones.map(toDraft),
        });
        planId = plan.id;
    } catch (error) {
        return failed(error, { fields: PLAN_FIELDS, conflictFields: { RECOVERY_PLAN_DATE_CONFLICT: "estimatedEndDate" } });
    }

    revalidateClinical();
    redirect(hrefWith(routes.doctor.recoveryPlan(planId), {}, { created: "1" }));
}

/** The plan as the service has it now, so a change is applied to fresh milestones rather than to a stale page. */
async function currentPlan(fighterId: string, planId: string) {
    return (await listRecoveryPlans({ fighterIds: [fighterId] })).find((plan) => plan.id === planId) ?? null;
}

const planRefSchema = z.object({ fighterId: z.string().min(1), planId: z.string().min(1) });

/** Ticks or unticks one milestone. The service replaces the whole list, so every other milestone is sent unchanged. */
export async function setPlanMilestoneAction(input: { fighterId: string; planId: string; milestoneId: string; done: boolean }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    const parsed = planRefSchema.extend({ milestoneId: z.string().min(1), done: z.boolean() }).safeParse(input);
    if (!parsed.success) return actionError("Không đọc được mốc. Hãy tải lại trang và thử lại.");
    const { fighterId, planId, milestoneId, done } = parsed.data;
    if (!canAccessFighterClinically(auth.user, fighterId)) return actionError(NOT_ASSIGNED);

    try {
        const plan = await currentPlan(fighterId, planId);
        if (!plan?.milestones) return actionError("Không thể đổi mốc của kế hoạch này tại đây. Hãy tải lại trang và thử lại.");
        if (!plan.milestones.some((milestone) => milestone.id === milestoneId)) return actionError("Mốc này không còn tồn tại. Hãy tải lại trang.");
        const drafts = milestoneDrafts(plan.milestones).map((draft) => (draft.id === milestoneId ? { ...draft, isCompleted: done } : draft));
        await updateMilestonePlan(planId, { milestones: drafts });
    } catch (error) {
        return failed(error);
    }

    revalidateClinical();
    return actionSuccess(done ? "Đã đánh dấu mốc đạt." : "Đã bỏ đánh dấu mốc.");
}

/** Adds a milestone to the end of the plan. */
export async function addPlanMilestoneAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const [auth, { t }] = await Promise.all([authorizeClinicalAction("medical:write"), getTranslator()]);
    if (!auth.ok) return actionError(auth.message);
    const ref = planRefSchema.safeParse({ fighterId: text(formData, "fighterId"), planId: text(formData, "planId") });
    if (!ref.success) return actionError("Thiếu kế hoạch phục hồi. Hãy tải lại trang và thử lại.");
    const parsed = milestoneSchema(t).safeParse({
        title: text(formData, "title"),
        criteria: text(formData, "criteria"),
        targetDate: text(formData, "targetDate"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const { fighterId, planId } = ref.data;
    if (!canAccessFighterClinically(auth.user, fighterId)) return actionError(NOT_ASSIGNED);

    try {
        const plan = await currentPlan(fighterId, planId);
        if (!plan?.milestones) return actionError("Không thể đổi mốc của kế hoạch này tại đây. Hãy tải lại trang và thử lại.");
        if (plan.milestones.length >= RECOVERY_MILESTONES_MAX) return actionError(`Mỗi kế hoạch tối đa ${RECOVERY_MILESTONES_MAX} mốc.`);
        await updateMilestonePlan(planId, { milestones: [...milestoneDrafts(plan.milestones), toDraft(parsed.data)] });
    } catch (error) {
        return failed(error, { fields: { "milestones.0.title": "title", "milestones.0.criteria": "criteria" } });
    }

    revalidateClinical();
    return actionSuccess(`Đã thêm mốc “${parsed.data.title}”.`);
}

const CLOSE_MESSAGES = {
    COMPLETED: "Đã hoàn tất kế hoạch phục hồi. Hãy xem lại chấn thương và giấy phép — hoàn tất kế hoạch không có nghĩa võ sĩ được tập.",
    CANCELLED: "Đã hủy kế hoạch phục hồi.",
} as const;

/** Completes or cancels an active plan. Neither clears the fighter to train. */
export async function closeRecoveryPlanAction(input: { fighterId: string; planId: string; status: "COMPLETED" | "CANCELLED" }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    const parsed = planRefSchema.extend({ status: z.enum(["COMPLETED", "CANCELLED"]) }).safeParse(input);
    if (!parsed.success) return actionError("Thiếu kế hoạch phục hồi. Hãy tải lại trang và thử lại.");
    if (!canAccessFighterClinically(auth.user, parsed.data.fighterId)) return actionError(NOT_ASSIGNED);

    try {
        await updateMilestonePlan(parsed.data.planId, { status: parsed.data.status });
    } catch (error) {
        return failed(error);
    }

    revalidateClinical();
    return actionSuccess(CLOSE_MESSAGES[parsed.data.status]);
}
