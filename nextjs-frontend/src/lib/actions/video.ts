"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { VIDEO_PIPELINE_MODE } from "@/lib/api/pipeline-mode";
import { canAccessFighter } from "@/lib/auth/access";
import { authorizeAction } from "@/lib/auth/session";
import type { AIFinding, CameraAngle, CoachReview, Detection, ReviewDecision, User, VideoTrainingType } from "@/lib/domain/types";
import { routes } from "@/lib/routes";
import { getAnalysis, retryJob, reviewDetection, reviewFinding, submitCoachReview } from "@/lib/services/ai";
import {
    createVideoUpload,
    getVideo,
} from "@/lib/services/videos";
import { actionError, actionSuccess, validationError, type ActionState } from "./state";

/* ─── Shared ──────────────────────────────────────────────────────────────── */

const TRAINING_TYPES = ["shadow_boxing", "pad_work", "heavy_bag", "sparring"] as const satisfies readonly VideoTrainingType[];
const CAMERA_ANGLES = ["front", "side", "diagonal"] as const satisfies readonly CameraAngle[];
const DECISIONS = ["confirmed", "corrected", "rejected"] as const satisfies readonly ReviewDecision[];

const text = (value: FormDataEntryValue | null) => (typeof value === "string" ? value : undefined);

function videoHref(user: User, videoId: string): string {
    return user.role === "fighter" ? routes.fighter.video(videoId) : routes.coach.video(videoId);
}

function revalidateVideo(videoId: string, fighterId: string) {
    revalidatePath(routes.fighter.videos);
    revalidatePath(routes.fighter.video(videoId));
    revalidatePath(routes.coach.videoAnalysis);
    revalidatePath(routes.coach.video(videoId));
    revalidatePath(routes.coach.fighterVideos(fighterId));
}

/* ─── Upload ──────────────────────────────────────────────────────────────── */

export interface UploadActionData {
    videoId: string;
    jobId: string;
    href: string;
}

const uploadSchema = z.object({
    fighterId: z.string().min(1, "Choose the fighter in this video."),
    title: z.string().trim().min(3, "Give the video a title of at least 3 characters.").max(120, "Keep the title under 120 characters."),
    trainingType: z.enum(TRAINING_TYPES, "Choose the type of training in the video."),
    cameraAngle: z.enum(CAMERA_ANGLES, "Choose the camera angle."),
    fileName: z.string().min(1, "Choose a video file."),
    fileSizeMb: z.coerce.number("Choose a video file.").positive("Choose a video file."),
    durationSec: z.coerce.number("The video length couldn't be read.").positive("The video length couldn't be read."),
    sessionId: z.string().optional().transform((value) => value || null),
    notes: z
        .string()
        .max(1000, "Keep notes under 1,000 characters.")
        .optional()
        .transform((value) => value?.trim() || null),
});

/** Job ids issued by the NestJS job API (UUIDs and similar opaque ids). */
const EXTERNAL_JOB_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const externalSchema = uploadSchema.extend({
    videoId: z.string().uuid("The uploaded video id is invalid."),
    sourceUrl: z.string().startsWith("/api/videos/", "The protected video URL is invalid."),
    externalJobId: z.string().regex(EXTERNAL_JOB_ID_PATTERN, "The analysis job wasn't created. Start the upload again."),
}).refine((value) => value.sourceUrl === `/api/videos/${value.videoId}/content`, {
    path: ["sourceUrl"],
    message: "The protected video URL does not match the uploaded video.",
});

function uploadFields(formData: FormData) {
    return {
        fighterId: text(formData.get("fighterId")),
        title: text(formData.get("title")),
        trainingType: text(formData.get("trainingType")),
        cameraAngle: text(formData.get("cameraAngle")),
        fileName: text(formData.get("fileName")),
        fileSizeMb: text(formData.get("fileSizeMb")),
        durationSec: text(formData.get("durationSec")),
        sessionId: text(formData.get("sessionId")),
        notes: text(formData.get("notes")),
    };
}

function uploadFailure(result: { ok: false; code: string; message: string }): ActionState<never> {
    switch (result.code) {
        case "fighter_not_found":
            return actionError(result.message, { fighterId: result.message });
        case "session_mismatch":
            return actionError(result.message, { sessionId: result.message });
        default:
            return actionError(result.message, { file: result.message });
    }
}

/** Registers footage uploaded in mock mode and queues it for AI analysis. Fighters upload for themselves, coaches for their roster. */
export async function createUpload(_prev: ActionState<UploadActionData>, formData: FormData): Promise<ActionState<UploadActionData>> {
    const auth = await authorizeAction("videos:upload");
    if (!auth.ok) return actionError(auth.message);
    const parsed = uploadSchema.safeParse(uploadFields(formData));
    if (!parsed.success) return validationError(parsed.error);
    if (!canAccessFighter(auth.user, parsed.data.fighterId)) {
        return actionError("You can only upload videos for fighters you work with.", { fighterId: "Choose a fighter from your roster." });
    }

    const result = await createVideoUpload(parsed.data, auth.user);
    if (!result.ok) return uploadFailure(result);

    revalidateVideo(result.video.id, result.video.fighterId);
    return actionSuccess("Upload complete. AI analysis has started.", {
        videoId: result.video.id,
        jobId: result.job.id,
        href: videoHref(auth.user, result.video.id),
    });
}

/** API mode: registers footage already stored in Supabase with the job created on the NestJS API. */
export async function registerExternalUpload(_prev: ActionState<UploadActionData>, formData: FormData): Promise<ActionState<UploadActionData>> {
    const auth = await authorizeAction("videos:upload");
    if (!auth.ok) return actionError(auth.message);
    if (VIDEO_PIPELINE_MODE !== "api") return actionError("External uploads aren't enabled on this deployment. Upload the video from this page instead.");
    const parsed = externalSchema.safeParse({
        ...uploadFields(formData),
        videoId: text(formData.get("videoId")),
        sourceUrl: text(formData.get("sourceUrl")),
        externalJobId: text(formData.get("externalJobId")),
    });
    if (!parsed.success) return validationError(parsed.error);
    if (!canAccessFighter(auth.user, parsed.data.fighterId)) {
        return actionError("You can only upload videos for fighters you work with.", { fighterId: "Choose a fighter from your roster." });
    }

    revalidateVideo(parsed.data.videoId, parsed.data.fighterId);
    return actionSuccess("Upload complete. AI analysis has started.", {
        videoId: parsed.data.videoId,
        jobId: parsed.data.externalJobId,
        href: videoHref(auth.user, parsed.data.videoId),
    });
}

/** Re-queues a failed analysis of a video the user uploads for (own footage or roster). */
export async function retryAnalysis(_prev: ActionState<{ jobId: string }>, formData: FormData): Promise<ActionState<{ jobId: string }>> {
    const auth = await authorizeAction("videos:upload");
    if (!auth.ok) return actionError(auth.message);
    const parsed = z.object({ videoId: z.string().min(1, "The video is missing.") }).safeParse({ videoId: text(formData.get("videoId")) });
    if (!parsed.success) return validationError(parsed.error);

    const video = await getVideo(parsed.data.videoId);
    if (!video || !canAccessFighter(auth.user, video.fighterId)) return actionError("This video doesn't exist or you can't manage it.");
    if (!video.jobId) return actionError("This video has no analysis job to retry. Upload it again.");

    const result = await retryJob(video.jobId, auth.user);
    if (!result.ok) {
        return actionError(result.code === "invalid_state" ? "This analysis is no longer in a failed state. Refresh the page to see its progress." : result.message);
    }
    revalidateVideo(video.id, video.fighterId);
    return actionSuccess("Analysis queued again.", { jobId: result.job.id });
}

/* ─── Human review ────────────────────────────────────────────────────────── */

const reviewSchema = z
    .object({
        analysisId: z.string().min(1),
        targetId: z.string().min(1),
        decision: z.enum(DECISIONS, "Choose confirm, correct or reject."),
        note: z
            .string()
            .max(500, "Keep the note under 500 characters.")
            .optional()
            .transform((value) => value?.trim() || null),
        correctedLabel: z
            .string()
            .optional()
            .transform((value) => value?.trim() || null),
    })
    .superRefine((value, ctx) => {
        if (value.decision === "corrected" && !value.correctedLabel) {
            ctx.addIssue({ code: "custom", path: ["correctedLabel"], message: "Choose the correct label." });
        }
        if (value.decision === "rejected" && !value.note) {
            ctx.addIssue({ code: "custom", path: ["note"], message: "Explain why this is wrong — it helps retrain the model." });
        }
    });

const DECISION_MESSAGES: Record<ReviewDecision, string> = {
    confirmed: "Confirmed",
    corrected: "Correction saved",
    rejected: "Rejected",
};

async function reviewTarget(formData: FormData, idField: string) {
    const auth = await authorizeAction("ai_findings:review");
    if (!auth.ok) return { ok: false, error: actionError(auth.message) } as const;
    const parsed = reviewSchema.safeParse({
        analysisId: text(formData.get("analysisId")),
        targetId: text(formData.get(idField)),
        decision: text(formData.get("decision")),
        note: text(formData.get("note")),
        correctedLabel: text(formData.get("correctedLabel")),
    });
    if (!parsed.success) return { ok: false, error: validationError(parsed.error) } as const;
    const analysis = await getAnalysis(parsed.data.analysisId);
    if (!analysis || !canAccessFighter(auth.user, analysis.fighterId)) {
        return { ok: false, error: actionError("This analysis doesn't exist or you can't review it.") } as const;
    }
    return { ok: true, user: auth.user, input: parsed.data, analysis } as const;
}

/** Coach decision on an AI finding (confirm / correct / reject). */
export async function reviewFindingAction(_prev: ActionState<AIFinding>, formData: FormData): Promise<ActionState<AIFinding>> {
    const target = await reviewTarget(formData, "findingId");
    if (!target.ok) return target.error;
    const { user, input, analysis } = target;

    const result = await reviewFinding(analysis.id, input.targetId, input, user);
    if (!result.ok) {
        return result.code === "correction_label_required" ? actionError(result.message, { correctedLabel: result.message }) : actionError(result.message);
    }
    revalidateVideo(analysis.videoId, analysis.fighterId);
    return actionSuccess(`${DECISION_MESSAGES[input.decision]}: “${result.finding.title}”`, result.finding);
}

/** Coach decision on a single strike detection; corrections feed model retraining. */
export async function reviewDetectionAction(_prev: ActionState<Detection>, formData: FormData): Promise<ActionState<Detection>> {
    const target = await reviewTarget(formData, "detectionId");
    if (!target.ok) return target.error;
    const { user, input, analysis } = target;

    const result = await reviewDetection(analysis.id, input.targetId, input, user);
    if (!result.ok) {
        return result.code === "correction_label_required" ? actionError(result.message, { correctedLabel: result.message }) : actionError(result.message);
    }
    revalidateVideo(analysis.videoId, analysis.fighterId);
    return actionSuccess(`${DECISION_MESSAGES[input.decision]} detection`, result.detection);
}

const coachReviewSchema = z.object({
    analysisId: z.string().min(1),
    rating: z.coerce.number("Choose a rating from 1 to 5.").int("Choose a rating from 1 to 5.").min(1, "Choose a rating from 1 to 5.").max(5, "Choose a rating from 1 to 5."),
    summary: z
        .string()
        .trim()
        .min(10, "Write a short summary for the fighter (at least 10 characters).")
        .max(1500, "Keep the summary under 1,500 characters."),
});

/** Completes the coach review of an analysis; the fighter is notified by the service. */
export async function submitCoachReviewAction(_prev: ActionState<CoachReview>, formData: FormData): Promise<ActionState<CoachReview>> {
    const auth = await authorizeAction("ai_findings:review");
    if (!auth.ok) return actionError(auth.message);
    const parsed = coachReviewSchema.safeParse({
        analysisId: text(formData.get("analysisId")),
        rating: text(formData.get("rating")) ?? "",
        summary: text(formData.get("summary")) ?? "",
    });
    if (!parsed.success) return validationError(parsed.error);

    const analysis = await getAnalysis(parsed.data.analysisId);
    if (!analysis || !canAccessFighter(auth.user, analysis.fighterId)) return actionError("This analysis doesn't exist or you can't review it.");

    const result = await submitCoachReview(analysis.id, { rating: parsed.data.rating, summary: parsed.data.summary }, auth.user);
    if (!result.ok) {
        if (result.code === "invalid_rating") return actionError(result.message, { rating: result.message });
        if (result.code === "summary_required") return actionError(result.message, { summary: result.message });
        return actionError(result.message);
    }
    revalidateVideo(analysis.videoId, analysis.fighterId);
    if (!result.analysis.coachReview) return actionError("The review couldn't be saved. Try again.");
    return actionSuccess("Coach review saved. The fighter has been notified.", result.analysis.coachReview);
}
