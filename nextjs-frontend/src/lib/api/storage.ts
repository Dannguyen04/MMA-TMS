import { z } from "zod";

import type { CameraAngle, VideoTrainingType } from "@/lib/domain/types";

export class StorageUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StorageUploadError";
    }
}

const storedVideoSchema = z.object({ videoId: z.string().uuid(), sourceUrl: z.string().startsWith("/api/videos/") });

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
    /** Bytes transferred to the server; 100% still waits for storage confirmation. */
    onProgress?: (percent: number) => void;
}

function uploadWithProgress(url: string, file: File, options: UploadOptions): Promise<Response> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const aborted = () => new DOMException("Upload cancelled", "AbortError");
        if (options.signal?.aborted) return reject(aborted());
        const abort = () => xhr.abort();
        const cleanup = () => options.signal?.removeEventListener("abort", abort);
        xhr.open("POST", url);
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && event.total > 0) options.onProgress?.(Math.min(100, event.loaded / event.total * 100));
        };
        xhr.onload = () => {
            cleanup();
            try {
                resolve(new Response([204, 205, 304].includes(xhr.status) ? null : xhr.responseText, { status: xhr.status }));
            } catch { reject(new StorageUploadError("Video storage returned an unexpected response.")); }
        };
        xhr.onerror = () => { cleanup(); reject(new StorageUploadError("The video storage service can't be reached.")); };
        xhr.onabort = () => { cleanup(); reject(aborted()); };
        options.signal?.addEventListener("abort", abort, { once: true });
        try { xhr.send(file); } catch (error) { cleanup(); reject(error); }
    });
}

/** Stream the original file through the authenticated same-origin upload route. */
export async function uploadVideoToStorage(file: File, metadata: VideoUploadMetadata, options: UploadOptions = {}): Promise<StoredVideo> {
    let response: Response;
    try {
        const query = new URLSearchParams();
        // Skip absent optional fields: URLSearchParams would otherwise send the literal string "undefined".
        for (const [key, value] of Object.entries({ ...metadata, originalFilename: file.name, fileSizeBytes: file.size })) {
            if (value !== undefined) query.set(key, String(value));
        }
        const url = `/api/videos/upload?${query.toString()}`;
        response = options.onProgress ? await uploadWithProgress(url, file, options) : await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
            cache: "no-store",
            signal: options.signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        throw new StorageUploadError("The video storage service can't be reached.");
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
        const error = z.object({ message: z.string() }).safeParse(body);
        throw new StorageUploadError(error.success ? error.data.message : `The upload failed (HTTP ${response.status}).`);
    }
    const parsed = storedVideoSchema.safeParse(body);
    if (!parsed.success) throw new StorageUploadError("Video storage returned an unexpected response.");
    return parsed.data;
}
