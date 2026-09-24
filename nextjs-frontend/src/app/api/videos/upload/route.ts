import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiEndpoint, apiErrorResponse, getMutableAccessToken } from "@/lib/api/client";

export const runtime = "nodejs";

const metadataSchema = z.object({
    fighterId: z.string().uuid(),
    title: z.string().trim().min(3).max(200),
    description: z.string().max(2_000).optional(),
    trainingType: z.enum(["shadow_boxing", "pad_work", "heavy_bag", "sparring"]),
    cameraAngle: z.enum(["front", "side", "diagonal"]),
    sessionId: z.string().uuid().optional(),
    durationMs: z.coerce.number().int().positive(),
    originalFilename: z.string().min(1).max(255),
    fileSizeBytes: z.coerce.number().int().positive(),
});

const backendEnvelopeSchema = z.object({
    success: z.literal(true),
    data: z.object({ id: z.string().uuid() }),
});

const noStore = { "Cache-Control": "no-store" };

function failure(message: string, status: number, code?: string) {
    return Response.json({ message, ...(code ? { code } : {}) }, { status, headers: noStore });
}

/** Truyền stream video sang backend; token HTTP-only không bao giờ đi vào JavaScript trình duyệt. */
export async function POST(request: NextRequest) {
    const parsed = metadataSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success || !request.body) return failure("Video metadata is invalid.", 400, "VIDEO_METADATA_INVALID");

    try {
        const token = await getMutableAccessToken();
        const metadata = parsed.data;
        const query = new URLSearchParams({
            fighterId: metadata.fighterId,
            title: metadata.title,
            trainingType: metadata.trainingType.toUpperCase(),
            cameraAngle: metadata.cameraAngle.toUpperCase(),
            durationMs: String(metadata.durationMs),
            originalFilename: metadata.originalFilename,
        });
        if (metadata.description) query.set("description", metadata.description);
        if (metadata.sessionId) query.set("sessionId", metadata.sessionId);

        const response = await fetch(apiEndpoint(`/videos/upload?${query.toString()}`), {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": request.headers.get("content-type") ?? "application/octet-stream",
                "Content-Length": String(metadata.fileSizeBytes),
            },
            body: request.body,
            cache: "no-store",
            duplex: "half",
        } as RequestInit & { duplex: "half" });
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
            const error = z.object({ error: z.object({ code: z.string().optional(), message: z.string() }) }).safeParse(body);
            return failure(error.success ? error.data.error.message : "Private video storage rejected the upload.", response.status, error.success ? error.data.error.code : undefined);
        }
        const envelope = backendEnvelopeSchema.safeParse(body);
        if (!envelope.success) return failure("Video storage returned an unexpected response.", 502, "INVALID_API_RESPONSE");
        const videoId = envelope.data.data.id;
        return Response.json({ videoId, sourceUrl: `/api/videos/${videoId}/content` }, { status: 201, headers: noStore });
    } catch (error) {
        return apiErrorResponse(error, "The video storage service can't be reached.", noStore);
    }
}
