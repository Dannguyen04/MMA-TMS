import { z } from 'zod';
import { apiErrorResponse, apiRequest } from '@/lib/api/client';
import { getPipelineAccessToken } from '@/lib/api/pipeline-auth';
import { assignedExercisesSchema } from '@/lib/domain/movement-review';

const headers = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
    const sessionId = new URL(request.url).searchParams.get('sessionId');
    if (!z.string().uuid().safeParse(sessionId).success) return Response.json({ message: 'Invalid session.' }, { status: 400, headers });
    try {
        const data = await apiRequest(`/movement-evidence/sessions/${sessionId}/exercises`, assignedExercisesSchema, { accessToken: await getPipelineAccessToken() });
        return Response.json(data, { headers });
    } catch (error) { return apiErrorResponse(error, 'Assigned exercises are unavailable.', headers); }
}
