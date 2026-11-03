"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { accessibleFighterIds, canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeClinicalAction } from "@/lib/auth/session";
import {
    BODY_REGION_LABELS,
    CLEARANCE_LEVEL_LABELS,
    EXAMINATION_OUTCOME_LABELS,
    HEALTH_STATUS_LABELS,
    TECHNIQUES,
    TRAINING_TYPE_LABELS,
} from "@/lib/domain/labels";
import { friendlyScat6Issues } from "@/lib/domain/medical-scat6";
import { academyWallClockToIso, daysBetween, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
    createExamination,
    grantClearance,
    listClearances,
    revokeClearance,
    updateHealthStatus,
    updateMedicalRecord,
} from "@/lib/services/medical";
import { medicalWriteFailure } from "@/lib/services/medical-errors";
import { FEATURE_UNAVAILABLE_MESSAGE, medicalFeatureAvailable } from "@/lib/services/medical-features";
import { assessmentSchema, checkBloodPressure, checkFollowUpDate, EXAMINATION_TYPES, issuesOf, readVitals, scat6Field, scat6Issues, toVitals, VITAL_FIELDS } from "./examination-fields";
import { NOT_ASSIGNED, isInFuture, jsonArray, keysOf, text } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

const MAX_CLEARANCE_DAYS = 365;

function revalidateDoctorArea() {
    revalidatePath("/doctor", "layout");
}

/* ─── Medical record ──────────────────────────────────────────────────────── */

const lineList = (label: string) =>
    z
        .string()
        .transform((value) =>
            value
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean),
        )
        .pipe(z.array(z.string().max(200, `Mỗi ${label} tối đa 200 ký tự.`)).max(30, `Tối đa 30 ${label}.`));

const currentYear = new Date().getUTCFullYear();

const medicalRecordSchema = z.object({
    fighterId: z.string().min(1, "Thiếu thông tin võ sĩ. Hãy tải lại trang và thử lại."),
    bloodType: z.string().trim().min(1, "Hãy chọn nhóm máu, hoặc “Chưa ghi nhận”.").max(20),
    allergies: lineList("allergy"),
    chronicConditions: lineList("condition"),
    medications: lineList("medication"),
    surgicalHistory: jsonArray(
        z.object({
            year: z
                .number({ error: "Hãy nhập năm thực hiện thủ thuật." })
                .int("Hãy nhập năm gồm bốn chữ số.")
                .min(1950, "Hãy nhập năm từ 1950 trở đi.")
                .max(currentYear, "Năm không thể ở tương lai."),
            procedure: z.string().trim().min(1, "Hãy mô tả thủ thuật.").max(200, "Thủ thuật tối đa 200 ký tự."),
        }),
        "tiền sử phẫu thuật",
    ),
    emergencyName: z.string().trim().max(120, "Tên tối đa 120 ký tự."),
    emergencyRelation: z.string().trim().max(60, "Quan hệ tối đa 60 ký tự."),
    emergencyPhone: z
        .string()
        .trim()
        .max(40, "Số điện thoại tối đa 40 ký tự.")
        .refine((value) => value === "" || /^\+?[\d\s().-]{6,}$/.test(value), "Hãy nhập số điện thoại gồm chữ số, khoảng trắng và dấu + ở đầu (nếu có)."),
    notes: z.string().trim().max(3000, "Ghi chú lâm sàng tối đa 3.000 ký tự."),
});

export async function updateMedicalRecordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("medicalRecord")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = medicalRecordSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        bloodType: text(formData, "bloodType"),
        allergies: text(formData, "allergies"),
        chronicConditions: text(formData, "chronicConditions"),
        medications: text(formData, "medications"),
        surgicalHistory: text(formData, "surgicalHistory"),
        emergencyName: text(formData, "emergencyName"),
        emergencyRelation: text(formData, "emergencyRelation"),
        emergencyPhone: text(formData, "emergencyPhone"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await updateMedicalRecord(
        input.fighterId,
        {
            bloodType: input.bloodType,
            allergies: input.allergies,
            chronicConditions: input.chronicConditions,
            medications: input.medications,
            surgicalHistory: [...input.surgicalHistory].sort((a, b) => a.year - b.year),
            emergencyContact: { name: input.emergencyName, relation: input.emergencyRelation, phone: input.emergencyPhone },
            notes: input.notes,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    return actionSuccess("Đã lưu bệnh án.");
}

/* ─── Examinations ────────────────────────────────────────────────────────── */

const examinationSchema = z
    .object({
        fighterId: z.string().min(1, "Hãy chọn võ sĩ đã khám."),
        type: z.enum(EXAMINATION_TYPES, { error: "Choose the examination type." }),
        date: z.string().refine(isDateTimeInputValue, "Hãy nhập ngày giờ khám."),
        ...VITAL_FIELDS,
        assessments: jsonArray(assessmentSchema, "assessments", { min: 1, minMessage: "Hãy thêm ít nhất một đánh giá." }),
        outcome: z.enum(keysOf(EXAMINATION_OUTCOME_LABELS), { error: "Choose the examination outcome." }),
        summary: z.string().trim().min(10, "Hãy tóm tắt kết quả trong một hai câu.").max(3000, "Tóm tắt tối đa 3.000 ký tự."),
        recommendations: z
            .string()
            .trim()
            .min(1, "Hãy thêm khuyến nghị — ví dụ hướng dẫn tập luyện hoặc bước tiếp theo.")
            .max(3000, "Khuyến nghị tối đa 3.000 ký tự."),
        followUpDate: z.string().trim().refine((value) => value === "" || isDateKey(value), "Hãy nhập ngày tái khám hợp lệ."),
    })
    .superRefine((exam, ctx) => {
        checkBloodPressure(exam, ctx);
        checkFollowUpDate(exam.followUpDate, exam.date, ctx);
    });

export async function createExaminationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = examinationSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        type: text(formData, "type"),
        date: text(formData, "date"),
        ...readVitals(formData),
        assessments: text(formData, "assessments"),
        outcome: text(formData, "outcome"),
        summary: text(formData, "summary"),
        recommendations: text(formData, "recommendations"),
        followUpDate: text(formData, "followUpDate"),
    });
    const scat6 = text(formData, "type") === "baseline" ? scat6Field.safeParse(text(formData, "scat6")) : undefined;
    if (!parsed.success || scat6?.success === false) return validationError(new z.ZodError([...issuesOf(parsed), ...friendlyScat6Issues(scat6Issues(scat6))]));
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    const [day, time] = input.date.split("T");
    const examinedAt = academyWallClockToIso(day, time);
    if (isInFuture(examinedAt)) {
        return actionError(FIX_FIELDS, { date: "Thời điểm khám không thể ở tương lai." });
    }

    const result = await createExamination(
        {
            fighterId: input.fighterId,
            date: examinedAt,
            type: input.type,
            vitals: toVitals(input),
            assessments: input.assessments,
            outcome: input.outcome,
            summary: input.summary,
            recommendations: input.recommendations,
            followUpDate: input.followUpDate ? academyWallClockToIso(input.followUpDate, "10:00") : null,
            scat6: scat6?.success ? scat6.data : null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    redirect(`${routes.doctor.examination(result.data.id)}?notice=examination-recorded`);
}

/* ─── Medical Clearance ───────────────────────────────────────────────────── */

const restrictionSchema = z.object({
    label: z.string().trim().min(1, "Hãy đặt nội dung hạn chế mà HLV dễ hiểu.").max(140, "Nội dung tối đa 140 ký tự."),
    blockedTrainingTypes: z.array(z.enum(keysOf(TRAINING_TYPE_LABELS))).max(8),
    blockedTechniques: z.array(z.enum(TECHNIQUES)).max(8),
    blockedRegions: z.array(z.enum(keysOf(BODY_REGION_LABELS))).max(21),
    maxRpe: z.number().int().min(1, "RPE tối đa phải từ 1 đến 10.").max(10, "RPE tối đa phải từ 1 đến 10.").nullable(),
});

const grantClearanceSchema = z
    .object({
        fighterId: z.string().min(1, "Hãy chọn võ sĩ được cấp giấy phép."),
        level: z.enum(keysOf(CLEARANCE_LEVEL_LABELS), { error: "Choose a clearance level." }),
        validUntil: z.string().trim(),
        reason: z
            .string()
            .trim()
            .min(10, "Hãy ghi lý do lâm sàng cho quyết định trong một hai câu.")
            .max(2000, "Lý do tối đa 2.000 ký tự."),
        examinationId: z.string().trim(),
        restrictions: jsonArray(restrictionSchema, "restrictions"),
        confirmNotCleared: z.string(),
    })
    .superRefine((input, ctx) => {
        if (input.level !== "not_cleared" && !isDateKey(input.validUntil)) {
            ctx.addIssue({ code: "custom", path: ["validUntil"], message: "Hãy chọn ngày giấy phép hết hiệu lực." });
        }
        if (input.level === "restricted" && input.restrictions.length === 0) {
            ctx.addIssue({ code: "custom", path: ["restrictions"], message: "Hãy thêm ít nhất một hạn chế, hoặc chọn được tập đầy đủ." });
        }
    });

export async function grantClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = grantClearanceSchema.safeParse({
        fighterId: text(formData, "fighterId"),
        level: text(formData, "level"),
        validUntil: text(formData, "validUntil"),
        reason: text(formData, "reason"),
        examinationId: text(formData, "examinationId"),
        restrictions: text(formData, "restrictions"),
        confirmNotCleared: text(formData, "confirmNotCleared"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    if (input.level === "not_cleared" && input.confirmNotCleared !== "yes") {
        return actionError("Hãy xác nhận võ sĩ phải dừng tập trước khi đặt là chưa được tập.");
    }

    let validUntil: string | null = null;
    if (input.level !== "not_cleared") {
        const days = daysBetween(new Date(), `${input.validUntil}T12:00:00Z`);
        if (days < 0) return actionError(FIX_FIELDS, { validUntil: "Ngày hiệu lực không thể ở quá khứ." });
        if (days > MAX_CLEARANCE_DAYS) {
            return actionError(FIX_FIELDS, { validUntil: "Chỉ cấp giấy phép tối đa 12 tháng, sau đó khám lại." });
        }
        validUntil = academyWallClockToIso(input.validUntil, "23:59");
    }

    const result = await grantClearance(
        {
            fighterId: input.fighterId,
            level: input.level,
            validUntil,
            reason: input.reason,
            restrictions: input.level === "restricted" ? input.restrictions : [],
            examinationId: input.examinationId || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    redirect(`${routes.doctor.fighter(input.fighterId)}?notice=clearance-${input.level}`);
}

const revokeSchema = z.object({
    clearanceId: z.string().min(1, "Thiếu giấy phép. Hãy tải lại trang và thử lại."),
    fighterId: z.string(),
    reason: z
        .string()
        .trim()
        .min(10, "Hãy giải thích lý do thu hồi giấy phép trong một hai câu.")
        .max(1000, "Lý do tối đa 1.000 ký tự."),
});

export async function revokeClearanceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("clearance:manage");
    if (!auth.ok) return actionError(auth.message);

    const parsed = revokeSchema.safeParse({ clearanceId: text(formData, "clearanceId"), fighterId: text(formData, "fighterId"), reason: text(formData, "reason") });
    if (!parsed.success) return validationError(parsed.error);

    // Look in the one fighter's clearances when the page says whose it is: in API mode every fighter read is audited.
    const scope = parsed.data.fighterId ? [parsed.data.fighterId] : accessibleFighterIds(auth.user);
    const clearance = (await listClearances({ fighterIds: scope })).find((c) => c.id === parsed.data.clearanceId);
    if (!clearance || !canAccessFighterClinically(auth.user, clearance.fighterId)) {
        return actionError("Không truy cập được giấy phép này. Có thể nó thuộc võ sĩ bạn không phụ trách.");
    }

    try {
        const result = await revokeClearance(clearance.id, parsed.data.reason, auth.user);
        if (!result.ok) return actionError(result.error);
    } catch (error) {
        const failure = medicalWriteFailure(error, { fields: { revokedReason: "reason" } });
        return actionError(failure.message, failure.fieldErrors);
    }

    revalidateDoctorArea();
    return actionSuccess("Đã thu hồi giấy phép. Võ sĩ hiện chưa được tập và HLV đã được thông báo.");
}

/* ─── Health status ───────────────────────────────────────────────────────── */

const healthStatusSchema = z.object({
    fighterId: z.string().min(1, "Thiếu thông tin võ sĩ. Hãy tải lại trang và thử lại."),
    status: z.enum(keysOf(HEALTH_STATUS_LABELS), { error: "Choose a health status." }),
});

export async function updateHealthStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("healthStatusOverride")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = healthStatusSchema.safeParse({ fighterId: text(formData, "fighterId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);
    if (!canAccessFighterClinically(auth.user, parsed.data.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await updateHealthStatus(parsed.data.fighterId, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateDoctorArea();
    return actionSuccess(`Đã đặt tình trạng sức khỏe: ${HEALTH_STATUS_LABELS[result.data.healthStatus]}.`);
}
