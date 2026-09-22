import "server-only";

import { AI_MODEL_STATUS_LABELS, ALERT_STATUS_LABELS, REVIEW_DECISION_LABELS } from "@/lib/domain/labels";
import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIFeedback,
    AIFinding,
    AIJob,
    AIJobStatus,
    AIModel,
    AIModelStatus,
    AIModelTask,
    AlertStatus,
    BodyRegion,
    CoachReview,
    Detection,
    DoctorDecision,
    Fighter,
    Injury,
    ReviewDecision,
    User,
    Video,
} from "@/lib/domain/types";
import { DAY_MS, dayKey } from "@/lib/format";
import { db, nowIso, simulateLatency } from "@/lib/mocks/db";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { average, round } from "@/lib/utils";
import { recordAudit } from "./audit.demo";
import { notifyUsers, staffUserIdsForFighter } from "./notifications.demo";
import { syncRuntimeJobs, trackRuntimeJob, untrackRuntimeJob } from "./videos.demo";

/**
 * AI analysis review, pipeline jobs, model registry and abnormal movement observations.
 * Authorization happens in pages and actions; these functions only enforce data rules.
 */

type Failure<Code extends string> = { ok: false; code: Code; message: string };

function videoHref(user: Pick<User, "role"> | undefined, videoId: string): string {
    switch (user?.role) {
        case "fighter":
            return routes.fighter.video(videoId);
        case "coach":
            return routes.coach.video(videoId);
        case "admin":
            return routes.admin.videos;
        default:
            return routes.notifications;
    }
}

/** Audit action per review decision, matching the seeded audit trail. */
const REVIEW_AUDIT_ACTIONS: Record<ReviewDecision, string> = {
    confirmed: "ai_finding.confirm",
    corrected: "ai_finding.correct",
    rejected: "ai_finding.reject",
};

/* ─── Analyses & human review ─────────────────────────────────────────────── */

/** A single analysis, or null. */
export async function getAnalysis(id: string): Promise<AIAnalysis | null> {
    await simulateLatency();
    syncRuntimeJobs();
    return db().aiAnalyses.find((a) => a.id === id) ?? null;
}

export interface AIReviewInput {
    decision: ReviewDecision;
    note: string | null;
    /** Required when the decision is "corrected". */
    correctedLabel: string | null;
}

export type ReviewFindingResult = { ok: true; finding: AIFinding } | Failure<"not_found" | "correction_label_required">;
export type ReviewDetectionResult = { ok: true; detection: Detection } | Failure<"not_found" | "correction_label_required">;

function feedbackFrom(input: AIReviewInput, actor: User): AIFeedback | Failure<"correction_label_required"> {
    const correctedLabel = input.correctedLabel?.trim() || null;
    if (input.decision === "corrected" && !correctedLabel) {
        return { ok: false, code: "correction_label_required", message: "Enter the correct label for this AI output." };
    }
    return {
        decision: input.decision,
        reviewerId: actor.id,
        reviewerName: actor.name,
        reviewedAt: nowIso(),
        note: input.note?.trim() || null,
        correctedLabel: input.decision === "corrected" ? correctedLabel : null,
    };
}

function reviewDetails(feedback: AIFeedback, aiLabel: string): string {
    const decision = REVIEW_DECISION_LABELS[feedback.decision];
    return feedback.correctedLabel ? `${decision}: “${aiLabel}” → “${feedback.correctedLabel}”` : `${decision}: “${aiLabel}”`;
}

/** Records a coach's confirm / correct / reject decision on an AI finding. */
export async function reviewFinding(analysisId: string, findingId: string, input: AIReviewInput, actor: User): Promise<ReviewFindingResult> {
    const finding = db()
        .aiAnalyses.find((a) => a.id === analysisId)
        ?.findings.find((f) => f.id === findingId);
    if (!finding) return { ok: false, code: "not_found", message: "This finding no longer exists." };

    const feedback = feedbackFrom(input, actor);
    if ("ok" in feedback) return feedback;
    finding.review = feedback;

    recordAudit({
        actor,
        action: REVIEW_AUDIT_ACTIONS[feedback.decision],
        resourceType: "ai_finding",
        resourceId: finding.id,
        resourceLabel: finding.title,
        details: reviewDetails(feedback, finding.title),
    });
    return { ok: true, finding };
}

/** Records a human decision on a single strike detection (doubles as model feedback). */
export async function reviewDetection(analysisId: string, detectionId: string, input: AIReviewInput, actor: User): Promise<ReviewDetectionResult> {
    const detection = db()
        .aiAnalyses.find((a) => a.id === analysisId)
        ?.detections.find((d) => d.id === detectionId);
    if (!detection) return { ok: false, code: "not_found", message: "This detection no longer exists." };

    const feedback = feedbackFrom(input, actor);
    if ("ok" in feedback) return feedback;
    detection.review = feedback;

    recordAudit({
        actor,
        action: REVIEW_AUDIT_ACTIONS[feedback.decision],
        resourceType: "ai_finding",
        resourceId: detection.id,
        resourceLabel: `Detection ${detection.id} in ${analysisId}`,
        details: reviewDetails(feedback, detection.type),
    });
    return { ok: true, detection };
}

export interface CoachReviewInput {
    /** Overall rating of the footage, 1–5. */
    rating: number;
    summary: string;
}

export type SubmitCoachReviewResult = { ok: true; analysis: AIAnalysis } | Failure<"not_found" | "invalid_rating" | "summary_required">;

/** Completes the coach review of an analysis and tells the fighter. */
export async function submitCoachReview(analysisId: string, input: CoachReviewInput, actor: User): Promise<SubmitCoachReviewResult> {
    const store = db();
    const analysis = store.aiAnalyses.find((a) => a.id === analysisId);
    if (!analysis) return { ok: false, code: "not_found", message: "This analysis no longer exists." };
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        return { ok: false, code: "invalid_rating", message: "Rate the footage from 1 to 5." };
    }
    const summary = input.summary.trim();
    if (!summary) return { ok: false, code: "summary_required", message: "Add a short summary for the fighter." };

    const review: CoachReview = { reviewerId: actor.id, reviewerName: actor.name, reviewedAt: nowIso(), rating: input.rating, summary };
    analysis.coachReview = review;

    const video = store.videos.find((v) => v.id === analysis.videoId);
    const fighter = store.fighters.find((f) => f.id === analysis.fighterId);
    recordAudit({
        actor,
        action: "ai_analysis.coach_review",
        resourceType: "video",
        resourceId: analysis.videoId,
        resourceLabel: video?.title ?? analysis.id,
        details: `Rating ${input.rating}/5 · ${analysis.findings.filter((f) => f.review !== null).length}/${analysis.findings.length} findings reviewed`,
    });
    if (fighter) {
        notifyUsers({
            userIds: [fighter.userId].filter((id) => id !== actor.id),
            category: "ai_analysis",
            severity: "success",
            title: "Coach reviewed your analysis",
            body: `${actor.name} reviewed “${video?.title ?? "your video"}” and left a summary.`,
            href: routes.fighter.video(analysis.videoId),
        });
    }
    return { ok: true, analysis };
}

/* ─── AI jobs ─────────────────────────────────────────────────────────────── */

export interface AIJobFilter {
    status?: AIJobStatus;
    lowConfidence?: boolean;
    /** Matches job id, video title, file name, fighter name, worker and error code. */
    search?: string;
}

export interface AIJobListItem {
    job: AIJob;
    video: Video | null;
    fighter: Fighter | null;
}

/** Pipeline jobs, newest queued first. */
export async function listAIJobs(filter: AIJobFilter = {}): Promise<AIJobListItem[]> {
    await simulateLatency();
    syncRuntimeJobs();
    const store = db();
    return store.aiJobs
        .map<AIJobListItem>((job) => ({
            job,
            video: store.videos.find((v) => v.id === job.videoId) ?? null,
            fighter: store.fighters.find((f) => f.id === job.fighterId) ?? null,
        }))
        .filter(
            ({ job, video, fighter }) =>
                (!filter.status || job.status === filter.status) &&
                (filter.lowConfidence === undefined || job.lowConfidence === filter.lowConfidence) &&
                matchesSearch(filter.search, job.id, video?.title, video?.fileName, fighter?.name, job.workerId, job.errorCode),
        )
        .sort((a, b) => b.job.queuedAt.localeCompare(a.job.queuedAt));
}

/** Operational summary of an analysis — no findings, detections or movement observations. */
export interface AIAnalysisSummary {
    id: string;
    processedAt: string;
    durationMs: number;
    fps: number;
    overallConfidence: number;
    trackingQuality: number;
    detectionCount: number;
    lowConfidenceDetectionCount: number;
    combinationCount: number;
    findingCount: number;
}

export interface AIJobDetail {
    job: AIJob;
    video: Video | null;
    fighter: Fighter | null;
    models: AIModel[];
    analysis: AIAnalysisSummary | null;
    /** Other runs for the same video (earlier failures or re-runs), newest first. */
    otherRuns: AIJob[];
}

/** A job with its video, models and a non-clinical analysis summary (admin AI Jobs detail). */
export async function getAIJobDetail(id: string): Promise<AIJobDetail | null> {
    await simulateLatency();
    syncRuntimeJobs();
    const store = db();
    const job = store.aiJobs.find((j) => j.id === id);
    if (!job) return null;
    const threshold = store.settings.aiLowConfidenceThreshold;
    const analysis = store.aiAnalyses.find((a) => a.jobId === job.id);
    return {
        job,
        video: store.videos.find((v) => v.id === job.videoId) ?? null,
        fighter: store.fighters.find((f) => f.id === job.fighterId) ?? null,
        models: job.modelIds.map((modelId) => store.aiModels.find((m) => m.id === modelId)).filter((m): m is AIModel => m !== undefined),
        analysis: analysis
            ? {
                  id: analysis.id,
                  processedAt: analysis.processedAt,
                  durationMs: analysis.durationMs,
                  fps: analysis.fps,
                  overallConfidence: analysis.overallConfidence,
                  trackingQuality: analysis.trackingQuality,
                  detectionCount: analysis.detections.length,
                  lowConfidenceDetectionCount: analysis.detections.filter((d) => d.confidence < threshold).length,
                  combinationCount: analysis.combinations.length,
                  findingCount: analysis.findings.length,
              }
            : null,
        otherRuns: store.aiJobs.filter((j) => j.videoId === job.videoId && j.id !== job.id).sort((a, b) => b.queuedAt.localeCompare(a.queuedAt)),
    };
}

export type JobActionResult = { ok: true; job: AIJob } | Failure<"not_found" | "invalid_state">;

/** Re-queues a failed job (attempts + 1). The mock pipeline then processes it like a new upload. */
export async function retryJob(id: string, actor: User): Promise<JobActionResult> {
    const store = db();
    const job = store.aiJobs.find((j) => j.id === id);
    if (!job) return { ok: false, code: "not_found", message: "This job no longer exists." };
    if (job.status !== "failed") return { ok: false, code: "invalid_state", message: "Only failed jobs can be retried." };

    const previousError = job.errorCode;
    job.status = "queued";
    job.stage = "queued";
    job.progressPct = 0;
    job.attempts += 1;
    job.queuedAt = nowIso();
    job.startedAt = null;
    job.finishedAt = null;
    job.durationSec = null;
    job.workerId = null;
    job.avgConfidence = null;
    job.lowConfidence = false;
    job.errorCode = null;
    job.errorMessage = null;
    const video = store.videos.find((v) => v.id === job.videoId);
    if (video) {
        video.status = "queued";
        video.jobId = job.id;
    }
    trackRuntimeJob(job.id);

    recordAudit({
        actor,
        action: "ai_job.retry",
        resourceType: "ai_job",
        resourceId: job.id,
        resourceLabel: video?.title ?? job.id,
        details: `Attempt ${job.attempts} (previous error: ${previousError ?? "none"})`,
    });
    return { ok: true, job };
}

/** Cancels a queued or processing job; the uploader is told processing stopped. */
export async function cancelJob(id: string, actor: User): Promise<JobActionResult> {
    const store = db();
    syncRuntimeJobs();
    const job = store.aiJobs.find((j) => j.id === id);
    if (!job) return { ok: false, code: "not_found", message: "This job no longer exists." };
    if (job.status !== "queued" && job.status !== "processing") {
        return { ok: false, code: "invalid_state", message: "Only queued or processing jobs can be cancelled." };
    }

    const finishedAt = nowIso();
    untrackRuntimeJob(job.id);
    job.status = "failed";
    job.finishedAt = finishedAt;
    job.durationSec = job.startedAt ? Math.round((Date.parse(finishedAt) - Date.parse(job.startedAt)) / 1000) : 0;
    job.errorCode = "CANCELLED";
    job.errorMessage = `Cancelled by ${actor.name}`;
    const video = store.videos.find((v) => v.id === job.videoId);
    if (video && video.jobId === job.id) video.status = "failed";

    recordAudit({
        actor,
        action: "ai_job.cancel",
        resourceType: "ai_job",
        resourceId: job.id,
        resourceLabel: video?.title ?? job.id,
        details: `Stopped at stage ${job.stage} (${job.progressPct}%)`,
    });
    if (video && video.uploadedById !== actor.id) {
        const uploader = store.users.find((u) => u.id === video.uploadedById);
        notifyUsers({
            userIds: [video.uploadedById],
            category: "ai_analysis",
            severity: "warning",
            title: "AI processing cancelled",
            body: `Processing of “${video.title}” was cancelled by an administrator. You can upload the video again.`,
            href: videoHref(uploader, video.id),
        });
    }
    return { ok: true, job };
}

export interface AIJobStats {
    last24h: { completed: number; failed: number; processing: number; queued: number };
    /** Failed share of jobs finished in the last 7 days, 0–100. */
    failureRate7d: number;
    /** Mean processing time of jobs completed in the last 7 days, seconds. */
    avgDurationSec7d: number;
    /** Low-confidence share of jobs completed in the last 7 days, 0–100. */
    lowConfidenceRate7d: number;
    /** One entry per calendar day (academy timezone), oldest first, 14 days ending today. */
    dailyThroughput: { date: string; completed: number; failed: number }[];
}

/**
 * Pipeline health for the admin dashboard. `last24h.completed/failed` count jobs finished in the
 * last 24 hours; `processing/queued` are the jobs currently in flight.
 */
export async function getAIJobStats(now: Date = new Date()): Promise<AIJobStats> {
    await simulateLatency();
    syncRuntimeJobs(now.getTime());
    const jobs = db().aiJobs;
    const nowMs = now.getTime();
    const finishedWithin = (ms: number) => jobs.filter((j) => j.finishedAt !== null && nowMs - Date.parse(j.finishedAt) <= ms && Date.parse(j.finishedAt) <= nowMs);

    const day = finishedWithin(DAY_MS);
    const week = finishedWithin(7 * DAY_MS);
    const weekCompleted = week.filter((j) => j.status === "completed");
    const weekFailed = week.filter((j) => j.status === "failed");
    const pct = (part: number, whole: number) => (whole === 0 ? 0 : round((part / whole) * 100, 1));

    const dailyThroughput = Array.from({ length: 14 }, (_, i) => {
        const date = dayKey(new Date(nowMs - (13 - i) * DAY_MS));
        const onDay = jobs.filter((j) => j.finishedAt !== null && dayKey(j.finishedAt) === date);
        return { date, completed: onDay.filter((j) => j.status === "completed").length, failed: onDay.filter((j) => j.status === "failed").length };
    });

    return {
        last24h: {
            completed: day.filter((j) => j.status === "completed").length,
            failed: day.filter((j) => j.status === "failed").length,
            processing: jobs.filter((j) => j.status === "processing").length,
            queued: jobs.filter((j) => j.status === "queued").length,
        },
        failureRate7d: pct(weekFailed.length, week.length),
        avgDurationSec7d: Math.round(average(weekCompleted.map((j) => j.durationSec ?? 0))),
        lowConfidenceRate7d: pct(weekCompleted.filter((j) => j.lowConfidence).length, weekCompleted.length),
        dailyThroughput,
    };
}

/* ─── Model registry ──────────────────────────────────────────────────────── */

/** Pipeline tasks in processing order. */
export const TASK_ORDER: AIModelTask[] = ["fighter_detection", "pose_estimation", "action_recognition", "anomaly_detection"];
const STATUS_ORDER: AIModelStatus[] = ["active", "staging", "deprecated"];

/** Models grouped by pipeline task, active first. */
export async function listAIModels(): Promise<AIModel[]> {
    await simulateLatency();
    return [...db().aiModels].sort(
        (a, b) =>
            TASK_ORDER.indexOf(a.task) - TASK_ORDER.indexOf(b.task) ||
            STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) ||
            b.deployedAt.localeCompare(a.deployedAt),
    );
}

/** A single model, or null. */
export async function getAIModel(id: string): Promise<AIModel | null> {
    await simulateLatency();
    return db().aiModels.find((m) => m.id === id) ?? null;
}

export interface ModelThresholdsInput {
    /** Detections below this are discarded. */
    confidenceThreshold: number;
    /** Detections below this are kept but flagged for human review. */
    lowConfidenceThreshold: number;
}

export type ModelResult = { ok: true; model: AIModel } | Failure<"not_found" | "invalid_thresholds" | "last_active_model">;

/** Updates a model's thresholds. Requires 0 < confidence < low-confidence < 1. */
export async function updateModelThresholds(id: string, input: ModelThresholdsInput, actor: User): Promise<ModelResult> {
    const model = db().aiModels.find((m) => m.id === id);
    if (!model) return { ok: false, code: "not_found", message: "This model no longer exists." };
    const { confidenceThreshold, lowConfidenceThreshold } = input;
    if (!(confidenceThreshold > 0 && confidenceThreshold < lowConfidenceThreshold && lowConfidenceThreshold < 1)) {
        return {
            ok: false,
            code: "invalid_thresholds",
            message: "The confidence threshold must be above 0 and below the low-confidence threshold, which must be below 1.",
        };
    }

    const details = `Confidence ${model.confidenceThreshold} → ${confidenceThreshold}; low confidence ${model.lowConfidenceThreshold} → ${lowConfidenceThreshold}`;
    model.confidenceThreshold = round(confidenceThreshold, 2);
    model.lowConfidenceThreshold = round(lowConfidenceThreshold, 2);
    recordAudit({ actor, action: "ai_model.update_thresholds", resourceType: "ai_model", resourceId: model.id, resourceLabel: `${model.name} ${model.version}`, details });
    return { ok: true, model };
}

/**
 * Changes a model's lifecycle status. Promoting to active deprecates the currently active model
 * for the same task; a task can't be left without an active model.
 */
export async function setModelStatus(id: string, status: AIModelStatus, actor: User): Promise<ModelResult> {
    const models = db().aiModels;
    const model = models.find((m) => m.id === id);
    if (!model) return { ok: false, code: "not_found", message: "This model no longer exists." };
    if (model.status === status) return { ok: true, model };
    if (model.status === "active") {
        return {
            ok: false,
            code: "last_active_model",
            message: "Promote another model for this task first — the pipeline always needs one active model per task.",
        };
    }

    const previous = model.status;
    const replaced = status === "active" ? models.filter((m) => m.task === model.task && m.status === "active") : [];
    replaced.forEach((m) => (m.status = "deprecated"));
    model.status = status;
    if (status === "active") model.deployedAt = nowIso();

    recordAudit({
        actor,
        action: "ai_model.status_change",
        resourceType: "ai_model",
        resourceId: model.id,
        resourceLabel: `${model.name} ${model.version}`,
        details: [
            `${AI_MODEL_STATUS_LABELS[previous]} → ${AI_MODEL_STATUS_LABELS[status]}`,
            ...replaced.map((m) => `${m.name} ${m.version} deprecated`),
        ].join("; "),
    });
    return { ok: true, model };
}

/* ─── AI movement observations (abnormal movement alerts) ─────────────────── */

export interface AlertFilter {
    fighterIds?: string[] | "all";
    status?: AlertStatus;
    bodyRegion?: BodyRegion;
}

/** Movement observations, newest first. */
export async function listAlerts(filter: AlertFilter = {}): Promise<AbnormalMovementAlert[]> {
    await simulateLatency();
    return db()
        .abnormalMovementAlerts.filter(
            (a) =>
                (filter.fighterIds === undefined || filter.fighterIds === "all" || filter.fighterIds.includes(a.fighterId)) &&
                (!filter.status || a.status === filter.status) &&
                (!filter.bodyRegion || a.bodyRegion === filter.bodyRegion),
        )
        .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export interface AlertDetail {
    alert: AbnormalMovementAlert;
    fighter: Fighter | null;
    /** Null when the footage was deleted after a doctor reviewed the observation. */
    video: Video | null;
    analysis: AIAnalysis | null;
    linkedInjury: Injury | null;
}

/** An observation with its footage, analysis and any injury it was linked to. */
export async function getAlertDetail(id: string): Promise<AlertDetail | null> {
    await simulateLatency();
    const store = db();
    const alert = store.abnormalMovementAlerts.find((a) => a.id === id);
    if (!alert) return null;
    return {
        alert,
        fighter: store.fighters.find((f) => f.id === alert.fighterId) ?? null,
        video: store.videos.find((v) => v.id === alert.videoId) ?? null,
        analysis: store.aiAnalyses.find((a) => a.id === alert.analysisId) ?? null,
        linkedInjury: store.injuries.find((i) => i.id === alert.linkedInjuryId || i.linkedAlertId === alert.id) ?? null,
    };
}

export interface AlertReviewInput {
    decision: DoctorDecision;
    note: string;
}

export type ReviewAlertResult = { ok: true; alert: AbnormalMovementAlert } | Failure<"not_found" | "note_required">;

/**
 * Records a doctor's decision on an observation. Coaches are told only when a follow-up is
 * scheduled, without clinical detail.
 */
export async function reviewAlert(id: string, input: AlertReviewInput, actor: User): Promise<ReviewAlertResult> {
    const store = db();
    const alert = store.abnormalMovementAlerts.find((a) => a.id === id);
    if (!alert) return { ok: false, code: "not_found", message: "This observation no longer exists." };
    const note = input.note.trim();
    if (!note) return { ok: false, code: "note_required", message: "Add a short note explaining your decision." };

    const previous = alert.status;
    alert.status = input.decision;
    alert.doctorReview = { decision: input.decision, reviewerId: actor.id, reviewerName: actor.name, reviewedAt: nowIso(), note };

    const fighter = store.fighters.find((f) => f.id === alert.fighterId);
    recordAudit({
        actor,
        action: "ai_alert.review",
        resourceType: "ai_alert",
        resourceId: alert.id,
        // Administrators read the audit log, so the label stays free of clinical detail.
        resourceLabel: `${fighter?.name ?? alert.fighterId} — AI movement observation`,
        details: `${ALERT_STATUS_LABELS[previous]} → ${ALERT_STATUS_LABELS[input.decision]}`,
    });
    if (input.decision === "follow_up" && fighter) {
        notifyUsers({
            userIds: staffUserIdsForFighter(fighter.id, ["coach"]).filter((userId) => userId !== actor.id),
            category: "medical",
            severity: "info",
            title: "Medical follow-up scheduled",
            body: `${actor.name} has scheduled a follow-up for ${fighter.name} after reviewing recent training footage. Check the Medical Clearance before planning intensive sessions.`,
            href: routes.coach.clearance,
        });
    }
    return { ok: true, alert };
}
