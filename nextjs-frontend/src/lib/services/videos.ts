import "server-only";

import { mapWorkerResult, type WorkerResult } from "@/lib/api/worker-result";
import { PIPELINE_STAGES } from "@/lib/domain/labels";
import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIJob,
    AIModelTask,
    CameraAngle,
    Fighter,
    ModelVersions,
    PipelineStage,
    TrainingSession,
    User,
    Video,
    VideoStatus,
    VideoTrainingType,
} from "@/lib/domain/types";
import { formatConfidence } from "@/lib/format";
import { buildUploadScript, generateAnalysis, PRODUCTION_MODEL_VERSIONS } from "@/lib/mocks/ai-generation";
import { db, newId, nowIso, simulateLatency } from "@/lib/mocks/db";
import { createRandom } from "@/lib/mocks/random";
import { matchesSearch } from "@/lib/query";
import { routes } from "@/lib/routes";
import { TASK_ORDER } from "./ai";
import { recordAudit } from "./audit";
import { notifyUsers, staffUserIdsForFighter } from "./notifications";

/**
 * Training footage and its AI processing lifecycle.
 *
 * MOCK PIPELINE: footage uploaded (or re-queued) at runtime advances through the pipeline
 * stages by wall-clock time — about 4 s in the queue, then ~2.5 s per stage — and produces a
 * generated analysis when done. Seeded queued/processing jobs never advance on their own.
 */

type Failure<Code extends string> = { ok: false; code: Code; message: string };

const QUEUE_MS = 4_000;
const STAGE_MS = 2_500;
const WORK_STAGES: PipelineStage[] = PIPELINE_STAGES.filter((stage) => stage !== "queued" && stage !== "done");
const WORK_MS = STAGE_MS * WORK_STAGES.length;

const TASK_VERSION_KEY: Record<AIModelTask, keyof ModelVersions> = {
    fighter_detection: "detection",
    pose_estimation: "pose",
    action_recognition: "action",
    anomaly_detection: "anomaly",
};

/** Job ids that advance with wall-clock time. Kept on globalThis so hot reloads don't strand running uploads. */
const runtimeStore = globalThis as unknown as { __mmaRuntimeAIJobs?: Set<string> };
const runtimeJobIds = (runtimeStore.__mmaRuntimeAIJobs ??= new Set<string>());

/* ─── Mock pipeline ───────────────────────────────────────────────────────── */

/** Marks a queued job as processed by the mock pipeline (runtime uploads and retries only). */
export function trackRuntimeJob(jobId: string): void {
    runtimeJobIds.add(jobId);
}

/** Stops advancing a job (cancelled or deleted). */
export function untrackRuntimeJob(jobId: string): void {
    runtimeJobIds.delete(jobId);
}

/** Model ids used for new jobs: the active model of each pipeline task. */
function activePipelineModelIds(): string[] {
    const models = db().aiModels;
    return TASK_ORDER.map((task) => models.find((m) => m.task === task && m.status === "active")?.id).filter((id): id is string => id !== undefined);
}

function activeModelVersions(): ModelVersions {
    const versions = { ...PRODUCTION_MODEL_VERSIONS };
    for (const model of db().aiModels) {
        if (model.status === "active") versions[TASK_VERSION_KEY[model.task]] = `${model.name} ${model.version}`;
    }
    return versions;
}

function completeRuntimeJob(job: AIJob, finishedAtMs: number): void {
    const store = db();
    const video = store.videos.find((v) => v.id === job.videoId);
    const fighter = store.fighters.find((f) => f.id === job.fighterId);
    untrackRuntimeJob(job.id);
    if (!video || !fighter) {
        job.status = "failed";
        job.finishedAt = new Date(finishedAtMs).toISOString();
        job.errorCode = "VIDEO_NOT_FOUND";
        job.errorMessage = "The video was removed before processing finished.";
        return;
    }

    const processedAt = new Date(finishedAtMs).toISOString();
    const analysis = generateAnalysis(
        buildUploadScript({
            analysisId: `an-${video.id.replace(/^v-/, "")}`,
            jobId: job.id,
            video,
            fighter,
            processedAt,
            models: activeModelVersions(),
        }),
    );
    store.aiAnalyses = [analysis, ...store.aiAnalyses.filter((a) => a.id !== analysis.id && a.videoId !== video.id)];

    job.status = "completed";
    job.stage = "done";
    job.progressPct = 100;
    job.finishedAt = processedAt;
    job.durationSec = Math.round(WORK_MS / 1000);
    job.avgConfidence = analysis.overallConfidence;
    job.lowConfidence = analysis.overallConfidence < store.settings.aiLowConfidenceThreshold;
    job.errorCode = null;
    job.errorMessage = null;
    video.status = "completed";
    video.jobId = job.id;
    video.analysisId = analysis.id;

    recordAudit({
        actor: null,
        action: "ai_job.complete",
        resourceType: "ai_job",
        resourceId: job.id,
        resourceLabel: video.title,
        details: `${analysis.detections.length} detections, mean confidence ${formatConfidence(analysis.overallConfidence)}`,
    });
    const body = `“${video.title}” has been analysed: ${analysis.detections.length} strikes and ${analysis.findings.length} findings to look at.`;
    notifyUsers({
        userIds: staffUserIdsForFighter(fighter.id, ["fighter"]),
        category: "ai_analysis",
        severity: "success",
        title: "AI analysis ready",
        body,
        href: routes.fighter.video(video.id),
    });
    notifyUsers({
        userIds: staffUserIdsForFighter(fighter.id, ["coach"]),
        category: "ai_analysis",
        severity: "success",
        title: "AI analysis ready",
        body: `${fighter.name}: ${body}`,
        href: routes.coach.video(video.id),
    });
}

function advanceRuntimeJob(job: AIJob, nowMs: number): void {
    const video = db().videos.find((v) => v.id === job.videoId);
    const elapsed = nowMs - Date.parse(job.queuedAt);
    if (elapsed < QUEUE_MS) return;

    const working = elapsed - QUEUE_MS;
    job.startedAt ??= new Date(Date.parse(job.queuedAt) + QUEUE_MS).toISOString();
    job.workerId ??= `gpu-worker-0${createRandom(job.id).int(1, 4)}`;
    if (working >= WORK_MS) {
        completeRuntimeJob(job, Date.parse(job.queuedAt) + QUEUE_MS + WORK_MS);
        return;
    }
    job.status = "processing";
    job.stage = WORK_STAGES[Math.floor(working / STAGE_MS)];
    job.progressPct = Math.min(99, Math.max(1, Math.round((working / WORK_MS) * 100)));
    if (video && video.jobId === job.id) video.status = "processing";
}

/** Advances every runtime job to its current wall-clock state. Cheap; call before reading jobs or videos. */
export function syncRuntimeJobs(now: number = Date.now()): void {
    if (runtimeJobIds.size === 0) return;
    for (const jobId of [...runtimeJobIds]) {
        const job = db().aiJobs.find((j) => j.id === jobId);
        if (!job || (job.status !== "queued" && job.status !== "processing")) {
            untrackRuntimeJob(jobId);
            continue;
        }
        advanceRuntimeJob(job, now);
    }
}

/* ─── Queries ─────────────────────────────────────────────────────────────── */

export interface VideoFilter {
    fighterIds?: string[] | "all";
    status?: VideoStatus;
    trainingType?: VideoTrainingType;
    /** Matches title, file name, notes and fighter name. */
    search?: string;
    uploadedById?: string;
}

/** Videos matching the filter, newest upload first. */
export async function listVideos(filter: VideoFilter = {}): Promise<Video[]> {
    await simulateLatency();
    syncRuntimeJobs();
    const store = db();
    const fighterName = (id: string) => store.fighters.find((f) => f.id === id)?.name;
    return store.videos
        .filter(
            (v) =>
                (filter.fighterIds === undefined || filter.fighterIds === "all" || filter.fighterIds.includes(v.fighterId)) &&
                (!filter.status || v.status === filter.status) &&
                (!filter.trainingType || v.trainingType === filter.trainingType) &&
                (!filter.uploadedById || v.uploadedById === filter.uploadedById) &&
                matchesSearch(filter.search, v.title, v.fileName, v.notes, fighterName(v.fighterId)),
        )
        .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

/** A single video, or null. */
export async function getVideo(id: string): Promise<Video | null> {
    await simulateLatency();
    syncRuntimeJobs();
    return db().videos.find((v) => v.id === id) ?? null;
}

export interface VideoDetail {
    video: Video;
    fighter: Fighter;
    job: AIJob | null;
    analysis: AIAnalysis | null;
    /** AI movement observations raised on this footage. Pages decide who may see them. */
    alerts: AbnormalMovementAlert[];
    session: TrainingSession | null;
    uploadedBy: User | null;
}

/** Everything the video / analysis workspace needs in one read. */
export async function getVideoDetail(id: string): Promise<VideoDetail | null> {
    await simulateLatency();
    syncRuntimeJobs();
    const store = db();
    const video = store.videos.find((v) => v.id === id);
    const fighter = video ? store.fighters.find((f) => f.id === video.fighterId) : undefined;
    if (!video || !fighter) return null;
    return {
        video,
        fighter,
        job: store.aiJobs.find((j) => j.id === video.jobId) ?? null,
        analysis: store.aiAnalyses.find((a) => a.id === video.analysisId) ?? null,
        alerts: store.abnormalMovementAlerts.filter((a) => a.videoId === video.id).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt)),
        session: video.sessionId ? (store.trainingSessions.find((s) => s.id === video.sessionId) ?? null) : null,
        uploadedBy: store.users.find((u) => u.id === video.uploadedById) ?? null,
    };
}

/** Current state of a job, advancing mock processing for runtime uploads. Not delayed: used for polling. */
export async function getJobProgress(jobId: string): Promise<AIJob | null> {
    syncRuntimeJobs();
    return db().aiJobs.find((j) => j.id === jobId) ?? null;
}

export interface ReviewQueueItem {
    analysis: AIAnalysis;
    video: Video;
    fighter: Fighter;
    /** Findings without a human review. */
    unreviewedFindings: number;
    /** Findings below the low-confidence threshold that are still unreviewed. */
    lowConfidenceFindings: number;
    lowConfidenceDetections: number;
}

/** Completed analyses awaiting a coach review for the given fighters, newest first. */
export async function listReviewQueue(fighterIds: string[] | "all"): Promise<ReviewQueueItem[]> {
    await simulateLatency();
    syncRuntimeJobs();
    const store = db();
    const threshold = store.settings.aiLowConfidenceThreshold;
    return store.aiAnalyses
        .filter((a) => a.coachReview === null && (fighterIds === "all" || fighterIds.includes(a.fighterId)))
        .sort((a, b) => b.processedAt.localeCompare(a.processedAt))
        .flatMap<ReviewQueueItem>((analysis) => {
            const video = store.videos.find((v) => v.id === analysis.videoId);
            const fighter = store.fighters.find((f) => f.id === analysis.fighterId);
            if (!video || !fighter) return [];
            const unreviewed = analysis.findings.filter((f) => f.review === null);
            return [
                {
                    analysis,
                    video,
                    fighter,
                    unreviewedFindings: unreviewed.length,
                    lowConfidenceFindings: unreviewed.filter((f) => f.confidence < threshold).length,
                    lowConfidenceDetections: analysis.detections.filter((d) => d.confidence < threshold && d.review === null).length,
                },
            ];
        });
}

export interface VideoAnalysisSummary {
    analysisId: string;
    findings: number;
    /** Findings without a human review. */
    unreviewedFindings: number;
    /** Unreviewed detections below the low-confidence threshold. */
    lowConfidenceDetections: number;
    overallConfidence: number;
    coachReviewed: boolean;
}

export interface VideoLibraryItem {
    video: Video;
    fighter: Fighter;
    job: AIJob | null;
    analysis: VideoAnalysisSummary | null;
}

/** Videos for library grids with their job and a light analysis summary, newest upload first. */
export async function listVideoLibrary(filter: VideoFilter = {}): Promise<VideoLibraryItem[]> {
    const videos = await listVideos(filter);
    const store = db();
    const threshold = store.settings.aiLowConfidenceThreshold;
    return videos.flatMap<VideoLibraryItem>((video) => {
        const fighter = store.fighters.find((f) => f.id === video.fighterId);
        if (!fighter) return [];
        const analysis = store.aiAnalyses.find((a) => a.id === video.analysisId);
        return [
            {
                video,
                fighter,
                job: store.aiJobs.find((j) => j.id === video.jobId) ?? null,
                analysis: analysis
                    ? {
                          analysisId: analysis.id,
                          findings: analysis.findings.length,
                          unreviewedFindings: analysis.findings.filter((f) => f.review === null).length,
                          lowConfidenceDetections: analysis.detections.filter((d) => d.confidence < threshold && d.review === null).length,
                          overallConfidence: analysis.overallConfidence,
                          coachReviewed: analysis.coachReview !== null,
                      }
                    : null,
            },
        ];
    });
}

/** A job with its video for progress polling. Not delayed. */
export async function getJobPollState(jobId: string): Promise<{ job: AIJob; video: Video | null } | null> {
    syncRuntimeJobs();
    const store = db();
    const job = store.aiJobs.find((j) => j.id === jobId);
    if (!job) return null;
    return { job, video: store.videos.find((v) => v.id === job.videoId) ?? null };
}

/* ─── Mutations ───────────────────────────────────────────────────────────── */

export interface CreateVideoUploadInput {
    fighterId: string;
    title: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    fileName: string;
    fileSizeMb: number;
    durationSec: number;
    sessionId: string | null;
    notes: string | null;
}

export type CreateVideoUploadResult =
    | { ok: true; video: Video; job: AIJob }
    | Failure<"fighter_not_found" | "session_mismatch" | "unsupported_format" | "file_too_large" | "invalid_duration">;

/**
 * Registers uploaded footage and queues it for AI analysis. Mock uploads advance through the
 * pipeline automatically (see getJobProgress).
 */
export async function createVideoUpload(input: CreateVideoUploadInput, actor: User): Promise<CreateVideoUploadResult> {
    const store = db();
    const fighter = store.fighters.find((f) => f.id === input.fighterId);
    if (!fighter) return { ok: false, code: "fighter_not_found", message: "The selected fighter no longer exists." };

    const session = input.sessionId ? store.trainingSessions.find((s) => s.id === input.sessionId) : null;
    if (input.sessionId && (!session || session.fighterId !== fighter.id)) {
        return { ok: false, code: "session_mismatch", message: "The selected session does not belong to this fighter." };
    }
    const extension = input.fileName.split(".").pop()?.toLowerCase() ?? "";
    if (!store.settings.allowedVideoFormats.includes(extension)) {
        return { ok: false, code: "unsupported_format", message: `Supported video formats: ${store.settings.allowedVideoFormats.join(", ")}.` };
    }
    if (input.fileSizeMb > store.settings.videoMaxSizeMb) {
        return { ok: false, code: "file_too_large", message: `Videos can be at most ${store.settings.videoMaxSizeMb} MB.` };
    }
    if (!Number.isFinite(input.durationSec) || input.durationSec < 10 || input.durationSec > 900) {
        return { ok: false, code: "invalid_duration", message: "Videos must be between 10 seconds and 15 minutes long." };
    }

    const now = nowIso();
    const durationSec = Math.round(input.durationSec);
    const megabytesPerMinute = input.fileSizeMb / (durationSec / 60);
    const videoId = newId("v");
    const jobId = `job-${videoId.replace(/^v-/, "")}`;

    const video: Video = {
        id: videoId,
        fighterId: fighter.id,
        uploadedById: actor.id,
        sessionId: session?.id ?? null,
        title: input.title.trim(),
        trainingType: input.trainingType,
        cameraAngle: input.cameraAngle,
        fileName: input.fileName,
        fileSizeMb: Math.round(input.fileSizeMb * 10) / 10,
        durationSec,
        resolution: megabytesPerMinute >= 120 ? "3840x2160" : "1920x1080",
        fps: megabytesPerMinute >= 40 ? 60 : 30,
        uploadedAt: now,
        status: "queued",
        jobId,
        analysisId: null,
        sourceUrl: null,
        notes: input.notes?.trim() || null,
    };
    const job: AIJob = {
        id: jobId,
        videoId,
        fighterId: fighter.id,
        status: "queued",
        stage: "queued",
        progressPct: 0,
        modelIds: activePipelineModelIds(),
        workerId: null,
        attempts: 1,
        queuedAt: now,
        startedAt: null,
        finishedAt: null,
        durationSec: null,
        avgConfidence: null,
        lowConfidence: false,
        errorCode: null,
        errorMessage: null,
    };

    store.videos.unshift(video);
    store.aiJobs.unshift(job);
    if (session && !session.videoIds.includes(videoId)) session.videoIds.push(videoId);
    trackRuntimeJob(jobId);

    recordAudit({
        actor,
        action: "video.upload",
        resourceType: "video",
        resourceId: videoId,
        resourceLabel: video.title,
        details: `${fighter.name} · ${video.fileName} (${video.fileSizeMb} MB)`,
    });
    return { ok: true, video, job };
}

export interface RegisterExternalUploadInput extends CreateVideoUploadInput {
    /** Public URL of the footage in storage. */
    sourceUrl: string;
    /** Job id returned by the NestJS job API; used as the AI job id. */
    externalJobId: string;
}

export type RegisterExternalUploadResult = CreateVideoUploadResult | Failure<"duplicate_job">;

/**
 * Registers footage already uploaded to storage and queued on the real pipeline (API mode).
 * Same validation as mock uploads; the job is advanced by polling the job API, not by the mock pipeline.
 * A job id can be registered once, so a replayed request can't take over another upload's job.
 */
export async function registerExternalUpload(input: RegisterExternalUploadInput, actor: User): Promise<RegisterExternalUploadResult> {
    const store = db();
    if (store.aiJobs.some((j) => j.id === input.externalJobId) || store.videos.some((v) => v.jobId === input.externalJobId)) {
        return { ok: false, code: "duplicate_job", message: "This analysis job is already registered. Start the upload again." };
    }
    const result = await createVideoUpload(input, actor);
    if (!result.ok) return result;
    const { video, job } = result;
    untrackRuntimeJob(job.id);
    job.id = input.externalJobId;
    video.jobId = input.externalJobId;
    video.sourceUrl = input.sourceUrl;
    return { ok: true, video, job };
}

export type ExternalJobOutcome =
    | { status: "queued" }
    | { status: "processing"; stage: PipelineStage; progressPct: number }
    | { status: "completed"; result: WorkerResult; resultUrl: string }
    | { status: "failed"; errorCode: string; errorMessage: string };

export type RegisterExternalAnalysisResult = { ok: true; job: AIJob } | Failure<"not_found" | "invalid_state">;

/** Applies the latest state of a real-pipeline job; on completion maps and stores the worker result. */
export async function registerExternalAnalysis(jobId: string, outcome: ExternalJobOutcome): Promise<RegisterExternalAnalysisResult> {
    const store = db();
    const job = store.aiJobs.find((j) => j.id === jobId);
    const video = job ? store.videos.find((v) => v.id === job.videoId) : undefined;
    const fighter = video ? store.fighters.find((f) => f.id === video.fighterId) : undefined;
    if (!job || !video || !fighter) return { ok: false, code: "not_found", message: "This job no longer exists." };
    if (job.status === "completed" || job.status === "failed") {
        return { ok: false, code: "invalid_state", message: "This job has already finished." };
    }

    const now = nowIso();
    if (outcome.status === "queued") return { ok: true, job };
    if (outcome.status === "processing") {
        job.status = "processing";
        job.stage = outcome.stage;
        job.progressPct = Math.max(job.progressPct, Math.min(99, Math.round(outcome.progressPct)));
        job.startedAt ??= now;
        video.status = "processing";
        return { ok: true, job };
    }
    if (outcome.status === "failed") {
        job.status = "failed";
        job.finishedAt = now;
        job.durationSec = job.startedAt ? Math.round((Date.parse(now) - Date.parse(job.startedAt)) / 1000) : 0;
        job.errorCode = outcome.errorCode;
        job.errorMessage = outcome.errorMessage;
        video.status = "failed";
        recordAudit({ actor: null, action: "ai_job.fail", resourceType: "ai_job", resourceId: job.id, resourceLabel: video.title, status: "failure", details: outcome.errorMessage });
        return { ok: true, job };
    }

    const analysis = mapWorkerResult(outcome.result, {
        analysisId: `an-${video.id.replace(/^v-/, "")}`,
        videoId: video.id,
        jobId: job.id,
        fighterId: fighter.id,
        processedAt: now,
        trainingType: video.trainingType,
        fighterHeightCm: fighter.heightCm,
        models: activeModelVersions(),
        resultUrl: outcome.resultUrl,
    });
    store.aiAnalyses = [analysis, ...store.aiAnalyses.filter((a) => a.id !== analysis.id && a.videoId !== video.id)];
    job.status = "completed";
    job.stage = "done";
    job.progressPct = 100;
    job.startedAt ??= job.queuedAt;
    job.finishedAt = now;
    job.durationSec = Math.round((Date.parse(now) - Date.parse(job.startedAt)) / 1000);
    job.avgConfidence = analysis.overallConfidence;
    job.lowConfidence = analysis.overallConfidence < store.settings.aiLowConfidenceThreshold;
    video.status = "completed";
    video.analysisId = analysis.id;
    video.durationSec = Math.round(analysis.durationMs / 1000);
    video.fps = Math.round(analysis.fps);

    recordAudit({
        actor: null,
        action: "ai_job.complete",
        resourceType: "ai_job",
        resourceId: job.id,
        resourceLabel: video.title,
        details: `${analysis.detections.length} detections, mean confidence ${formatConfidence(analysis.overallConfidence)}`,
    });
    const body = `“${video.title}” has been analysed: ${analysis.detections.length} strikes and ${analysis.findings.length} findings to look at.`;
    notifyUsers({
        userIds: staffUserIdsForFighter(fighter.id, ["fighter"]),
        category: "ai_analysis",
        severity: "success",
        title: "AI analysis ready",
        body,
        href: routes.fighter.video(video.id),
    });
    notifyUsers({
        userIds: staffUserIdsForFighter(fighter.id, ["coach"]),
        category: "ai_analysis",
        severity: "success",
        title: "AI analysis ready",
        body: `${fighter.name}: ${body}`,
        href: routes.coach.video(video.id),
    });
    return { ok: true, job };
}

export type DeleteVideoResult = { ok: true; video: Video } | Failure<"not_found">;

/**
 * Deletes a video with its jobs and analysis. AI movement observations a doctor has already
 * reviewed (or linked to an injury) are kept as part of the clinical trail.
 */
export async function deleteVideo(id: string, actor: User): Promise<DeleteVideoResult> {
    const store = db();
    const video = store.videos.find((v) => v.id === id);
    if (!video) return { ok: false, code: "not_found", message: "This video no longer exists." };

    const jobs = store.aiJobs.filter((j) => j.videoId === id);
    jobs.forEach((j) => untrackRuntimeJob(j.id));
    const linkedAlertIds = new Set(store.injuries.map((i) => i.linkedAlertId).filter((alertId): alertId is string => alertId !== null));
    const removedAlerts = store.abnormalMovementAlerts.filter(
        (a) => a.videoId === id && a.doctorReview === null && a.linkedInjuryId === null && !linkedAlertIds.has(a.id),
    );

    store.videos = store.videos.filter((v) => v.id !== id);
    store.aiJobs = store.aiJobs.filter((j) => j.videoId !== id);
    store.aiAnalyses = store.aiAnalyses.filter((a) => a.videoId !== id);
    store.abnormalMovementAlerts = store.abnormalMovementAlerts.filter((a) => !removedAlerts.includes(a));
    for (const session of store.trainingSessions) {
        if (session.videoIds.includes(id)) session.videoIds = session.videoIds.filter((videoId) => videoId !== id);
    }
    for (const feedback of store.coachFeedback) {
        if (feedback.videoId === id) feedback.videoId = null;
    }

    recordAudit({
        actor,
        action: "video.delete",
        resourceType: "video",
        resourceId: id,
        resourceLabel: video.title,
        details: `Removed ${jobs.length} job(s), the analysis and ${removedAlerts.length} unreviewed AI observation(s)`,
    });
    return { ok: true, video };
}
