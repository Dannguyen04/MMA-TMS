import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorResponse, apiRequest } from "@/lib/api/client";
import { getPipelineAccessToken, resolvePipelineFighterId } from "@/lib/api/pipeline-auth";
import { backendVideoMetadata, videoUploadMetadataSchema } from "@/lib/api/video-upload-metadata";

export const runtime = "nodejs";

const requestSchema = videoUploadMetadataSchema.extend({
    contentType: z.enum(["video/mp4", "video/quicktime", "video/webm"]),
});

/** Only a Supabase signed upload URL may come back to the browser as an upload target. */
const signedUploadUrlSchema = z.string().url().refine((value) => {
    const url = new URL(value);
    const localHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    return (url.protocol === "https:" || (localHost && url.protocol === "http:")) && url.pathname.includes("/storage/v1/object/upload/sign/") && url.searchParams.has("token");
});

const createdUploadSchema = z.object({
    video: z.object({ id: z.string().uuid() }).passthrough(),
    upload: z.object({
        method: z.literal("PUT"),
        url: signedUploadUrlSchema,
        contentType: z.string(),
        expiresInSeconds: z.number().int().positive(),
    }).passthrough(),
});

const noStore = { "Cache-Control": "no-store" };

/**
 * Step 1 of a direct upload: the API checks the metadata and returns a signed
 * storage URL. The browser then PUTs the file to storage itself, so the video
 * never passes through this (body-limited) function; the session token stays
 * in its HTTP-only cookie.
 */
export async function POST(request: NextRequest) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: "Video metadata is invalid.", code: "VIDEO_METADATA_INVALID" }, { status: 400, headers: noStore });

    try {
        const token = await getPipelineAccessToken();
        const metadata = parsed.data;
        const fighterId = await resolvePipelineFighterId(metadata.fighterId, token);
        const created = await apiRequest("/videos/upload-url", createdUploadSchema, {
            method: "POST",
            accessToken: token,
            // Render can take a while to wake; the old streaming route had no timeout at all.
            timeoutMs: 30_000,
            body: JSON.stringify({ ...backendVideoMetadata(metadata, fighterId), contentType: metadata.contentType, fileSizeBytes: metadata.fileSizeBytes }),
        });
        return Response.json({
            videoId: created.video.id,
            upload: { method: created.upload.method, url: created.upload.url, contentType: created.upload.contentType, expiresInSeconds: created.upload.expiresInSeconds },
        }, { status: 201, headers: noStore });
    } catch (error) {
        console.error("Direct video upload could not start", error instanceof Error ? error.message : "Unknown error");
        return apiErrorResponse(error, "The video storage service can't be reached.", noStore);
    }
}
