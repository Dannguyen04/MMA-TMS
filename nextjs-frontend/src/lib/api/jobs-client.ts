import { z } from "zod";

const createJobResponseSchema = z.object({ jobId: z.string().uuid(), status: z.string() });

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

/** Tạo công việc qua Route Handler cùng origin để access token không đi vào JavaScript trình duyệt. */
export async function createJob(input: { videoId: string }): Promise<{ jobId: string }> {
    let response: Response;
    try {
        response = await fetch("/api/ai-jobs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(input),
            cache: "no-store",
        });
    } catch {
        throw new JobsApiError("The analysis service can't be reached. Check your connection and try again.", "network");
    }
    const body: unknown = await response.json().catch(() => null);
    if (response.status === 404) throw new JobsApiError("The analysis service was not found.", "not_found", 404);
    if (!response.ok) {
        const message = z.object({ message: z.string() }).safeParse(body);
        throw new JobsApiError(message.success ? message.data.message : `The analysis service responded with ${response.status}.`, "http", response.status);
    }
    const parsed = createJobResponseSchema.safeParse(body);
    if (!parsed.success) throw new JobsApiError("The analysis service sent an unexpected response.", "invalid_response");
    return { jobId: parsed.data.jobId };
}
