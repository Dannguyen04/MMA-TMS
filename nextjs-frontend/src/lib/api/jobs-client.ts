import { z } from "zod";

/**
 * Typed client for the NestJS analysis job API (`nestjs-api/src/jobs`).
 * Usable from the browser (create a job after uploading) and the server (poll a job).
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export type ExternalJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

const externalJobSchema = z.object({
    id: z.string(),
    videoUrl: z.string(),
    status: z.enum(["PENDING", "PROCESSING", "DONE", "FAILED"]),
    resultUrl: z.string().nullish(),
    score: z.number().nullish(),
    createdAt: z.string(),
    updatedAt: z.string(),
});

const createJobResponseSchema = z.object({
    jobId: z.string(),
    status: z.string(),
});

export interface ExternalJob {
    id: string;
    videoUrl: string;
    status: ExternalJobStatus;
    resultUrl: string | null;
    score: number | null;
    createdAt: string;
    updatedAt: string;
}

export type JobsApiErrorKind = "network" | "http" | "not_found" | "invalid_response";

export class JobsApiError extends Error {
    readonly kind: JobsApiErrorKind;
    readonly status: number | null;

    constructor(message: string, kind: JobsApiErrorKind, status: number | null = null) {
        super(message);
        this.name = "JobsApiError";
        this.kind = kind;
        this.status = status;
    }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(`${API_URL}${path}`, { ...init, cache: "no-store" });
    } catch {
        throw new JobsApiError("The analysis service can't be reached. Check your connection and try again.", "network");
    }
    if (response.status === 404) throw new JobsApiError("The analysis job was not found.", "not_found", 404);
    if (!response.ok) throw new JobsApiError(`The analysis service responded with ${response.status}.`, "http", response.status);
    try {
        return await response.json();
    } catch {
        throw new JobsApiError("The analysis service sent an unreadable response.", "invalid_response", response.status);
    }
}

/** Queues analysis of footage that is already in storage. */
export async function createJob(input: { videoUrl: string; userId: string }): Promise<{ jobId: string }> {
    const body = await request("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    const parsed = createJobResponseSchema.safeParse(body);
    if (!parsed.success) throw new JobsApiError("The analysis service sent an unexpected response.", "invalid_response");
    return { jobId: parsed.data.jobId };
}

/** Current state of a job, including the worker result URL once it is done. */
export async function getJob(jobId: string): Promise<ExternalJob> {
    const body = await request(`/jobs/${encodeURIComponent(jobId)}`);
    const parsed = externalJobSchema.safeParse(body);
    if (!parsed.success) throw new JobsApiError("The analysis service sent an unexpected job format.", "invalid_response");
    return { ...parsed.data, resultUrl: parsed.data.resultUrl ?? null, score: parsed.data.score ?? null };
}
