import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const { request, token } = vi.hoisted(() => ({ request: vi.fn(), token: vi.fn() }));
vi.mock('@/lib/api/client', () => ({ apiRequest: request, apiErrorResponse: (_error: unknown, message: string, headers: HeadersInit) => Response.json({ message }, { status: 502, headers }) }));
vi.mock('@/lib/api/pipeline-auth', () => ({ getPipelineAccessToken: token }));
vi.mock('next/link', () => ({ default: 'a' }));
// Isolate cached lucide's separate React copy from the unit renderer.
vi.mock('lucide-react', () => ({ ChevronDown: () => null }));
import { GET, POST } from '@/app/api/ai-jobs/[jobId]/reviews/route';
import { POST as createJob } from '@/app/api/ai-jobs/route';
import { GET as exercises } from '@/app/api/ai-jobs/exercises/route';
import { movementReviewInputSchema } from '@/lib/domain/movement-review';
import { ExerciseContextFields } from '@/components/video/exercise-context-fields';

const jobId = '10000000-0000-4000-8000-000000000001';
const input = { requestId: '10000000-0000-4000-8000-000000000002', windowId: 'w1', expectedRevision: 0, decision: 'confirmed', notes: 'Visible hand.' };
const context = { params: Promise.resolve({ jobId }) };
const post = (body: unknown) => new Request('http://localhost/api/ai-jobs', { method: 'POST', body: JSON.stringify(body) });
beforeEach(() => { request.mockReset(); token.mockReset(); token.mockResolvedValue('server-token'); });

describe('movement evidence BFF', () => {
    it('forwards review with server token and preserves retry/revision identifiers', async () => {
        request.mockResolvedValue({ id: jobId, revision: 1, replayed: false });
        const response = await POST(post(input), context);
        expect(response.status).toBe(201);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(request).toHaveBeenCalledWith(`/movement-evidence/jobs/${jobId}/reviews`, expect.anything(), { method: 'POST', body: JSON.stringify(input), accessToken: 'server-token' });
        expect(JSON.stringify(await response.json())).not.toContain('server-token');
    });
    it('reads history through the authenticated backend, never demo review storage', async () => {
        request.mockResolvedValue({ jobId, canReview: false, reviews: [] });
        expect((await GET(new Request('http://localhost'), context)).status).toBe(200);
        expect(request.mock.calls[0][2]).toEqual({ accessToken: 'server-token' });
    });
    it.each([{ reviewerId: jobId }, { reviewerRole: 'DOCTOR' }, { clinicalUseEnabled: true }, { notes: ' ' }, { decision: 'corrected' }])('rejects invalid or authority-bearing payload %j', async extra => {
        expect((await POST(post({ ...input, ...extra }), context)).status).toBe(400);
        expect(request).not.toHaveBeenCalled();
    });
    it('rejects invalid route identity before contacting backend', async () => {
        expect((await GET(new Request('http://localhost'), { params: Promise.resolve({ jobId: '../other' }) })).status).toBe(400);
        expect(request).not.toHaveBeenCalled();
    });
    it('surfaces persistence failure instead of reporting success', async () => {
        request.mockRejectedValue(new Error('Unavailable'));
        expect((await POST(post(input), context)).status).toBe(502);
    });
    it('passes assigned exercise and visibility protocol to job creation', async () => {
        const body = { videoId: jobId, sessionExerciseId: jobId, evidenceProtocol: 'upper_body_v1' };
        request.mockResolvedValue({ jobId, status: 'PENDING' });
        expect((await createJob(post(body))).status).toBe(201);
        expect(JSON.parse(request.mock.calls[0][2].body)).toEqual(body);
    });
    it('fetches exercise options only for a real session', async () => {
        expect((await exercises(new Request('http://localhost/api/ai-jobs/exercises?sessionId=demo'))).status).toBe(400);
        expect(request).not.toHaveBeenCalled();
        request.mockResolvedValue([]);
        expect((await exercises(new Request(`http://localhost/api/ai-jobs/exercises?sessionId=${jobId}`))).status).toBe(200);
        expect(request.mock.calls[0][0]).toBe(`/movement-evidence/sessions/${jobId}/exercises`);
    });
    it('requires ordered times only for narrowed intervals', () => {
        expect(movementReviewInputSchema.safeParse({ ...input, decision: 'corrected', startMs: 1, endMs: 3 }).success).toBe(true);
        expect(movementReviewInputSchema.safeParse({ ...input, startMs: 1, endMs: 3 }).success).toBe(false);
        expect(movementReviewInputSchema.safeParse({ ...input, decision: 'corrected', startMs: 3, endMs: 1 }).success).toBe(false);
    });
    it('renders exercise/protocol controls with no implied verification', () => {
        const html = renderToStaticMarkup(createElement(ExerciseContextFields, { details: { fighterId: '', sessionId: '', trainingType: '', cameraAngle: '', title: '', titleEdited: false, notes: '' }, onChange: () => {} }));
        expect(html).toContain('Assigned exercise'); expect(html).toContain('does not verify its execution');
        expect(html).toContain('Upper body'); expect(html).toContain('Not a clinical measurement protocol');
    });
});
