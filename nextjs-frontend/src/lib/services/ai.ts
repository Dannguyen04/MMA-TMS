import "server-only";

import { isDemoAuthEnabled } from "@/lib/auth/constants";
import type { AIJobStats } from "@/lib/domain/ai-job-stats";
import type { AbnormalMovementAlert, AIAnalysis, AIModel, AIModelStatus, User } from "@/lib/domain/types";
import * as api from "./ai.api";
import type {
    AIJobDetail,
    AIJobFilter,
    AIJobListItem,
    AIReviewInput,
    AlertDetail,
    AlertFilter,
    AlertReviewInput,
    CoachReviewInput,
    JobActionResult,
    ModelResult,
    ModelThresholdsInput,
    ReviewAlertResult,
    ReviewDetectionResult,
    ReviewFindingResult,
    SubmitCoachReviewResult,
} from "./ai.demo";
import { unsupportedOperation } from "./api-helpers";

/*
 * AI analysis review, pipeline jobs, model registry and movement observations. Demo mode delegates to the in-memory
 * records in `ai.demo.ts`, loaded lazily so API mode never touches mock state. API mode reads jobs and movement
 * observations from the NestJS jobs API (`ai.api.ts`); finding review, job retry and cancel, the model registry and
 * observation review have no API yet, so pages hide them (see the feature gates) and these functions refuse.
 */

export type {
    AIAnalysisSummary,
    AIJobDetail,
    AIJobFilter,
    AIJobListItem,
    AIReviewInput,
    AlertDetail,
    AlertFilter,
    AlertReviewInput,
    CoachReviewInput,
    JobActionResult,
    ModelResult,
    ModelThresholdsInput,
    ReviewAlertResult,
    ReviewDetectionResult,
    ReviewFindingResult,
    SubmitCoachReviewResult,
} from "./ai.demo";
export type { AIJobStats } from "@/lib/domain/ai-job-stats";

async function demoService(): Promise<typeof import("./ai.demo")> {
    return import("./ai.demo");
}

/* ─── Analyses & human review ─────────────────────────────────────────────── */

/** A single analysis, or null. API mode builds analyses from the worker result on the video page instead. */
export async function getAnalysis(id: string): Promise<AIAnalysis | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getAnalysis(id);
    return null;
}

export async function reviewFinding(analysisId: string, findingId: string, input: AIReviewInput, actor: User): Promise<ReviewFindingResult> {
    if (isDemoAuthEnabled()) return (await demoService()).reviewFinding(analysisId, findingId, input, actor);
    unsupportedOperation("Reviewing an AI finding", "coach review of AI findings");
}

export async function reviewDetection(analysisId: string, detectionId: string, input: AIReviewInput, actor: User): Promise<ReviewDetectionResult> {
    if (isDemoAuthEnabled()) return (await demoService()).reviewDetection(analysisId, detectionId, input, actor);
    unsupportedOperation("Reviewing an AI detection", "coach review of AI findings");
}

export async function submitCoachReview(analysisId: string, input: CoachReviewInput, actor: User): Promise<SubmitCoachReviewResult> {
    if (isDemoAuthEnabled()) return (await demoService()).submitCoachReview(analysisId, input, actor);
    unsupportedOperation("Submitting a coach review", "coach review of AI findings");
}

/* ─── Pipeline jobs ───────────────────────────────────────────────────────── */

export async function listAIJobs(filter: AIJobFilter = {}): Promise<AIJobListItem[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listAIJobs(filter);
    return api.listAIJobs(filter);
}

export async function getAIJobDetail(id: string): Promise<AIJobDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getAIJobDetail(id);
    return api.getAIJobDetail(id);
}

export async function retryJob(id: string, actor: User): Promise<JobActionResult> {
    if (isDemoAuthEnabled()) return (await demoService()).retryJob(id, actor);
    unsupportedOperation("Retrying an AI job", "job retries");
}

export async function cancelJob(id: string, actor: User): Promise<JobActionResult> {
    if (isDemoAuthEnabled()) return (await demoService()).cancelJob(id, actor);
    unsupportedOperation("Cancelling an AI job", "job cancellation");
}

export async function getAIJobStats(now: Date = new Date()): Promise<AIJobStats> {
    if (isDemoAuthEnabled()) return (await demoService()).getAIJobStats(now);
    return api.getAIJobStats(now);
}

/* ─── Model registry (demo only) ──────────────────────────────────────────── */

export async function listAIModels(): Promise<AIModel[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listAIModels();
    return [];
}

export async function getAIModel(id: string): Promise<AIModel | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getAIModel(id);
    return null;
}

export async function updateModelThresholds(id: string, input: ModelThresholdsInput, actor: User): Promise<ModelResult> {
    if (isDemoAuthEnabled()) return (await demoService()).updateModelThresholds(id, input, actor);
    unsupportedOperation("Changing model thresholds", "the AI model registry");
}

export async function setModelStatus(id: string, status: AIModelStatus, actor: User): Promise<ModelResult> {
    if (isDemoAuthEnabled()) return (await demoService()).setModelStatus(id, status, actor);
    unsupportedOperation("Changing a model's status", "the AI model registry");
}

/* ─── Movement observations ───────────────────────────────────────────────── */

export async function listAlerts(filter: AlertFilter = {}): Promise<AbnormalMovementAlert[]> {
    if (isDemoAuthEnabled()) return (await demoService()).listAlerts(filter);
    return api.listAlerts(filter);
}

export async function getAlertDetail(id: string): Promise<AlertDetail | null> {
    if (isDemoAuthEnabled()) return (await demoService()).getAlertDetail(id);
    return api.getAlertDetail(id);
}

export async function reviewAlert(id: string, input: AlertReviewInput, actor: User): Promise<ReviewAlertResult> {
    if (isDemoAuthEnabled()) return (await demoService()).reviewAlert(id, input, actor);
    unsupportedOperation("Reviewing an AI movement observation", "observation review");
}
