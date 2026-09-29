import "server-only";

import { z } from "zod";

import { authenticatedApiRequest, authenticatedMutableApiRequest, drainAuthenticatedCursorPages } from "@/lib/api/client";
import { mapWorkerResult, workerResultSchema } from "@/lib/api/worker-result";
import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type {
    AbnormalMovementAlert,
    AIAnalysis,
    AIJob,
    Fighter,
    TrainingSession,
    User,
    Video,
    VideoStatus,
    VideoTrainingType,
} from "@/lib/domain/types";
import { nullIfNotFound } from "./api-helpers";
import { getFighter } from "./people";

const demoService = () => import("./videos.demo");

type Failure<Code extends string> = { ok: false; code: Code; message: string };

const backendVideoSchema = z.object({
    id: z.string().uuid(),
    fighterId: z.string().uuid(),
    uploadedById: z.string().uuid(),
    sessionId: z.string().uuid().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    trainingType: z.enum(["SHADOW_BOXING", "PAD_WORK", "HEAVY_BAG", "SPARRING"]),
    cameraAngle: z.enum(["FRONT", "SIDE", "DIAGONAL", "CORNER", "OVERHEAD", "UNKNOWN"]),
    status: z.enum(["PENDING_UPLOAD", "UPLOAD_COMPLETE", "PROCESSING", "PROCESSED", "REJECTED", "FAILED"]),
    originalFilename: z.string().nullable(),
    fileSizeBytes: z.number().int().positive(),
    mimeType: z.string(),
    durationMs: z.number().int().positive().nullable(),
    sourceUrl: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const backendJobSchema = z
    .object({
        id: z.string().uuid(),
        videoId: z.string().uuid().nullable(),
        fighterId: z.string().uuid().nullable(),
        status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]),
        score: z.number().nullable(),
        resultUrl: z.string().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
        errorCode: z.string().nullable().optional(),
        errorMessage: z.string().nullable().optional(),
    })
    .passthrough();

type BackendVideo = z.output<typeof backendVideoSchema>;
type BackendJob = z.output<typeof backendJobSchema>;

function mapJob(job: BackendJob): AIJob {
    const status = job.status === "PENDING" ? "queued" : job.status === "PROCESSING" ? "processing" : job.status === "DONE" ? "completed" : "failed";
    return {
        id: job.id,
        videoId: job.videoId ?? "",
        fighterId: job.fighterId ?? "",
        status,
        stage: status === "queued" ? "queued" : status === "processing" ? "action_recognition" : status === "completed" ? "done" : "findings",
        progressPct: status === "queued" ? 0 : status === "processing" ? 50 : status === "completed" ? 100 : 0,
        modelIds: [],
        workerId: null,
        attempts: 1,
        queuedAt: job.createdAt,
        startedAt: status === "queued" ? null : job.updatedAt,
        finishedAt: status === "completed" || status === "failed" ? job.updatedAt : null,
        durationSec: null,
        avgConfidence: job.score === null ? null : job.score / 100,
        lowConfidence: false,
        errorCode: job.errorCode ?? null,
        errorMessage: job.errorMessage ?? null,
    };
}

function mapVideo(video: BackendVideo, job: AIJob | null): Video {
    const trainingType = video.trainingType.toLowerCase() as VideoTrainingType;
    const status: VideoStatus = job?.status ?? (video.status === "FAILED" || video.status === "REJECTED" ? "failed" : video.status === "PROCESSED" ? "completed" : video.status === "PROCESSING" ? "processing" : "queued");
    return {
        id: video.id,
        fighterId: video.fighterId,
        uploadedById: video.uploadedById,
        sessionId: video.sessionId,
        title: video.title,
        trainingType,
        cameraAngle: video.cameraAngle === "FRONT" ? "front" : video.cameraAngle === "SIDE" ? "side" : "diagonal",
        fileName: video.originalFilename ?? "video",
        fileSizeMb: video.fileSizeBytes / (1024 * 1024),
        durationSec: Math.round((video.durationMs ?? 0) / 1000),
        resolution: "Pending metadata",
        fps: 0,
        uploadedAt: video.createdAt,
        status,
        jobId: job?.id ?? null,
        analysisId: null,
        sourceUrl: `/api/videos/${video.id}/content`,
        notes: video.description,
    };
}

async function listApiJobs(): Promise<AIJob[]> {
    return (await authenticatedApiRequest("/jobs", z.array(backendJobSchema))).map(mapJob);
}

function apiVideo(id: string): Promise<BackendVideo | null> {
    return nullIfNotFound(authenticatedApiRequest(`/videos/${encodeURIComponent(id)}`, backendVideoSchema));
}

export interface VideoFilter {
    fighterIds?: string[] | "all";
    status?: VideoStatus;
    trainingType?: VideoTrainingType;
    /** Matches title, file name, notes and fighter name. */
    search?: string;
    uploadedById?: string;
}

export async function listVideos(filter: VideoFilter = {}): Promise<Video[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listVideos(filter);
    if (Array.isArray(filter.fighterIds) && filter.fighterIds.length === 0) return [];
    const query = new URLSearchParams({ limit: "100" });
    if (filter.fighterIds !== undefined && filter.fighterIds !== "all" && filter.fighterIds.length === 1) query.set("fighterId", filter.fighterIds[0]);
    if (filter.trainingType) query.set("trainingType", filter.trainingType.toUpperCase());
    if (filter.search) query.set("search", filter.search);
    const [backendVideos, jobs] = await Promise.all([
        drainAuthenticatedCursorPages(`/videos?${query.toString()}`, backendVideoSchema, { maxItems: 500, maxPages: 5 }),
        listApiJobs(),
    ]);
    const byVideo = new Map(jobs.filter((job) => job.videoId).map((job) => [job.videoId, job]));
    return backendVideos
        .map((video) => mapVideo(video, byVideo.get(video.id) ?? null))
        .filter((video) => (filter.fighterIds === undefined || filter.fighterIds === "all" || filter.fighterIds.includes(video.fighterId)) && (!filter.status || video.status === filter.status) && (!filter.uploadedById || video.uploadedById === filter.uploadedById));
}

export async function getVideo(id: string): Promise<Video | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getVideo(id);
    const [video, jobs] = await Promise.all([apiVideo(id), listApiJobs()]);
    if (!video) return null;
    return mapVideo(video, jobs.find((job) => job.videoId === id) ?? null);
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

export async function getVideoDetail(id: string): Promise<VideoDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getVideoDetail(id);
    const video = await getVideo(id);
    if (!video) return null;
    const fighter = await getFighter(video.fighterId);
    if (!fighter) return null;
    const job = video.jobId ? await getJobProgress(video.jobId) : null;
    let analysis: AIAnalysis | null = null;
    if (job?.status === "completed") {
        const result = await authenticatedApiRequest(`/jobs/${encodeURIComponent(job.id)}/result`, workerResultSchema);
        analysis = mapWorkerResult(result, {
            analysisId: `an-${job.id}`,
            videoId: video.id,
            jobId: job.id,
            fighterId: fighter.id,
            processedAt: job.finishedAt ?? new Date().toISOString(),
            trainingType: video.trainingType,
            fighterHeightCm: fighter.heightCm || 175,
            models: {
                detection: "YOLO pose pipeline",
                pose: "YOLO pose pipeline",
                action: "MMA-TMS action pipeline",
                anomaly: "MMA-TMS health monitor",
            },
            resultUrl: `/api/ai-jobs/${job.id}/result`,
        });
        video.analysisId = analysis.id;
    }
    return { video, fighter, job, analysis, alerts: [], session: null, uploadedBy: null };
}

export async function getJobProgress(jobId: string): Promise<AIJob | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getJobProgress(jobId);
    const job = await nullIfNotFound(authenticatedApiRequest(`/jobs/${encodeURIComponent(jobId)}`, backendJobSchema));
    return job && mapJob(job);
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

export async function listReviewQueue(fighterIds: string[] | "all"): Promise<ReviewQueueItem[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listReviewQueue(fighterIds);
    return [];
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

export async function listVideoLibrary(filter: VideoFilter = {}): Promise<VideoLibraryItem[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listVideoLibrary(filter);
    const videos = await listVideos(filter);
    const fighters = await Promise.all([...new Set(videos.map((video) => video.fighterId))].map(getFighter));
    const byId = new Map(fighters.filter((fighter): fighter is Fighter => fighter !== null).map((fighter) => [fighter.id, fighter]));
    return videos.flatMap((video) => {
        const fighter = byId.get(video.fighterId);
        return fighter ? [{ video, fighter, job: null, analysis: null }] : [];
    });
}

export async function getJobPollState(jobId: string): Promise<{ job: AIJob; video: Video | null } | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getJobPollState(jobId);
    const job = await getJobProgress(jobId);
    return job ? { job, video: job.videoId ? await getVideo(job.videoId) : null } : null;
}

export interface CreateVideoUploadInput {
    fighterId: string;
    title: string;
    trainingType: VideoTrainingType;
    cameraAngle: Video["cameraAngle"];
    fileName: string;
    fileSizeMb: number;
    durationSec: number;
    sessionId: string | null;
    notes: string | null;
}

export type CreateVideoUploadResult =
    | { ok: true; video: Video; job: AIJob }
    | Failure<"fighter_not_found" | "session_mismatch" | "unsupported_format" | "file_too_large" | "invalid_duration">;

export async function createVideoUpload(input: CreateVideoUploadInput, actor: User): Promise<CreateVideoUploadResult> {
    if (isDemoAuthEnabled()) return (await demoService()).createVideoUpload(input, actor);
    throw new Error("Video uploads in API mode must use the streaming upload route.");
}

export interface RegisterExternalUploadInput extends CreateVideoUploadInput {
    /** Public URL of the footage in storage. */
    sourceUrl: string;
    /** Job id returned by the NestJS job API; used as the AI job id. */
    externalJobId: string;
}

export type RegisterExternalUploadResult = CreateVideoUploadResult | Failure<"duplicate_job">;

export async function registerExternalUpload(input: RegisterExternalUploadInput, actor: User): Promise<RegisterExternalUploadResult> {
    if (isDemoAuthEnabled()) return (await demoService()).registerExternalUpload(input, actor);
    throw new Error("The backend already persists API-mode video uploads.");
}

export type DeleteVideoResult = { ok: true; video: Video } | Failure<"not_found">;

export async function deleteVideo(id: string, actor: User): Promise<DeleteVideoResult> {
    if (isDemoAuthEnabled()) return (await demoService()).deleteVideo(id, actor);
    const video = await getVideo(id);
    if (!video) return { ok: false, code: "not_found", message: "This video doesn't exist." };
    await authenticatedMutableApiRequest(`/videos/${encodeURIComponent(id)}`, z.null(), { method: "DELETE" });
    return { ok: true, video };
}
