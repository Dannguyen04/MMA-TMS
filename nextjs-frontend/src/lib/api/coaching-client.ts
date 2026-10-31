/**
 * coaching-client.ts — Real HTTP client for authoritative Coaching Loop API
 * Connects Next.js web application directly to NestJS CoachingController.
 */

import type { SessionType } from "@/lib/domain/medical-contract";
import type { TrainingPhase } from "@/lib/domain/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** `POST /coaching/assignments`: creates an active plan in `phase` with one session. The service rejects any other key. */
export interface CreateAssignmentDto {
    coachId: string;
    fighterId: string;
    /** The session's title. */
    title: string;
    planTitle?: string;
    phase: TrainingPhase;
    /** A UTC instant ending in `Z`; offsets are refused. */
    scheduledAt?: string;
    sessionType?: SessionType;
}

export interface UploadVideoDto {
    fighterId: string;
    title: string;
    storageKey: string;
    fileSizeBytes?: number;
    mimeType?: string;
    cameraAngle?: string;
}

export interface CreateAnalysisJobDto {
    videoId: string;
    fighterId: string;
    sessionId?: string;
    expectedTechniques?: string[];
}

export interface PersistActionAssessmentDto {
    actionId: string;
    technique: string;
    limbSide: string;
    assessmentStatus: string;
    overallScore?: number | null;
    grade?: string;
    confidence: number;
    rubricId?: string;
    evidence?: Record<string, unknown>;
    phases?: Record<string, unknown>;
    kinematicFeatures?: Record<string, unknown>;
    criteriaScores?: Record<string, unknown>;
    findings?: unknown[];
    provenance?: Record<string, unknown>;
}

export interface PersistWorkerResultDto {
    jobId: string;
    analysisId: string;
    overallScore?: number;
    actions: PersistActionAssessmentDto[];
    provenance?: Record<string, unknown>;
}

export interface ReviewFindingDto {
    coachId: string;
    analysisId: string;
    actionId: string;
    findingId: string;
    status: "approved" | "rejected" | "corrected";
    notes?: string;
}

export interface CoachCorrectionDto {
    analysisId: string;
    coachId: string;
    reviewText: string;
    techniqueRating?: number;
    overridesAi?: boolean;
    revision?: number;
    supersedesId?: string;
}

export interface SelectReferenceDto {
    coachId: string;
    fighterId: string;
    technique: string;
    actionId: string;
    videoId: string;
    sessionId?: string;
}

export interface RevokeReferenceDto {
    referenceId: string;
    coachId: string;
    reason: string;
}

export class CoachingApiError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
    ) {
        super(message);
        this.name = "CoachingApiError";
    }
}

/** Every reply is wrapped: `{ success: true, message, data }`, or `{ success: false, error: { code, message } }`. */
interface Envelope<T> {
    success?: boolean;
    data?: T;
    error?: { code?: string; message?: string };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${path}`;
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
    };

    const response = await fetch(url, {
        ...options,
        headers,
        cache: "no-store",
    });
    const envelope = (await response.json().catch(() => null)) as Envelope<T> | null;

    if (!response.ok) {
        throw new CoachingApiError(envelope?.error?.message ?? `API Error ${response.status}: ${response.statusText}`, response.status, envelope?.error?.code);
    }
    if (envelope?.success !== true) throw new CoachingApiError("The coaching service sent an unexpected response.", response.status, "INVALID_API_RESPONSE");
    return envelope.data as T;
}

function authenticated(accessToken: string): HeadersInit {
    const token = accessToken.trim();
    if (!token) throw new CoachingApiError("A valid access token is required.", 401, "AUTHENTICATION_REQUIRED");
    return { Authorization: `Bearer ${token}` };
}

export const coachingApiClient = {
    async createAssignment(dto: CreateAssignmentDto, accessToken: string) {
        return request("/coaching/assignments", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async uploadVideo(dto: UploadVideoDto, accessToken: string) {
        return request("/coaching/videos", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async createAnalysisJob(dto: CreateAnalysisJobDto, accessToken: string) {
        return request<{ jobId: string; analysisId: string; status: string }>("/coaching/jobs", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async reanalyzeVideo(videoId: string, fighterId: string, accessToken: string) {
        return request(`/coaching/videos/${encodeURIComponent(videoId)}/reanalyze`, {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify({ fighterId }),
        });
    },

    async reviewFinding(dto: ReviewFindingDto, accessToken: string) {
        return request("/coaching/findings/review", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async submitCoachCorrection(dto: CoachCorrectionDto, accessToken: string) {
        return request("/coaching/corrections", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async selectReference(dto: SelectReferenceDto, accessToken: string) {
        return request("/coaching/references", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async revokeReference(dto: RevokeReferenceDto, accessToken: string) {
        return request("/coaching/references/revoke", {
            method: "POST",
            headers: authenticated(accessToken),
            body: JSON.stringify(dto),
        });
    },

    async getCoachingLoopState(fighterId: string, accessToken: string, sessionId?: string) {
        const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
        return request<unknown>(`/coaching/loop-state/${encodeURIComponent(fighterId)}${query}`, {
            headers: authenticated(accessToken),
        });
    },
};

