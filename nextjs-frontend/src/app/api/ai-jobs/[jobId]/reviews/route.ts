import { z } from 'zod';
import { apiErrorResponse, apiRequest } from '@/lib/api/client';
import { getPipelineAccessToken } from '@/lib/api/pipeline-auth';
import { movementReviewInputSchema, movementReviewSavedSchema, movementReviewStateSchema } from '@/lib/domain/movement-review';

const noStore = { 'Cache-Control': 'no-store' };
type Context = { params: Promise<{ jobId: string }> };
export async function GET(_request: Request, context: Context) {
    const { jobId } = await context.params;
    if (!z.string().uuid().safeParse(jobId).success) return Response.json({ message: 'Invalid job.' }, { status: 400, headers: noStore });
    try {
        const data = await apiRequest(`/movement-evidence/jobs/${jobId}/reviews`, movementReviewStateSchema, { accessToken: await getPipelineAccessToken() });
        return Response.json(data, { headers: noStore });
    } catch (error) { return apiErrorResponse(error, 'Review history is unavailable.', noStore); }
}
export async function POST(request: Request, context: Context) {
    const { jobId } = await context.params;
    const parsed = movementReviewInputSchema.safeParse(await request.json().catch(() => null));
    if (!z.string().uuid().safeParse(jobId).success || !parsed.success)
        return Response.json({ message: 'Invalid review.' }, { status: 400, headers: noStore });
    try {
        const data = await apiRequest(`/movement-evidence/jobs/${jobId}/reviews`, movementReviewSavedSchema, {
            method: 'POST', body: JSON.stringify(parsed.data), accessToken: await getPipelineAccessToken(),
        });
        return Response.json(data, { status: 201, headers: noStore });
    } catch (error) { return apiErrorResponse(error, 'Review was not saved.', noStore); }
}
