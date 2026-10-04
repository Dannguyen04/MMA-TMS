import { z } from "zod";

import { apiErrorResponse, apiRequest } from "@/lib/api/client";
import { getPipelineAccessToken } from "@/lib/api/pipeline-auth";

const requestSchema = z.object({ videoId: z.string().uuid() });
const responseSchema = z.object({ jobId: z.string().uuid(), status: z.string() });
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ message: "Invalid video job request." }, { status: 400, headers: noStore });
    try {
        const job = await apiRequest("/jobs", responseSchema, {
            method: "POST",
            body: JSON.stringify(parsed.data),
            accessToken: await getPipelineAccessToken(),
        });
        return Response.json(job, { status: 201, headers: noStore });
    } catch (error) {
        return apiErrorResponse(error, "The analysis service is unavailable.", noStore);
    }
}
