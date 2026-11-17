import { z } from "zod";

/** Metadata the upload wizard sends, shared by the streamed and the direct upload routes. */
export const videoUploadMetadataSchema = z.object({
    fighterId: z.string().min(1).max(100),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(2_000).optional(),
    trainingType: z.enum(["shadow_boxing", "pad_work", "heavy_bag", "sparring"]),
    cameraAngle: z.enum(["front", "side", "diagonal"]),
    sessionId: z.string().min(1).max(100).optional(),
    durationMs: z.coerce.number().int().positive(),
    originalFilename: z.string().min(1).max(255),
    fileSizeBytes: z.coerce.number().int().positive(),
});

export type VideoUploadMetadataInput = z.output<typeof videoUploadMetadataSchema>;

/** Backend field names and enum casing for a validated wizard payload. */
export function backendVideoMetadata(metadata: VideoUploadMetadataInput, fighterId: string) {
    return {
        fighterId,
        title: metadata.title,
        trainingType: metadata.trainingType.toUpperCase(),
        cameraAngle: metadata.cameraAngle.toUpperCase(),
        durationMs: metadata.durationMs,
        originalFilename: metadata.originalFilename,
        ...(metadata.description ? { description: metadata.description } : {}),
        // Demo sessions use non-UUID ids the backend does not know; only real sessions are linked.
        ...(metadata.sessionId && z.string().uuid().safeParse(metadata.sessionId).success ? { sessionId: metadata.sessionId } : {}),
    };
}
