/**
 * coaching-client.ts — Real HTTP client for authoritative Coaching Loop API
 * Connects Next.js web application directly to NestJS CoachingController.
 */

import { z } from "zod";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export interface CreateAssignmentDto {
    coachId: string;
    fighterId: string;
    title: string;
    martialArt: string;
    targetReps?: number;
    dueDate?: string;
    notes?: string;
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
    evidence?: Record<string, any>;
    phases?: Record<string, any>;
    kinematicFeatures?: Record<string, any>;
    criteriaScores?: Record<string, any>;
    findings?: any[];
    provenance?: Record<string, any>;
}

export interface PersistWorkerResultDto {
    jobId: string;
    analysisId: string;
    overallScore?: number;
    actions: PersistActionAssessmentDto[];
    provenance?: Record<string, any>;
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

    if (!response.ok) {
        let errorMsg = `API Error ${response.status}: ${response.statusText}`;
        let errorCode: string | undefined;
        try {
            const errData = await response.json();
            errorMsg = errData.message || errorMsg;
            errorCode = errData.error || errData.code;
        } catch {
            // Keep default text
        }
        throw new CoachingApiError(errorMsg, response.status, errorCode);
    }

    return (await response.json()) as T;
}

export const coachingApiClient = {
    async createAssignment(dto: CreateAssignmentDto, userId?: string) {
        return request("/coaching/assignments", {
            method: "POST",
            headers: userId ? { "x-user-id": userId } : {},
            body: JSON.stringify(dto),
        });
    },

    async uploadVideo(dto: UploadVideoDto, userId?: string) {
        return request("/coaching/videos", {
            method: "POST",
            headers: userId ? { "x-user-id": userId } : {},
            body: JSON.stringify(dto),
        });
    },

    async createAnalysisJob(dto: CreateAnalysisJobDto, userId?: string) {
        return request<{ jobId: string; analysisId: string; status: string }>("/coaching/jobs", {
            method: "POST",
            headers: userId ? { "x-user-id": userId } : {},
            body: JSON.stringify(dto),
        });
    },

    async reanalyzeVideo(videoId: string, fighterId: string, userId?: string) {
        return request(`/coaching/videos/${encodeURIComponent(videoId)}/reanalyze`, {
            method: "POST",
            headers: userId ? { "x-user-id": userId } : {},
            body: JSON.stringify({ fighterId }),
        });
    },

    async persistWorkerResult(dto: PersistWorkerResultDto, userId?: string) {
        return request("/coaching/results", {
            method: "POST",
            headers: userId ? { "x-user-id": userId } : {},
            body: JSON.stringify(dto),
        });
    },

    async reviewFinding(dto: ReviewFindingDto) {
        return request("/coaching/findings/review", {
            method: "POST",
            body: JSON.stringify(dto),
        });
    },

    async submitCoachCorrection(dto: CoachCorrectionDto) {
        return request("/coaching/corrections", {
            method: "POST",
            body: JSON.stringify(dto),
        });
    },

    async selectReference(dto: SelectReferenceDto) {
        return request("/coaching/references", {
            method: "POST",
            body: JSON.stringify(dto),
        });
    },

    async revokeReference(dto: RevokeReferenceDto) {
        return request("/coaching/references/revoke", {
            method: "POST",
            body: JSON.stringify(dto),
        });
    },

    async getCoachingLoopState(fighterId: string, sessionId?: string) {
        const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
        return request<any>(`/coaching/loop-state/${encodeURIComponent(fighterId)}${query}`);
    },
};

