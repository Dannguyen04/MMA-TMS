import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorResponse, apiRequest } from "@/lib/api/client";
import { getPipelineAccessToken } from "@/lib/api/pipeline-auth";

export const runtime = "nodejs";

const videoIdSchema = z.string().uuid();
const completedVideoSchema = z.object({ id: z.string().uuid(), status: z.string() }).passthrough();
const noStore = { "Cache-Control": "no-store" };

/** Step 2 of a direct upload: the API checks the object in storage and marks the video ready. */
export async function POST(_request: NextRequest, context: RouteContext<"/api/videos/[videoId]/complete">) {
    const { videoId } = await context.params;
    // Backend video ids are UUIDs; rejecting anything else keeps dot segments out of the upstream path.
    if (!videoIdSchema.safeParse(videoId).success) return Response.json({ message: "Video not found." }, { status: 404, headers: noStore });

    try {
        const token = await getPipelineAccessToken();
        const video = await apiRequest(`/videos/${encodeURIComponent(videoId)}/complete`, completedVideoSchema, { method: "POST", accessToken: token, timeoutMs: 30_000 });
        return Response.json({ videoId: video.id, sourceUrl: `/api/videos/${video.id}/content` }, { status: 200, headers: noStore });
    } catch (error) {
        console.error("Direct video upload could not be confirmed", error instanceof Error ? error.message : "Unknown error");
        return apiErrorResponse(error, "The video storage service can't be reached.", noStore);
    }
}
