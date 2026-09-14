import type { NextRequest } from "next/server";

import { readJobProgress } from "@/lib/api/job-progress-reader";
import { getCurrentUser } from "@/lib/auth/session";

const NO_STORE = { "Cache-Control": "no-store" };

/** Progress of an AI job: `{ job, videoId, analysisId }`. 401 without a session, 404 when not visible. */
export async function GET(_request: NextRequest, context: RouteContext<"/api/ai-jobs/[jobId]">) {
    const [user, { jobId }] = await Promise.all([getCurrentUser(), context.params]);
    const result = await readJobProgress(user, jobId);
    if (!result.ok) {
        return Response.json({ error: result.status === 401 ? "unauthorized" : "not_found", message: result.message }, { status: result.status, headers: NO_STORE });
    }
    return Response.json(result.body, { headers: NO_STORE });
}
