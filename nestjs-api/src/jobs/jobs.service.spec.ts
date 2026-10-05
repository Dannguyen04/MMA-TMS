import { describe, expect, it, vi } from 'vitest';
import { BadGatewayException } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

function service() {
  return new JobsService(
    { add: vi.fn() } as never,
    {} as never,
    {} as never,
    {
      get: vi.fn((_key: string, fallback?: unknown) => fallback),
      getOrThrow: vi.fn(() => 'https://project.supabase.co'),
    } as never,
    {} as never,
    {} as never,
  );
}

describe('JobsService result trust boundary', () => {
  it('accepts only the configured Supabase result bucket', () => {
    const jobs = service() as unknown as {
      resultStorageKey(value: string): string;
    };
    expect(
      jobs.resultStorageKey(
        'https://project.supabase.co/storage/v1/object/public/analysis-results/results/job/result.json',
      ),
    ).toBe('results/job/result.json');
  });

  it.each([
    'https://evil.example/storage/v1/object/public/analysis-results/results/job/result.json',
    'https://project.supabase.co/storage/v1/object/public/videos/result.json',
    'https://project.supabase.co/storage/v1/object/public/analysis-results/../secrets.json',
    'local://result.json',
  ])('rejects an untrusted result location: %s', (url) => {
    const jobs = service() as unknown as {
      resultStorageKey(value: string): string;
    };
    expect(() => jobs.resultStorageKey(url)).toThrow(BadGatewayException);
  });
});

describe('assigned exercise job context', () => {
  const actor = { id: 'actor', authSubject: 'auth', email: 'coach@test.invalid', role: 'COACH' as const };
  function createFixture(exercise: unknown, sessionId: string | null = 'session') {
    const saved: unknown[] = [];
    const queue = { add: vi.fn().mockResolvedValue({}) };
    const chain: any = {};
    for (const name of ['from', 'innerJoin', 'where']) chain[name] = vi.fn(() => chain);
    chain.limit = vi.fn().mockResolvedValue(exercise ? [{ exercise }] : []);
    const db: any = { select: vi.fn(() => chain), insert: vi.fn(() => ({ values: (value: unknown) => {
      saved.push(value); return { returning: async () => [{ id: 'job', status: 'PENDING' }] };
    } })) };
    const video = { id: 'video', sessionId, subjectFighterId: 'fighter', trainingType: 'SHADOW_BOXING', cameraAngle: 'FRONT' };
    const videos = { signedWorkerUrl: vi.fn().mockResolvedValue({ video, url: 'https://example.invalid/signed' }) };
    const jobs = new JobsService(queue as never, db, {} as never,
      { get: (_key: string, fallback: unknown) => fallback, getOrThrow: () => 'https://project.supabase.co' } as never,
      videos as never, {} as never);
    return { jobs, db, saved, queue, chain, videos };
  }
  it('uses authoritative assignment identity and passes only worker-supported fields', async () => {
    const f = createFixture({ id: 'assigned', exerciseId: 'catalog', exerciseNameSnapshot: 'Assigned drill' });
    await f.jobs.createJob(actor, { videoId: 'video', sessionExerciseId: 'assigned', evidenceProtocol: 'upper_body_v1' });
    expect(f.videos.signedWorkerUrl).toHaveBeenCalledWith(actor, 'video');
    expect(f.saved[0]).toMatchObject({ evidenceContext: { sessionExerciseId: 'assigned', exerciseId: 'catalog', exerciseName: 'Assigned drill', selectedBy: 'actor', protocolId: 'upper_body_v1' } });
    expect(f.queue.add.mock.calls[0][1].exerciseContext).toEqual({ exerciseId: 'catalog', protocolId: 'upper_body_v1', purpose: 'training' });
  });
  it('rejects a selection outside the session/fighter join before creating a job', async () => {
    const f = createFixture(null);
    await expect(f.jobs.createJob(actor, { videoId: 'video', sessionExerciseId: 'other' })).rejects.toThrow('must belong');
    expect(f.chain.innerJoin).toHaveBeenCalled(); expect(f.chain.where).toHaveBeenCalled();
    expect(f.db.insert).not.toHaveBeenCalled(); expect(f.queue.add).not.toHaveBeenCalled();
  });
  it('rejects an exercise on a video without a session', async () => {
    const f = createFixture({ id: 'assigned' }, null);
    await expect(f.jobs.createJob(actor, { videoId: 'video', sessionExerciseId: 'assigned' })).rejects.toThrow('must belong');
    expect(f.db.insert).not.toHaveBeenCalled();
  });
  it('does not guess an assigned exercise when none was selected', async () => {
    const f = createFixture(null);
    await f.jobs.createJob(actor, { videoId: 'video' });
    expect(f.db.select).not.toHaveBeenCalled();
    expect(f.queue.add.mock.calls[0][1].exerciseContext).toEqual({ exerciseId: null, protocolId: 'whole_body_v1', purpose: 'training' });
  });
});
