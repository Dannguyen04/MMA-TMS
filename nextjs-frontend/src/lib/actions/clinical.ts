"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighterClinically } from "@/lib/auth/access";
import { authorizeClinicalAction } from "@/lib/auth/session";
import { BODY_REGION_LABELS, INJURY_MECHANISM_LABELS, INJURY_SEVERITY_LABELS, INJURY_STATUS_LABELS, INJURY_TYPE_LABELS, TREATMENT_STATUS_LABELS, TREATMENT_TYPE_LABELS, treatmentTitle } from "@/lib/domain/labels";
import type { InjuryStatus } from "@/lib/domain/types";
import { academyWallClockToIso, dayKey, isDateKey, isDateTimeInputValue } from "@/lib/format";
import { routes } from "@/lib/routes";
import { getAlertDetail, reviewAlert } from "@/lib/services/ai";
import {
    addRecoveryCheckIn,
    addTreatment,
    advanceRecoveryPhase,
    createInjury,
    createRecoveryPlan,
    getInjury,
    getInjuryDetail,
    getRecoveryPlan,
    listInjuries,
    setMilestone,
    updateInjury,
    updateTreatmentStatus,
} from "@/lib/services/medical";
import { medicalWriteFailure } from "@/lib/services/medical-errors";
import { FEATURE_UNAVAILABLE_MESSAGE, medicalFeatureAvailable } from "@/lib/services/medical-features";
import { NOT_ASSIGNED, isInFuture, jsonArray, keysOf, optionalDate, revalidateClinical, text } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, type ActionState } from "./state";

/* ─── Parsing helpers (not exported: a "use server" module may only export actions) ─── */

/** Today's calendar day (YYYY-MM-DD) in the academy timezone. */
function todayKey(): string {
    return dayKey(new Date());
}

/** A whole number posted from a numeric input, within [min, max]. */
function wholeNumber(label: string, min: number, max: number) {
    const range = `${label} phải là số nguyên từ ${min} đến ${max}.`;
    return z
        .string()
        .trim()
        .min(1, `Hãy nhập ${label.toLowerCase()}.`)
        .transform((value) => Number(value))
        .pipe(z.number({ error: range }).int(range).min(min, range).max(max, range));
}


/* ─── Injuries ────────────────────────────────────────────────────────────── */

const createInjurySchema = z
    .object({
        fighterId: z.string().min(1, "Hãy chọn võ sĩ bị chấn thương."),
        type: z.enum(keysOf(INJURY_TYPE_LABELS), { error: "Choose the injury type." }),
        bodyRegion: z.enum(keysOf(BODY_REGION_LABELS), { error: "Choose the body region." }),
        severity: z.enum(keysOf(INJURY_SEVERITY_LABELS), { error: "Choose a severity." }),
        status: z.enum(["active", "recovering"], { error: "Choose the current status." }),
        mechanism: z.enum(keysOf(INJURY_MECHANISM_LABELS), { error: "Choose how the injury happened." }),
        occurredAt: z.string().refine(isDateTimeInputValue, "Hãy nhập ngày giờ xảy ra chấn thương."),
        diagnosedAt: z.string().refine(isDateKey, "Hãy nhập ngày chẩn đoán."),
        expectedReturnAt: optionalDate("Hãy nhập ngày hợp lệ, hoặc để trống nếu chưa ước tính được ngày trở lại."),
        description: z
            .string()
            .trim()
            .min(20, "Hãy mô tả dấu hiệu lâm sàng trong một hai câu.")
            .max(3000, "Mô tả tối đa 3.000 ký tự."),
        linkedAlertId: z.string().trim(),
    })
    .superRefine((input, ctx) => {
        const occurredDay = input.occurredAt.slice(0, 10);
        if (isDateKey(input.diagnosedAt) && input.diagnosedAt < occurredDay) {
            ctx.addIssue({ code: "custom", path: ["diagnosedAt"], message: "Ngày chẩn đoán không thể trước ngày chấn thương." });
        }
        if (input.expectedReturnAt && isDateKey(input.diagnosedAt) && input.expectedReturnAt < input.diagnosedAt) {
            ctx.addIssue({ code: "custom", path: ["expectedReturnAt"], message: "Ngày dự kiến trở lại phải từ ngày chẩn đoán trở đi." });
        }
    });

export async function createInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = createInjurySchema.safeParse({
        fighterId: text(formData, "fighterId"),
        type: text(formData, "type"),
        bodyRegion: text(formData, "bodyRegion"),
        severity: text(formData, "severity"),
        status: text(formData, "status"),
        mechanism: text(formData, "mechanism"),
        occurredAt: text(formData, "occurredAt"),
        diagnosedAt: text(formData, "diagnosedAt"),
        expectedReturnAt: text(formData, "expectedReturnAt"),
        description: text(formData, "description"),
        linkedAlertId: text(formData, "linkedAlertId"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;
    if (!canAccessFighterClinically(auth.user, input.fighterId)) return actionError(NOT_ASSIGNED, { fighterId: "Hãy chọn một võ sĩ bạn phụ trách." });

    const [occurredDay, occurredTime] = input.occurredAt.split("T");
    const occurredAt = academyWallClockToIso(occurredDay, occurredTime);
    if (isInFuture(occurredAt)) {
        return actionError(FIX_FIELDS, { occurredAt: "Thời điểm chấn thương không thể ở tương lai." });
    }
    if (input.diagnosedAt > todayKey()) {
        return actionError(FIX_FIELDS, { diagnosedAt: "Ngày chẩn đoán không thể ở tương lai." });
    }

    if (input.linkedAlertId && medicalFeatureAvailable("aiObservations")) {
        const detail = await getAlertDetail(input.linkedAlertId);
        if (!detail || detail.alert.fighterId !== input.fighterId) {
            return actionError(FIX_FIELDS, { linkedAlertId: "Hãy chọn một quan sát AI của võ sĩ này, hoặc để không liên kết." });
        }
    }

    const diagnosedNoon = input.diagnosedAt === todayKey() ? new Date().toISOString() : academyWallClockToIso(input.diagnosedAt, "12:00");
    const diagnosedAt = diagnosedNoon < occurredAt ? occurredAt : diagnosedNoon;

    const result = await createInjury(
        {
            fighterId: input.fighterId,
            type: input.type,
            bodyRegion: input.bodyRegion,
            severity: input.severity,
            status: input.status,
            mechanism: input.mechanism,
            occurredAt,
            diagnosedAt,
            description: input.description,
            expectedReturnAt: input.expectedReturnAt ? academyWallClockToIso(input.expectedReturnAt, "09:00") : null,
            linkedAlertId: input.linkedAlertId || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    redirect(`${routes.doctor.injury(result.data.id)}?created=1`);
}

const updateInjurySchema = z.object({
    injuryId: z.string().min(1, "Thiếu thông tin chấn thương. Hãy tải lại trang và thử lại."),
    fighterId: z.string(),
    status: z.enum(keysOf(INJURY_STATUS_LABELS), { error: "Choose a status." }),
});

const INJURY_STATUS_MESSAGES: Record<InjuryStatus, string> = {
    active: "Đã chuyển chấn thương sang đang điều trị.",
    recovering: "Đã chuyển chấn thương sang đang phục hồi.",
    resolved: "Chấn thương đã khỏi. Võ sĩ và HLV đã được thông báo.",
};

export async function updateInjuryAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = updateInjurySchema.safeParse({ injuryId: text(formData, "injuryId"), fighterId: text(formData, "fighterId"), status: text(formData, "status") });
    if (!parsed.success) return validationError(parsed.error);

    // Search the one fighter's injuries when the page says whose it is: in API mode every fighter read is audited.
    const injury = parsed.data.fighterId
        ? ((await listInjuries({ fighterIds: [parsed.data.fighterId] })).find((candidate) => candidate.id === parsed.data.injuryId) ?? null)
        : await getInjury(parsed.data.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId)) {
        return actionError("Không truy cập được hồ sơ chấn thương này. Có thể nó thuộc võ sĩ bạn không phụ trách.");
    }
    if (injury.status === parsed.data.status) return actionSuccess(`Chấn thương đã ở trạng thái ${INJURY_STATUS_LABELS[injury.status].toLowerCase()}.`);

    const reopened = injury.status === "resolved";
    let result: Awaited<ReturnType<typeof updateInjury>>;
    try {
        result = await updateInjury(injury.id, { status: parsed.data.status }, auth.user);
    } catch (error) {
        return actionError(medicalWriteFailure(error).message);
    }
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(
        reopened ? `Đã mở lại chấn thương ở trạng thái ${INJURY_STATUS_LABELS[result.data.status].toLowerCase()}.` : INJURY_STATUS_MESSAGES[result.data.status],
    );
}

/* ─── Treatments ──────────────────────────────────────────────────────────── */

const addTreatmentSchema = z
    .object({
        injuryId: z.string().min(1, "Thiếu thông tin chấn thương. Hãy tải lại trang và thử lại."),
        type: z.enum(keysOf(TREATMENT_TYPE_LABELS), { error: "Choose the treatment type." }),
        description: z.string().trim().min(3, "Hãy mô tả điều trị.").max(300, "Mô tả tối đa 300 ký tự."),
        providerName: z.string().trim().min(2, "Hãy nhập nơi thực hiện điều trị.").max(120, "Nơi thực hiện tối đa 120 ký tự."),
        frequency: z.string().trim().min(2, "Hãy nhập tần suất, VD “3 lần/tuần”.").max(120, "Tần suất tối đa 120 ký tự."),
        startDate: z.string().refine(isDateKey, "Hãy nhập ngày bắt đầu."),
        endDate: optionalDate("Hãy nhập ngày kết thúc hợp lệ, hoặc để trống nếu chưa có ngày kết thúc."),
        status: z.enum(keysOf(TREATMENT_STATUS_LABELS), { error: "Choose a status." }),
        notes: z.string().trim().max(1000, "Ghi chú tối đa 1.000 ký tự."),
    })
    .superRefine((input, ctx) => {
        if (input.endDate && isDateKey(input.startDate) && input.endDate < input.startDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ngày kết thúc phải từ ngày bắt đầu trở đi." });
        }
        if (input.status === "completed" && !input.endDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Hãy thêm ngày kết thúc cho điều trị đã hoàn tất." });
        }
        if (input.status === "completed" && input.endDate > todayKey()) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Điều trị đã hoàn tất không thể kết thúc ở tương lai." });
        }
    });

export async function addTreatmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = addTreatmentSchema.safeParse({
        injuryId: text(formData, "injuryId"),
        type: text(formData, "type"),
        description: text(formData, "description"),
        providerName: text(formData, "providerName"),
        frequency: text(formData, "frequency"),
        startDate: text(formData, "startDate"),
        endDate: text(formData, "endDate"),
        status: text(formData, "status"),
        notes: text(formData, "notes"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const injury = await getInjury(input.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await addTreatment(
        {
            injuryId: injury.id,
            type: input.type,
            description: input.description,
            providerName: input.providerName,
            frequency: input.frequency,
            startDate: academyWallClockToIso(input.startDate, "09:00"),
            endDate: input.endDate ? academyWallClockToIso(input.endDate, "18:00") : null,
            status: input.status,
            notes: input.notes || null,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    const added = result.data.status ? ` ở trạng thái ${TREATMENT_STATUS_LABELS[result.data.status].toLowerCase()}` : "";
    return actionSuccess(`Đã thêm ${treatmentTitle(result.data)}${added}.`);
}

const treatmentStatusSchema = z.object({
    injuryId: z.string().min(1),
    treatmentId: z.string().min(1),
    status: z.enum(keysOf(TREATMENT_STATUS_LABELS)),
});

export async function updateTreatmentStatusAction(input: { injuryId: string; treatmentId: string; status: string }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("treatmentStatus")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = treatmentStatusSchema.safeParse(input);
    if (!parsed.success) return actionError("Không đọc được thay đổi trạng thái. Hãy tải lại trang và thử lại.");

    const detail = await getInjuryDetail(parsed.data.injuryId);
    const treatment = detail?.treatments.find((t) => t.id === parsed.data.treatmentId);
    if (!detail || !treatment || !canAccessFighterClinically(auth.user, detail.injury.fighterId)) {
        return actionError("Không truy cập được điều trị này. Có thể nó thuộc võ sĩ bạn không phụ trách.");
    }

    const result = await updateTreatmentStatus(treatment.id, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(`Đã chuyển ${treatmentTitle(result.data)} sang ${TREATMENT_STATUS_LABELS[parsed.data.status].toLowerCase()}.`);
}

/* ─── Recovery plans ──────────────────────────────────────────────────────── */

const phaseSchema = z
    .object({
        name: z.string().trim().min(2, "Hãy đặt tên giai đoạn.").max(80, "Tên giai đoạn tối đa 80 ký tự."),
        goal: z.string().trim().min(5, "Hãy mô tả mục tiêu của giai đoạn.").max(300, "Mục tiêu tối đa 300 ký tự."),
        startDate: z.string().refine(isDateKey, "Hãy nhập ngày bắt đầu giai đoạn."),
        endDate: z.string().refine(isDateKey, "Hãy nhập ngày kết thúc giai đoạn."),
        milestones: z
            .array(z.string().trim().max(160, "Mỗi mốc tối đa 160 ký tự."))
            .transform((items) => items.filter(Boolean))
            .pipe(
                z.array(z.string()).min(1, "Hãy thêm ít nhất một mốc để theo dõi tiến độ.").max(12, "Mỗi giai đoạn tối đa 12 mốc."),
            ),
    })
    .superRefine((phase, ctx) => {
        if (isDateKey(phase.startDate) && isDateKey(phase.endDate) && phase.endDate < phase.startDate) {
            ctx.addIssue({ code: "custom", path: ["endDate"], message: "Giai đoạn phải kết thúc từ ngày bắt đầu trở đi." });
        }
    });

const createRecoveryPlanSchema = z
    .object({
        injuryId: z.string().min(1, "Hãy chọn chấn thương cho kế hoạch."),
        title: z.string().trim().min(3, "Hãy đặt tên ngắn cho kế hoạch.").max(120, "Tên tối đa 120 ký tự."),
        startDate: z.string().refine(isDateKey, "Hãy nhập ngày bắt đầu kế hoạch."),
        targetReturnDate: z.string().refine(isDateKey, "Hãy nhập ngày mục tiêu trở lại."),
        phases: jsonArray(phaseSchema, "phases", {
            min: 1,
            minMessage: "Hãy thêm ít nhất một giai đoạn phục hồi.",
            max: 10,
            maxMessage: "Tối đa 10 giai đoạn.",
        }),
    })
    .superRefine((plan, ctx) => {
        if (!isDateKey(plan.startDate) || !isDateKey(plan.targetReturnDate)) return;
        if (plan.targetReturnDate < plan.startDate) {
            ctx.addIssue({ code: "custom", path: ["targetReturnDate"], message: "Ngày mục tiêu trở lại phải từ ngày bắt đầu trở đi." });
        }
        plan.phases.forEach((phase, index) => {
            if (phase.startDate < plan.startDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "startDate"], message: "Giai đoạn không thể bắt đầu trước kế hoạch." });
            }
            if (phase.endDate > plan.targetReturnDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "endDate"], message: "Giai đoạn này kết thúc sau ngày mục tiêu trở lại." });
            }
            const previous = plan.phases[index - 1];
            if (previous && phase.startDate < previous.startDate) {
                ctx.addIssue({ code: "custom", path: ["phases", index, "startDate"], message: "Các giai đoạn phải theo thứ tự ngày." });
            }
        });
    });

export async function createRecoveryPlanAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);

    const parsed = createRecoveryPlanSchema.safeParse({
        injuryId: text(formData, "injuryId"),
        title: text(formData, "title"),
        startDate: text(formData, "startDate"),
        targetReturnDate: text(formData, "targetReturnDate"),
        phases: text(formData, "phases"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const injury = await getInjury(input.injuryId);
    if (!injury || !canAccessFighterClinically(auth.user, injury.fighterId))
        return actionError(NOT_ASSIGNED, { injuryId: "Hãy chọn chấn thương của võ sĩ bạn phụ trách." });

    const result = await createRecoveryPlan(
        {
            injuryId: injury.id,
            title: input.title,
            startDate: academyWallClockToIso(input.startDate, "09:00"),
            targetReturnDate: academyWallClockToIso(input.targetReturnDate, "18:00"),
            phases: input.phases.map((phase) => ({
                name: phase.name,
                goal: phase.goal,
                startDate: academyWallClockToIso(phase.startDate, "09:00"),
                endDate: academyWallClockToIso(phase.endDate, "18:00"),
                milestones: phase.milestones,
            })),
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    redirect(`${routes.doctor.recoveryPlan(result.data.id)}?created=1`);
}

const checkInSchema = z.object({
    planId: z.string().min(1, "Thiếu kế hoạch phục hồi. Hãy tải lại trang và thử lại."),
    date: z.string().refine(isDateKey, "Hãy nhập ngày kiểm tra."),
    painLevel: wholeNumber("Mức đau", 0, 10),
    mobilityPct: wholeNumber("Vận động", 0, 100),
    strengthPct: wholeNumber("Sức mạnh", 0, 100),
    note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự."),
});

export async function addCheckInAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("recoveryPhasesAndCheckIns")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = checkInSchema.safeParse({
        planId: text(formData, "planId"),
        date: text(formData, "date"),
        painLevel: text(formData, "painLevel"),
        mobilityPct: text(formData, "mobilityPct"),
        strengthPct: text(formData, "strengthPct"),
        note: text(formData, "note"),
    });
    if (!parsed.success) return validationError(parsed.error);
    const input = parsed.data;

    const plan = await getRecoveryPlan(input.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const today = todayKey();
    if (input.date > today) return actionError(FIX_FIELDS, { date: "Ngày kiểm tra không thể ở tương lai." });
    if (input.date < dayKey(plan.startDate)) return actionError(FIX_FIELDS, { date: "Ngày kiểm tra không thể trước ngày bắt đầu kế hoạch." });

    const result = await addRecoveryCheckIn(
        plan.id,
        {
            date: input.date === today ? new Date().toISOString() : academyWallClockToIso(input.date, "12:00"),
            painLevel: input.painLevel,
            mobilityPct: input.mobilityPct,
            strengthPct: input.strengthPct,
            note: input.note,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(`Đã ghi kiểm tra: đau ${input.painLevel}/10, vận động ${input.mobilityPct}%, sức mạnh ${input.strengthPct}%.`);
}

const milestoneSchema = z.object({
    planId: z.string().min(1),
    phaseId: z.string().min(1),
    milestoneIndex: z.number().int().min(0),
    done: z.boolean(),
});

export async function setMilestoneAction(input: { planId: string; phaseId: string; milestoneIndex: number; done: boolean }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("recoveryPhasesAndCheckIns")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = milestoneSchema.safeParse(input);
    if (!parsed.success) return actionError("Không đọc được mốc. Hãy tải lại trang và thử lại.");

    const plan = await getRecoveryPlan(parsed.data.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await setMilestone(plan.id, parsed.data.phaseId, parsed.data.milestoneIndex, parsed.data.done, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    return actionSuccess(parsed.data.done ? "Đã đánh dấu mốc đạt." : "Đã bỏ đánh dấu mốc.");
}

export async function advancePhaseAction(input: { planId: string }): Promise<ActionState> {
    const auth = await authorizeClinicalAction("medical:write");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("recoveryPhasesAndCheckIns")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = z.object({ planId: z.string().min(1) }).safeParse(input);
    if (!parsed.success) return actionError("Thiếu kế hoạch phục hồi. Hãy tải lại trang và thử lại.");

    const plan = await getRecoveryPlan(parsed.data.planId);
    if (!plan || !canAccessFighterClinically(auth.user, plan.fighterId)) return actionError(NOT_ASSIGNED);

    const result = await advanceRecoveryPhase(plan.id, auth.user);
    if (!result.ok) return actionError(result.error);

    revalidateClinical();
    const current = result.data.phases.find((phase) => phase.status === "current");
    return actionSuccess(
        current ? `Đã chuyển sang giai đoạn tiếp theo: ${current.name}.` : "Đã hoàn tất kế hoạch phục hồi. Hãy cập nhật chấn thương và giấy phép khi sẵn sàng.",
    );
}

/* ─── AI movement observations ────────────────────────────────────────────── */

const reviewAlertSchema = z.object({
    alertId: z.string().min(1, "Thiếu quan sát. Hãy tải lại trang và thử lại."),
    decision: z.enum(["acknowledged", "follow_up", "dismissed"], { error: "Choose your decision." }),
    note: z.string().trim().min(10, "Hãy thêm ghi chú lâm sàng ngắn giải thích quyết định.").max(1000, "Ghi chú tối đa 1.000 ký tự."),
});

const DECISION_MESSAGES = {
    acknowledged: "Đã xác nhận quan sát.",
    follow_up: "Đã hẹn theo dõi. HLV được báo kiểm tra giấy phép — không kèm chi tiết lâm sàng.",
    dismissed: "Đã bỏ qua quan sát.",
} as const;

export async function reviewAlertAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeClinicalAction("ai_alerts:review");
    if (!auth.ok) return actionError(auth.message);
    if (!medicalFeatureAvailable("aiObservationReview")) return actionError(FEATURE_UNAVAILABLE_MESSAGE);

    const parsed = reviewAlertSchema.safeParse({
        alertId: text(formData, "alertId"),
        decision: text(formData, "decision"),
        note: text(formData, "note"),
    });
    if (!parsed.success) return validationError(parsed.error);

    const detail = await getAlertDetail(parsed.data.alertId);
    if (!detail || !canAccessFighterClinically(auth.user, detail.alert.fighterId)) {
        return actionError("Không truy cập được quan sát này. Có thể nó thuộc võ sĩ bạn không phụ trách.");
    }

    const result = await reviewAlert(detail.alert.id, { decision: parsed.data.decision, note: parsed.data.note }, auth.user);
    if (!result.ok) return actionError(result.message, result.code === "note_required" ? { note: result.message } : undefined);

    revalidateClinical();
    return actionSuccess(DECISION_MESSAGES[parsed.data.decision]);
}
