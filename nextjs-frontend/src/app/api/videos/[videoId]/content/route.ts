import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiEndpoint, apiErrorResponse } from "@/lib/api/client";
import { getPipelineAccessToken } from "@/lib/api/pipeline-auth";

export const runtime = "nodejs";

const forwardedHeaders = ["accept-ranges", "content-length", "content-range", "content-type"];
const videoIdSchema = z.string().uuid();

/** Phát video riêng tư qua cùng origin và giữ nguyên HTTP Range cho trình phát. */
export async function GET(request: NextRequest, context: RouteContext<"/api/videos/[videoId]/content">) {
    const { videoId } = await context.params;
    // Backend video ids are UUIDs; rejecting anything else keeps dot segments out of the upstream path.
    if (!videoIdSchema.safeParse(videoId).success) {
        return Response.json({ message: "Video not found." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    try {
        const token = await getPipelineAccessToken();
        const range = request.headers.get("range");
        const read = () =>
            fetch(apiEndpoint(`/videos/${encodeURIComponent(videoId)}/content`), {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(range ? { Range: range } : {}),
                },
                cache: "no-store",
            });
        let upstream = await read();
        // A brief overload answers 5xx before any byte is streamed; one more try usually gets the footage.
        if (upstream.status >= 500) {
            await upstream.body?.cancel().catch(() => undefined);
            await new Promise((resolve) => setTimeout(resolve, 300));
            upstream = await read();
        }
        const headers = new Headers({ "Cache-Control": "private, no-store" });
        for (const name of forwardedHeaders) {
            const value = upstream.headers.get(name);
            if (value) headers.set(name, value);
        }
        return new Response(upstream.body, { status: upstream.status, headers });
    } catch (error) {
        return apiErrorResponse(error, "The video stream is unavailable.");
    }
}
