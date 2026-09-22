import type { NextRequest } from "next/server";
import { z } from "zod";

import { apiErrorResponse, authenticatedMutableApiRequest } from "@/lib/api/client";
import { workerResultSchema } from "@/lib/api/worker-result";

const noStore = { "Cache-Control": "private, no-store" };
const jobIdSchema = z.string().uuid();

/** Trả JSON pose đã kiểm tra qua same-origin để player không cần URL storage công khai. */
export async function GET(_request: NextRequest, context: RouteContext<"/api/ai-jobs/[jobId]/result">) {
    const { jobId } = await context.params;
    // Backend job ids are UUIDs; rejecting anything else keeps dot segments out of the upstream path.
    if (!jobIdSchema.safeParse(jobId).success) return Response.json({ message: "Analysis result not found." }, { status: 404, headers: noStore });
    try {
        const result = await authenticatedMutableApiRequest(`/jobs/${encodeURIComponent(jobId)}/result`, workerResultSchema);
        return Response.json(result, { headers: noStore });
    } catch (error) {
        return apiErrorResponse(error, "The analysis result is unavailable.", noStore);
    }
}
