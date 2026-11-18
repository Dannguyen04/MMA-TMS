import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiEndpoint, apiErrorResponse } from "@/lib/api/client";
import { getPipelineAccessToken, resolvePipelineFighterId } from "@/lib/api/pipeline-auth";
import { backendVideoMetadata, videoUploadMetadataSchema } from "@/lib/api/video-upload-metadata";

export const runtime = "nodejs";

const backendEnvelopeSchema = z.object({
    success: z.literal(true),
    data: z.object({ id: z.string().uuid() }),
});

const noStore = { "Cache-Control": "no-store" };

function failure(message: string, status: number, code?: string) {
    return Response.json({ message, ...(code ? { code } : {}) }, { status, headers: noStore });
}

/**
 * Truyền stream video sang backend; token HTTP-only không bao giờ đi vào JavaScript trình duyệt.
 * On Vercel the request body is capped (~4.5 MB), so the wizard now uploads straight to storage
 * (`/api/videos/direct-upload`); this route stays for small files and older clients.
 */
export async function POST(request: NextRequest) {
    const parsed = videoUploadMetadataSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success || !request.body) return failure("Video metadata is invalid.", 400, "VIDEO_METADATA_INVALID");

    try {
        const token = await getPipelineAccessToken();
        const metadata = parsed.data;
        const fighterId = await resolvePipelineFighterId(metadata.fighterId, token);
        const query = new URLSearchParams(Object.entries(backendVideoMetadata(metadata, fighterId)).map(([key, value]) => [key, String(value)]));

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
            signal: request.signal,
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
        console.error("Video upload proxy failed", error instanceof Error ? error.message : "Unknown error");
        return apiErrorResponse(error, "The video storage service can't be reached.", noStore);
    }
}
