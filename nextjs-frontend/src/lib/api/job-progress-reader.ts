import "server-only";

import { canAccessFighter } from "@/lib/auth/access";
import type { User } from "@/lib/domain/types";
import { getJobPollState } from "@/lib/services/videos";
import type { AIJobPollResponse } from "@/lib/video/job-progress";

export type JobPollResult = { ok: true; body: AIJobPollResponse } | { ok: false; status: 401 | 404; message: string };

/**
 * Current progress of a job the user may see, as reported by the video service.
 * Backs GET /api/ai-jobs/[jobId], which the UI polls (`useJobProgress`).
 */
export async function readJobProgress(user: User | null, jobId: string): Promise<JobPollResult> {
    if (!user) return { ok: false, status: 401, message: "Your session has expired. Sign in again." };

    const state = await getJobPollState(jobId);
    if (!state || !canAccessFighter(user, state.job.fighterId)) {
        return { ok: false, status: 404, message: "This job doesn't exist or you can't view it." };
    }
    return { ok: true, body: { job: state.job, videoId: state.job.videoId, analysisId: state.video?.analysisId ?? null } };
}
