import { describe, expect, it, vi } from 'vitest';
import { BadGatewayException, ForbiddenException } from '@nestjs/common';
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

describe('JobsService.getResult cache (T-068)', () => {
  const actor = { id: 'actor', authSubject: 'auth', email: 'coach@test.invalid', role: 'COACH' as const };
  const resultUrl =
    'https://project.supabase.co/storage/v1/object/public/analysis-results/results/job/result.json';
  const result = { meta: { fps: 30, totalFrames: 1, durationMs: 33 }, frames: [], kicks: [] };

  function fixture() {
    let job: Record<string, unknown> = { id: 'job', fighterId: 'fighter', status: 'DONE', resultUrl, videoId: null };
    const chain: any = {};
    for (const name of ['from', 'where']) chain[name] = vi.fn(() => chain);
    chain.limit = vi.fn(async () => [job]);
    const updateChain: any = {};
    updateChain.set = vi.fn(() => updateChain);
    updateChain.where = vi.fn(() => updateChain);
    updateChain.returning = vi.fn(async () => [job]);
    const db: any = { select: vi.fn(() => chain), update: vi.fn(() => updateChain) };
    const download = vi.fn(async () => ({ data: new Blob([JSON.stringify(result)]), error: null }));
    const supabase = { storage: { from: vi.fn(() => ({ download })) } };
    const videoAccess = { assertFighterAccess: vi.fn().mockResolvedValue(undefined) };
    const jobs = new JobsService({ add: vi.fn() } as never, db, supabase as never,
      { get: (_key: string, fallback: unknown) => fallback, getOrThrow: () => 'https://project.supabase.co' } as never,
      { markStatus: vi.fn() } as never, videoAccess as never);
    return { jobs, download, videoAccess, setJob: (next: Record<string, unknown>) => { job = next; } };
  }

  it('downloads a finished result once and serves the second read from memory', async () => {
    const f = fixture();
    await expect(f.jobs.getResult(actor, 'job')).resolves.toEqual(result);
    await expect(f.jobs.getResult(actor, 'job')).resolves.toEqual(result);
    expect(f.download).toHaveBeenCalledTimes(1);
    expect(f.videoAccess.assertFighterAccess).toHaveBeenCalledTimes(2);
  });

  it('still answers 403 to an actor without access when the result is cached', async () => {
    const f = fixture();
    await f.jobs.getResult(actor, 'job');
    f.videoAccess.assertFighterAccess.mockRejectedValueOnce(new ForbiddenException({ code: 'FORBIDDEN' }));
    await expect(f.jobs.getResult({ ...actor, id: 'other' }, 'job')).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.download).toHaveBeenCalledTimes(1);
  });

  it('drops the cached result when the job is run again', async () => {
    const f = fixture();
    await f.jobs.getResult(actor, 'job');
    // The worker reports a new run: the job leaves DONE and comes back with a fresh result.
    f.setJob({ id: 'job', fighterId: 'fighter', status: 'PROCESSING', resultUrl: null, videoId: null });
    await f.jobs.updateJobStatus('job', { status: 'DONE', resultUrl } as never);
    f.setJob({ id: 'job', fighterId: 'fighter', status: 'DONE', resultUrl, videoId: null });
    await f.jobs.getResult(actor, 'job');
    expect(f.download).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a cached result when the job points at another result file', async () => {
    const f = fixture();
    await f.jobs.getResult(actor, 'job');
    f.setJob({ id: 'job', fighterId: 'fighter', status: 'DONE', resultUrl: resultUrl.replace('result.json', 'result-2.json'), videoId: null });
    await f.jobs.getResult(actor, 'job');
    expect(f.download).toHaveBeenCalledTimes(2);
  });
});
