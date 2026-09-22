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

/** Truyền thẳng nội dung file qua same-origin Route Handler, không đưa khóa storage vào trình duyệt. */
export async function uploadVideoToStorage(file: File, metadata: VideoUploadMetadata): Promise<StoredVideo> {
    let response: Response;
    try {
        const query = new URLSearchParams();
        // Skip absent optional fields: URLSearchParams would otherwise send the literal string "undefined".
        for (const [key, value] of Object.entries({ ...metadata, originalFilename: file.name, fileSizeBytes: file.size })) {
            if (value !== undefined) query.set(key, String(value));
        }
        response = await fetch(`/api/videos/upload?${query.toString()}`, {
            method: "POST",
            headers: {
                "Content-Type": file.type || "application/octet-stream",
            },
            body: file,
            cache: "no-store",
        });
    } catch {
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
