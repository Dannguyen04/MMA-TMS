"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { canAccessFighter } from "@/lib/auth/access";
import { DOCTOR_ONLY_PERMISSION_REASON, isDoctorOnlyPermission } from "@/lib/auth/permissions";
import { authorizeAction } from "@/lib/auth/session";
import { ACCOUNT_LIMITS } from "@/lib/domain/account-contract";
import { CARE_ROLE_LABELS, CARE_ROLES, END_REASON_MAX } from "@/lib/domain/care-team";
import { BROADCAST_CHANNEL_LABELS, ROLE_LABELS, WEIGHT_CLASS_ORDER } from "@/lib/domain/labels";
import { PERMISSIONS, type AIModelStatus, type BroadcastChannel, type Permission, type Role, type Stance, type SystemSettings, type UserStatus } from "@/lib/domain/types";
import type { WriteResult } from "@/lib/domain/write-result";
import { academyWallClockToIso, formatDateTime, isDateKey, isTimeValue, pluralize } from "@/lib/format";
import { hrefWith } from "@/lib/query";
import { routes } from "@/lib/routes";
import { accountWriteFailure } from "@/lib/services/account-errors";
import {
    createAccount,
    createBroadcast,
    deleteAccount,
    inviteUser,
    resendInvite,
    setUserStatus,
    updateAccount,
    updateRolePermissions,
    updateSettings,
    updateUser,
} from "@/lib/services/admin";
import { ADMIN_FEATURE_UNAVAILABLE_MESSAGE, adminFeatureAvailable, usesUserServiceForms } from "@/lib/services/admin-features";
import { assignStaff, endAssignment } from "@/lib/services/care-team";
import { PLATFORM_FEATURE_UNAVAILABLE_MESSAGE, platformFeatureAvailable } from "@/lib/services/platform-features";
import { cancelJob, retryJob, setModelStatus, updateModelThresholds } from "@/lib/services/ai";
import { deleteVideo, getJobProgress, getVideo } from "@/lib/services/videos";
import { nullableText, pastDate, requiredText } from "./form-helpers";
import { actionError, actionSuccess, FIX_FIELDS, validationError, writeResultState, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const ROLES = ["fighter", "coach", "doctor", "admin"] as const satisfies readonly Role[];
const SETTABLE_STATUSES = ["active", "suspended"] as const satisfies readonly UserStatus[];
const MODEL_STATUSES = ["active", "staging", "deprecated"] as const satisfies readonly AIModelStatus[];
const CHANNELS = ["in_app", "email", "in_app_email"] as const satisfies readonly BroadcastChannel[];

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
    if (!adminFeatureAvailable("inviteUsers")) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!adminFeatureAvailable("editUsers")) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!adminFeatureAvailable("accountStatus")) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!adminFeatureAvailable("accountStatus")) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
    const parsed = z.object({ userId: idSchema("The account is missing.") }).safeParse({ userId: text(formData.get("userId")) });
    if (!parsed.success) return validationError(parsed.error);

    const result = await resendInvite(parsed.data.userId, auth.user);
    if (!result.ok) return actionError(result.message);

    revalidateUser(parsed.data.userId);
    return actionSuccess(`Invitation sent again to ${result.user.email}.`);
}

/* ─── Accounts in the user service's terms ───────────────────────────────── */

const STANCES = ["orthodox", "southpaw", "switch"] as const satisfies readonly Stance[];
/** Profile controls are named `profile.<field>`, so validation and service errors land on them by path. */
const PROFILE_FIELDS = ["firstName", "lastName", "dateOfBirth", "weightClass", "dominantStance", "nationality", "specialization", "licenseNumber"] as const;

const names = { firstName: requiredText("first name", ACCOUNT_LIMITS.name), lastName: requiredText("last name", ACCOUNT_LIMITS.name) };
const specialization = nullableText("specialisation", ACCOUNT_LIMITS.specialization);

const staffAccountSchemas = [
    z.object({
        role: z.literal("fighter"),
        profile: z.object({
            ...names,
            dateOfBirth: pastDate("date of birth"),
            weightClass: z.enum(WEIGHT_CLASS_ORDER, "Choose a weight class."),
            dominantStance: z.preprocess((value) => value || null, z.enum(STANCES, "Choose a stance from the list.").nullable()),
            nationality: nullableText("nationality", ACCOUNT_LIMITS.nationality),
        }),
    }),
    z.object({ role: z.literal("coach"), profile: z.object({ ...names, specialization, isHeadCoach: z.boolean() }) }),
    z.object({ role: z.literal("doctor"), profile: z.object({ ...names, licenseNumber: requiredText("license number", ACCOUNT_LIMITS.licenseNumber), specialization }) }),
] as const;

const ROLE_MESSAGE = "Choose the role for this account.";
const staffAccountSchema = z.discriminatedUnion("role", staffAccountSchemas, ROLE_MESSAGE);
const newAccountSchema = z.intersection(
    z.object({
        email: z.email("Enter a valid email address, e.g. name@lotuscombat.vn."),
        password: z
            .string("Set a first password.")
            .min(ACCOUNT_LIMITS.passwordMin, `Use at least ${ACCOUNT_LIMITS.passwordMin} characters.`)
            .max(ACCOUNT_LIMITS.passwordMax, `Keep the password under ${ACCOUNT_LIMITS.passwordMax} characters.`),
    }),
    z.discriminatedUnion("role", [...staffAccountSchemas, z.object({ role: z.literal("admin"), profile: z.null() })], ROLE_MESSAGE),
);

/** The role and its profile fields as the form sent them. Administrators have no profile. */
function accountInput(formData: FormData) {
    const role = text(formData.get("role"));
    if (role === "admin") return { role, profile: null };
    const fields = Object.fromEntries(PROFILE_FIELDS.map((field) => [field, text(formData.get(`profile.${field}`))]));
    return { role, profile: { ...fields, isHeadCoach: formData.get("profile.isHeadCoach") === "on" } };
}

function accountFailure(error: unknown): ActionState<never> {
    const failure = accountWriteFailure(error);
    return actionError(failure.message, failure.fieldErrors);
}

/** Creates an account with its first password and full profile, then opens it. */
export async function createAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    if (!usesUserServiceForms()) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
    const parsed = newAccountSchema.safeParse({ email: text(formData.get("email"))?.trim().toLowerCase(), password: text(formData.get("password")), ...accountInput(formData) });
    if (!parsed.success) return validationError(parsed.error);

    const { email, password } = parsed.data;
    let userId: string;
    try {
        userId = (await createAccount({ email, password, account: parsed.data })).id;
    } catch (error) {
        return accountFailure(error);
    }
    revalidateUser(userId);
    redirect(hrefWith(routes.admin.user(userId), {}, { notice: "created" }));
}

/** Saves the profile of a fighter, coach or doctor account. The role itself can't change. */
export async function updateAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    if (!usesUserServiceForms()) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
    const userId = idSchema("The account is missing.").safeParse(text(formData.get("userId")));
    if (!userId.success) return validationError(userId.error);
    const parsed = staffAccountSchema.safeParse(accountInput(formData));
    if (!parsed.success) return validationError(parsed.error);

    let name: string;
    try {
        const updated = await updateAccount(userId.data, parsed.data);
        if (!updated) return actionError("This account no longer exists. Reload the page.");
        name = updated.name;
    } catch (error) {
        return accountFailure(error);
    }
    revalidateUser(userId.data);
    return actionSuccess(`${name}'s profile was updated.`);
}

/** Deletes another account: its records stay, but it can no longer sign in or be opened here. */
export async function deleteAccountAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    if (!usesUserServiceForms()) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
    const userId = idSchema("The account is missing.").safeParse(text(formData.get("userId")));
    if (!userId.success) return validationError(userId.error);
    if (userId.data === auth.user.id) return actionError("You can't delete your own account. Ask another administrator.");

    try {
        // Already gone counts as done: the list no longer shows it either way.
        await deleteAccount(userId.data);
    } catch (error) {
        return accountFailure(error);
    }
    revalidateUser(userId.data);
    redirect(hrefWith(routes.admin.users, {}, { notice: "account-deleted" }));
}

/* ─── Care team ───────────────────────────────────────────────────────────── */

const careTeamFields = { fighterId: idSchema("The fighter is missing."), role: z.enum(CARE_ROLES, "Choose a coach or a sports doctor.") };

function careTeamResult(result: WriteResult, message: string): ActionState {
    if (result.ok) {
        revalidatePath("/admin/users/[userId]", "page");
        revalidatePath(routes.admin.auditLogs);
    }
    return writeResultState(result, message);
}

/** Assigns a coach or sports doctor to a fighter from now. */
export async function assignStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = z.object({ ...careTeamFields, staffId: idSchema("Choose who to assign.") }).safeParse({
        fighterId: text(formData.get("fighterId")),
        role: text(formData.get("role")),
        staffId: text(formData.get("staffId")),
    });
    if (!parsed.success) return validationError(parsed.error);

    const { fighterId, role, staffId } = parsed.data;
    return careTeamResult(await assignStaff(fighterId, role, staffId, auth.user), `The ${CARE_ROLE_LABELS[role]} was assigned.`);
}

/** Ends a coach's or sports doctor's assignment; it stays in the fighter's history with the reason. */
export async function endAssignmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
    const auth = await authorizeAction("users:manage");
    if (!auth.ok) return actionError(auth.message);
    const parsed = z
        .object({
            ...careTeamFields,
            assignmentId: idSchema("The assignment is missing."),
            reason: z
                .string("Say why the assignment ends.")
                .trim()
                .min(1, "Say why the assignment ends.")
                .max(END_REASON_MAX, `Keep the reason under ${END_REASON_MAX} characters.`),
        })
        .safeParse({
            fighterId: text(formData.get("fighterId")),
            role: text(formData.get("role")),
            assignmentId: text(formData.get("assignmentId")),
            reason: text(formData.get("reason")),
        });
    if (!parsed.success) return validationError(parsed.error);

    const { fighterId, role, assignmentId, reason } = parsed.data;
    return careTeamResult(await endAssignment(fighterId, role, assignmentId, reason, auth.user), `The ${CARE_ROLE_LABELS[role]}'s assignment has ended.`);
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
    if (!adminFeatureAvailable("rolePermissions")) return actionError(ADMIN_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!platformFeatureAvailable("aiJobControl")) return { ok: false, error: actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE) } as const;
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
    if (!platformFeatureAvailable("aiModels")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!platformFeatureAvailable("aiModels")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);
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
    if (!platformFeatureAvailable("broadcasts")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);
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
        if (!isDateKey(day) || !isTimeValue(time)) return actionError(FIX_FIELDS, { scheduledFor: "Enter a valid date and time." });
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
    if (!platformFeatureAvailable("systemSettings")) return actionError(PLATFORM_FEATURE_UNAVAILABLE_MESSAGE);
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
