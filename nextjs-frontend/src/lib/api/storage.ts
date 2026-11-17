import { z } from "zod";

import type { CameraAngle, VideoTrainingType } from "@/lib/domain/types";

export class StorageUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StorageUploadError";
    }
}

const storedVideoSchema = z.object({ videoId: z.string().uuid(), sourceUrl: z.string().startsWith("/api/videos/") });
const startedUploadSchema = z.object({
    videoId: z.string().uuid(),
    upload: z.object({ method: z.literal("PUT"), url: z.string().url(), contentType: z.string().min(1) }),
});

export interface StoredVideo {
    videoId: string;
    /** URL cùng-origin có xác thực dùng cho trình phát video. */
    sourceUrl: string;
}

export interface VideoUploadMetadata {
    fighterId: string;
    title: string;
    description?: string;
    trainingType: VideoTrainingType;
    cameraAngle: CameraAngle;
    sessionId?: string;
    durationMs: number;
}

export interface UploadOptions {
    signal?: AbortSignal;
    /** Bytes transferred to storage; 100% still waits for the API to confirm the file. */
    onProgress?: (percent: number) => void;
}

const VIDEO_TYPES_BY_EXTENSION: Record<string, string> = { mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm" };

/** Some browsers (Windows with .mov, for one) leave `File.type` empty; fall back to the extension. */
export function videoContentType(file: File): string {
    if (file.type) return file.type.toLowerCase();
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    return VIDEO_TYPES_BY_EXTENSION[extension] ?? "application/octet-stream";
}

const aborted = () => new DOMException("Upload cancelled", "AbortError");
const unreachable = () => new StorageUploadError("The video storage service can't be reached.");

/** PUT with upload progress, which `fetch` cannot report. */
function putWithProgress(url: string, file: File, headers: Record<string, string>, options: UploadOptions): Promise<Response> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        if (options.signal?.aborted) return reject(aborted());
        const abort = () => xhr.abort();
        const cleanup = () => options.signal?.removeEventListener("abort", abort);
        xhr.open("PUT", url);
        for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(100, event.loaded / event.total * 100));
        };
        xhr.onload = () => {
            cleanup();
            try {
                resolve(new Response([204, 205, 304].includes(xhr.status) ? null : xhr.responseText, { status: xhr.status }));
            } catch { reject(new StorageUploadError("Video storage returned an unexpected response.")); }
        };
        xhr.onerror = () => { cleanup(); reject(unreachable()); };
        xhr.onabort = () => { cleanup(); reject(aborted()); };
        options.signal?.addEventListener("abort", abort, { once: true });
        try { xhr.send(file); } catch (error) { cleanup(); reject(error); }
    });
}

async function readFailure(response: Response, fallback: string): Promise<StorageUploadError> {
    const body: unknown = await response.json().catch(() => null);
    const parsed = z.object({ message: z.string().min(1) }).safeParse(body);
    return new StorageUploadError(parsed.success ? parsed.data.message : fallback);
}

/** Same-origin JSON call to one of our route handlers (they hold the HTTP-only session). */
async function postToRoute<T extends z.ZodType>(url: string, body: unknown, schema: T, signal?: AbortSignal): Promise<z.output<T>> {
    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: body === undefined ? undefined : { "Content-Type": "application/json" },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: "no-store",
            signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw unreachable();
    }
    if (!response.ok) throw await readFailure(response, `The upload failed (HTTP ${response.status}).`);
    const parsed = schema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) throw new StorageUploadError("Video storage returned an unexpected response.");
    return parsed.data;
}

/**
 * Upload the original file straight to private storage:
 * 1. our route asks the API for a signed upload URL (and a pending video row),
 * 2. the browser PUTs the file to Supabase Storage, so no Vercel body limit applies,
 * 3. our route asks the API to confirm the stored file and mark the video ready.
 */
export async function uploadVideoToStorage(file: File, metadata: VideoUploadMetadata, options: UploadOptions = {}): Promise<StoredVideo> {
    if (options.signal?.aborted) throw aborted();
    const contentType = videoContentType(file);
    // Skip absent optional fields so they are left out of the JSON instead of sent as null.
    const fields = Object.fromEntries(Object.entries({ ...metadata, originalFilename: file.name, fileSizeBytes: file.size, contentType }).filter(([, value]) => value !== undefined));
    const started = await postToRoute("/api/videos/direct-upload", fields, startedUploadSchema, options.signal);

    const headers = { "Content-Type": started.upload.contentType, "x-upsert": "false", "Cache-Control": "max-age=3600" };
    let response: Response;
    try {
        response = options.onProgress
            ? await putWithProgress(started.upload.url, file, headers, options)
            : await fetch(started.upload.url, { method: "PUT", headers, body: file, cache: "no-store", signal: options.signal });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        if (error instanceof StorageUploadError) throw error;
        throw unreachable();
    }
    if (!response.ok) {
        throw await readFailure(response, response.status === 413
            ? "The video exceeds the storage file-size limit."
            : `Video storage rejected the upload (HTTP ${response.status}).`);
    }

    if (options.signal?.aborted) throw aborted();
    return postToRoute(`/api/videos/${encodeURIComponent(started.videoId)}/complete`, undefined, storedVideoSchema, options.signal);
}
