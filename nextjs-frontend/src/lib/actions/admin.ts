"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { DOCTOR_ONLY_PERMISSION_REASON, isDoctorOnlyPermission } from "@/lib/auth/permissions";
import { authorizeAction } from "@/lib/auth/session";
import { BROADCAST_CHANNEL_LABELS, ROLE_LABELS } from "@/lib/domain/labels";
import type { AIModelStatus, BroadcastChannel, Permission, Role, SystemSettings, UserStatus } from "@/lib/domain/types";
import { academyWallClockToIso, formatDateTime, isDateKey, isTimeValue, pluralize } from "@/lib/format";
import { routes } from "@/lib/routes";
import {
    createBroadcast,
    inviteUser,
    resendInvite,
    setUserStatus,
    updateRolePermissions,
    updateSettings,
    updateUser,
} from "@/lib/services/admin";
import { cancelJob, retryJob, setModelStatus, updateModelThresholds } from "@/lib/services/ai";
import { deleteVideo, getJobProgress, getVideo } from "@/lib/services/videos";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const ROLES = ["fighter", "coach", "doctor", "admin"] as const satisfies readonly Role[];
const SETTABLE_STATUSES = ["active", "suspended"] as const satisfies readonly UserStatus[];
const MODEL_STATUSES = ["active", "staging", "deprecated"] as const satisfies readonly AIModelStatus[];
const CHANNELS = ["in_app", "email", "in_app_email"] as const satisfies readonly BroadcastChannel[];
const PERMISSIONS = [
    "fighters:read",
    "fighters:write",
    "training:read",
    "training:write",
    "videos:upload",
    "videos:manage",
    "ai_analysis:read",
    "ai_findings:review",
    "ai_alerts:review",
    "goals:write",
    "medical:read_summary",
    "medical:read",
    "medical:write",
    "clearance:manage",
    "users:manage",
    "roles:manage",
    "ai_jobs:manage",
    "ai_models:manage",
    "audit_logs:read",
    "notifications:manage",
    "settings:manage",
] as const satisfies readonly Permission[];

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : undefined);
const texts = (values: FormDataEntryValue[]) => values.filter((value): value is string => typeof value === "string");

const idSchema = (message: string) => z.string(message).min(1, message);

/** Whole number within a range; empty input reports the same message as an out-of-range value. */
function wholeNumber(message: string, min: number, max: number) {
    return z.preprocess(
        (value) => (value === "" || value === undefined ? undefined : Number(value)),
        z.number(message).int(message).min(min, message).max(max, message),
    );
}

function revalidateUser(userId: string) {
    revalidatePath(routes.admin.users);
    revalidatePath(routes.admin.user(userId));
    revalidatePath(routes.admin.dashboard);
    revalidatePath(routes.admin.auditLogs);
}

function revalidateVideoPages(videoId: string, fighterId: string) {
    revalidatePath(routes.admin.videos);
    revalidatePath(routes.admin.aiJobs);
    revalidatePath(routes.admin.dashboard);
    revalidatePath(routes.coach.videoAnalysis);
    revalidatePath(routes.coach.video(videoId));
    revalidatePath(routes.coach.fighterVideos(fighterId));
    revalidatePath(routes.fighter.videos);
    revalidatePath(routes.fighter.video(videoId));
}

/* ─── Users ───────────────────────────────────────────────────────────────── */

const nameSchema = z.string("Enter the person's full name.").trim().min(2, "Enter the person's full name.").max(80, "Keep the name under 80 characters.");
const titleSchema = z.string("Enter a job title, e.g. Assistant Coach.").trim().min(2, "Enter a job title, e.g. Assistant Coach.").max(80, "Keep the title under 80 characters.");

const inviteSchema = z.object({
    name: nameSchema,
    email: z.email("Enter a valid email address, e.g. name@lotuscombat.vn."),
    role: z.enum(ROLES, "Choose the role for this account."),
    title: titleSchema,
});

/** Creates an invited account and opens it. */
export async function inviteUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = inviteSchema.safeParse({
        name: text(formData.get("name")),
        email: text(formData.get("email"))?.trim().toLowerCase(),
        role: text(formData.get("role")),
        title: text(formData.get("title")),
    });
    if (!parsed.success) return validationError(parsed.error);

    const result = await inviteUser(parsed.data, auth.user);
    if (!result.ok) return actionError(result.message, { email: result.message });

    revalidateUser(result.user.id);
    redirect(`${routes.admin.user(result.user.id)}?notice=invited`);
}

const updateUserSchema = z.object({
    userId: idSchema("The account is missing."),
    name: nameSchema,
    title: titleSchema,
    role: z.enum(ROLES, "Choose a role.").optional(),
});

/** Updates an account's name, title and (when allowed) role. */
export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = updateUserSchema.safeParse({
        userId: text(formData.get("userId")),
        name: text(formData.get("name")),
        title: text(formData.get("title")),
        role: text(formData.get("role")) || undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const { userId, ...patch } = parsed.data;
    const result = await updateUser(userId, patch, auth.user);
    if (!result.ok) {
        return result.code === "not_found" ? actionError(result.message) : actionError(result.message, { role: result.message });
    }
    revalidateUser(userId);
    return actionSuccess(`${result.user.name}'s account was updated.`);
}

const statusSchema = z.object({
    userId: idSchema("The account is missing."),
    status: z.enum(SETTABLE_STATUSES, "Choose suspend or reactivate."),
});

/** Suspends or reactivates an account. Suspension signs the person out on their next request. */
export async function setUserStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = statusSchema.safeParse({ userId: text(formData.get("userId")), status: text(formData.get("status")) });
    if (!parsed.success) return validationError(parsed.error);

    const result = await setUserStatus(parsed.data.userId, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.message);

    revalidateUser(parsed.data.userId);
    return actionSuccess(
        parsed.data.status === "suspended" ? `${result.user.name} is suspended and can no longer sign in.` : `${result.user.name} can sign in again.`,
    );
}

/** Sends the invitation email again for an account that hasn't accepted yet. */
export async function resendInviteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = z.object({ userId: idSchema("The account is missing.") }).safeParse({ userId: text(formData.get("userId")) });
    if (!parsed.success) return validationError(parsed.error);

    const result = await resendInvite(parsed.data.userId, auth.user);
    if (!result.ok) return actionError(result.message);

    revalidateUser(parsed.data.userId);
    return actionSuccess(`Invitation sent again to ${result.user.email}.`);
}

/* ─── Roles ───────────────────────────────────────────────────────────────── */

const rolePermissionsSchema = z
    .object({
        role: z.enum(ROLES, "Choose a role."),
        permissions: z.array(z.enum(PERMISSIONS, "One of the permissions isn't recognised. Reload the page and try again.")),
    })
    .superRefine((value, ctx) => {
        if (value.role !== "doctor" && value.permissions.some(isDoctorOnlyPermission)) {
            ctx.addIssue({ code: "custom", path: ["permissions"], message: `${DOCTOR_ONLY_PERMISSION_REASON}.` });
        }
    });

/** Replaces the permissions of one role. The service protects the Administrator role from lockout. */
export async function updateRolePermissionsAction(_prev: ActionState<Permission[]>, formData: FormData): Promise<ActionState<Permission[]>> {
    const auth = await authorizeAction("roles:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = rolePermissionsSchema.safeParse({ role: text(formData.get("role")), permissions: texts(formData.getAll("permissions")) });
    if (!parsed.success) {
        // The matrix shows the message only, so surface the permission rule itself rather than the generic prompt.
        const invalid = validationError(parsed.error);
        const permissionsError = invalid.fieldErrors?.permissions;
        return permissionsError ? actionError(permissionsError, invalid.fieldErrors) : invalid;
    }

    const result = await updateRolePermissions(parsed.data.role, parsed.data.permissions, auth.user);
    if (!result.ok) {
        return result.code === "clinical_permission_forbidden" ? actionError(result.message, { permissions: result.message }) : actionError(result.message);
    }

    revalidatePath(routes.admin.roles);
    revalidatePath("/admin/users/[userId]", "page");
    revalidatePath(routes.admin.auditLogs);
    return actionSuccess(`${ROLE_LABELS[parsed.data.role]} permissions saved. Active members were notified.`, result.role.permissions);
}

/* ─── Videos & AI jobs ────────────────────────────────────────────────────── */

/** Deletes footage with its jobs and analysis. Doctor-reviewed observations stay in the clinical trail. */
export async function deleteVideoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("videos:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = z.object({ videoId: idSchema("The video is missing.") }).safeParse({ videoId: text(formData.get("videoId")) });
    if (!parsed.success) return validationError(parsed.error);

    const video = await getVideo(parsed.data.videoId);
    if (!video || !canAccessFighter(auth.user, video.fighterId)) return actionError("This video no longer exists. Refresh the list.");

    const result = await deleteVideo(video.id, auth.user);
    if (!result.ok) return actionError(result.message);

    revalidateVideoPages(video.id, video.fighterId);
    revalidatePath(routes.admin.auditLogs);
    return actionSuccess(`“${result.video.title}” was deleted.`);
}

async function loadJob(formData: FormData) {
    const auth = await authorizeAction("ai_jobs:manage");
    if (!auth.ok) return { ok: false, error: actionError(auth.message) } as const;
    const parsed = z.object({ jobId: idSchema("The job is missing.") }).safeParse({ jobId: text(formData.get("jobId")) });
    if (!parsed.success) return { ok: false, error: validationError(parsed.error) } as const;
    const job = await getJobProgress(parsed.data.jobId);
    if (!job || !canAccessFighter(auth.user, job.fighterId)) {
        return { ok: false, error: actionError("This job no longer exists. Refresh the list.") } as const;
    }
    return { ok: true, user: auth.user, job } as const;
}

function revalidateJob(jobId: string, videoId: string, fighterId: string) {
    revalidatePath(routes.admin.aiJob(jobId));
    revalidateVideoPages(videoId, fighterId);
}

/** Re-queues a failed job. */
export async function retryJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const loaded = await loadJob(formData);
    if (!loaded.ok) return loaded.error;

    const result = await retryJob(loaded.job.id, loaded.user);
    if (!result.ok) return actionError(result.message);

    revalidateJob(result.job.id, result.job.videoId, result.job.fighterId);
    return actionSuccess(`Job queued again (attempt ${result.job.attempts}).`);
}

/** Stops a queued or processing job; the uploader is told by the service. */
export async function cancelJobAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const loaded = await loadJob(formData);
    if (!loaded.ok) return loaded.error;

    const result = await cancelJob(loaded.job.id, loaded.user);
    if (!result.ok) return actionError(result.message);

    revalidateJob(result.job.id, result.job.videoId, result.job.fighterId);
    return actionSuccess("Job cancelled. The uploader has been notified.");
}

/* ─── AI models ───────────────────────────────────────────────────────────── */

export interface ThresholdsData {
    confidencePct: number;
    lowConfidencePct: number;
}

const thresholdsSchema = z
    .object({
        modelId: idSchema("The model is missing."),
        confidencePct: wholeNumber("Enter a confidence threshold between 1% and 98%.", 1, 98),
        lowConfidencePct: wholeNumber("Enter a low-confidence threshold between 2% and 99%.", 2, 99),
    })
    .superRefine((value, ctx) => {
        if (value.lowConfidencePct <= value.confidencePct) {
            ctx.addIssue({
                code: "custom",
                path: ["lowConfidencePct"],
                message: `Set the low-confidence threshold above the confidence threshold (${value.confidencePct}%).`,
            });
        }
    });

/** Updates a model's confidence and low-confidence thresholds (entered as percentages). */
export async function updateModelThresholdsAction(_prev: ActionState<ThresholdsData>, formData: FormData): Promise<ActionState<ThresholdsData>> {
    const auth = await authorizeAction("ai_models:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = thresholdsSchema.safeParse({
        modelId: text(formData.get("modelId")),
        confidencePct: text(formData.get("confidencePct")),
        lowConfidencePct: text(formData.get("lowConfidencePct")),
    });
    if (!parsed.success) return validationError(parsed.error);

    const { modelId, confidencePct, lowConfidencePct } = parsed.data;
    const result = await updateModelThresholds(modelId, { confidenceThreshold: confidencePct / 100, lowConfidenceThreshold: lowConfidencePct / 100 }, auth.user);
    if (!result.ok) {
        return result.code === "invalid_thresholds" ? actionError(result.message, { lowConfidencePct: result.message }) : actionError(result.message);
    }

    revalidatePath(routes.admin.aiModels);
    revalidatePath(routes.admin.aiModel(modelId));
    revalidatePath(routes.admin.auditLogs);
    return actionSuccess(`Thresholds saved for ${result.model.name} ${result.model.version}.`, {
        confidencePct: Math.round(result.model.confidenceThreshold * 100),
        lowConfidencePct: Math.round(result.model.lowConfidenceThreshold * 100),
    });
}

const modelStatusSchema = z.object({
    modelId: idSchema("The model is missing."),
    status: z.enum(MODEL_STATUSES, "Choose a model status."),
});

/** Changes a model's lifecycle status; promoting to active deprecates the current active model for the task. */
export async function setModelStatusAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("ai_models:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = modelStatusSchema.safeParse({ modelId: text(formData.get("modelId")), status: text(formData.get("status")) });
    if (!parsed.success) return validationError(parsed.error);

    const result = await setModelStatus(parsed.data.modelId, parsed.data.status, auth.user);
    if (!result.ok) return actionError(result.message);

    revalidatePath(routes.admin.aiModels);
    revalidatePath("/admin/ai-models/[modelId]", "page");
    revalidatePath(routes.admin.dashboard);
    revalidatePath(routes.admin.auditLogs);
    return actionSuccess(
        parsed.data.status === "active"
            ? `${result.model.name} ${result.model.version} is now the active model for new jobs.`
            : `${result.model.name} ${result.model.version} is now ${parsed.data.status}.`,
    );
}

/* ─── Broadcasts ──────────────────────────────────────────────────────────── */

export interface BroadcastData {
    status: "sent" | "scheduled";
    recipientCount: number;
}

const broadcastSchema = z
    .object({
        title: z.string("Give the broadcast a title.").trim().min(3, "Give the broadcast a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
        body: z.string("Write the message.").trim().min(10, "Write a message of at least 10 characters.").max(1000, "Keep the message under 1,000 characters."),
        audience: z.array(z.enum(ROLES, "Choose roles from the list.")).min(1, "Choose at least one role to receive this broadcast."),
        channel: z.enum(CHANNELS, "Choose how to deliver the broadcast."),
        delivery: z.enum(["now", "schedule"], "Choose to send now or schedule it."),
        scheduledFor: z.string().optional(),
    })
    .superRefine((value, ctx) => {
        if (value.delivery === "schedule" && !value.scheduledFor) {
            ctx.addIssue({ code: "custom", path: ["scheduledFor"], message: "Pick the date and time to send it." });
        }
    });

/** Sends a broadcast now or schedules it for later. */
export async function createBroadcastAction(_prev: ActionState<BroadcastData>, formData: FormData): Promise<ActionState<BroadcastData>> {
    const auth = await authorizeAction("notifications:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = broadcastSchema.safeParse({
        title: text(formData.get("title")),
        body: text(formData.get("body")),
        audience: texts(formData.getAll("audience")),
        channel: text(formData.get("channel")),
        delivery: text(formData.get("delivery")),
        scheduledFor: text(formData.get("scheduledFor")) || undefined,
    });
    if (!parsed.success) return validationError(parsed.error);

    const { delivery, scheduledFor, ...input } = parsed.data;
    let scheduledIso: string | null = null;
    if (delivery === "schedule" && scheduledFor) {
        const [day, time] = scheduledFor.split("T");
        if (!isDateKey(day) || !isTimeValue(time)) return actionError("Please fix the highlighted fields.", { scheduledFor: "Enter a valid date and time." });
        scheduledIso = academyWallClockToIso(day, time);
    }

    const result = await createBroadcast({ ...input, scheduledFor: scheduledIso }, auth.user);
    if (!result.ok) return actionError(result.message, { [result.field]: result.message });

    revalidatePath(routes.admin.notifications);
    revalidatePath(routes.notifications);
    revalidatePath(routes.admin.auditLogs);
    const { broadcast } = result;
    const recipients = pluralize(broadcast.recipientCount, "recipient");
    return actionSuccess(
        broadcast.status === "sent"
            ? `Sent to ${recipients} by ${BROADCAST_CHANNEL_LABELS[broadcast.channel].toLowerCase()}.`
            : `Scheduled for ${formatDateTime(broadcast.scheduledFor ?? broadcast.createdAt)} · ${recipients}.`,
        { status: broadcast.status === "sent" ? "sent" : "scheduled", recipientCount: broadcast.recipientCount },
    );
}

/* ─── Settings ────────────────────────────────────────────────────────────── */

const settingsSchema = z
    .object({
        organizationName: z.string("Enter the organization name.").trim().min(1, "Enter the organization name.").max(120, "Keep the name under 120 characters."),
        sessionTimeoutMin: wholeNumber("Session timeout must be a whole number between 15 and 1440 minutes.", 15, 1440),
        requireMfa: z.boolean(),
        videoMaxSizeMb: wholeNumber("Maximum video size must be a whole number between 50 and 4096 MB.", 50, 4096),
        videoRetentionDays: wholeNumber("Video retention must be a whole number between 30 and 3650 days.", 30, 3650),
        allowedVideoFormats: z
            .array(z.string().regex(/^[a-z0-9]{2,5}$/, "Video formats are file extensions such as mp4."))
            .min(1, "Allow at least one video format."),
        aiConfidenceThreshold: wholeNumber("The AI detection threshold must be between 5% and 95%.", 5, 95),
        aiLowConfidenceThreshold: wholeNumber("The low-confidence review threshold must be between 5% and 95%.", 5, 95),
        abnormalMovementAlertsEnabled: z.boolean(),
        notifyDoctorOnAlert: z.boolean(),
        clearanceExpiryWarningDays: wholeNumber("The clearance expiry warning must be a whole number between 1 and 90 days.", 1, 90),
    })
    .superRefine((value, ctx) => {
        if (value.aiLowConfidenceThreshold <= value.aiConfidenceThreshold) {
            ctx.addIssue({
                code: "custom",
                path: ["aiLowConfidenceThreshold"],
                message: `Set the review threshold above the detection threshold (${value.aiConfidenceThreshold}%), otherwise nothing is flagged for review.`,
            });
        }
    });

/** Saves the system settings form. Thresholds are entered as percentages. */
export async function updateSettingsAction(_prev: ActionState<SystemSettings>, formData: FormData): Promise<ActionState<SystemSettings>> {
    const auth = await authorizeAction("settings:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = settingsSchema.safeParse({
        organizationName: text(formData.get("organizationName")),
        sessionTimeoutMin: text(formData.get("sessionTimeoutMin")),
        requireMfa: formData.get("requireMfa") === "on",
        videoMaxSizeMb: text(formData.get("videoMaxSizeMb")),
        videoRetentionDays: text(formData.get("videoRetentionDays")),
        allowedVideoFormats: texts(formData.getAll("allowedVideoFormats")),
        aiConfidenceThreshold: text(formData.get("aiConfidenceThreshold")),
        aiLowConfidenceThreshold: text(formData.get("aiLowConfidenceThreshold")),
        abnormalMovementAlertsEnabled: formData.get("abnormalMovementAlertsEnabled") === "on",
        notifyDoctorOnAlert: formData.get("notifyDoctorOnAlert") === "on",
        clearanceExpiryWarningDays: text(formData.get("clearanceExpiryWarningDays")),
    });
    if (!parsed.success) return validationError(parsed.error);

    const values = parsed.data;
    const result = await updateSettings(
        {
            ...values,
            aiConfidenceThreshold: values.aiConfidenceThreshold / 100,
            aiLowConfidenceThreshold: values.aiLowConfidenceThreshold / 100,
        },
        auth.user,
    );
    if (!result.ok) return actionError(result.message, { [result.field]: result.message });

    revalidatePath("/", "layout");
    return actionSuccess("System settings saved.", result.settings);
}
