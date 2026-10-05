import { describe, it, expect, vi } from 'vitest';
import { resultDigest } from './result-receipt.js';
import { CoachingService } from './coaching.service.js';

describe('worker receipt digest', () => {
  it('ignores key order but preserves action order and unknown confidence', () => {
    expect(resultDigest({ b: 2, a: { confidence: null } })).toBe(resultDigest({ a: { confidence: null }, b: 2 }));
    expect(resultDigest({ confidence: null })).not.toBe(resultDigest({ confidence: 0 }));
    expect(resultDigest([1, 2])).not.toBe(resultDigest([2, 1]));
    expect(() => resultDigest({ score: NaN })).toThrow();
  });
});

function fixture(rows: unknown[][]) {
  const queue = [...rows];
  const tx: any = { insert: vi.fn(), update: vi.fn() };
  tx.select = vi.fn(() => {
    const value = queue.shift();
    if (!value) throw new Error('Unexpected database read');
    const chain: any = {};
    for (const name of ['from', 'where', 'limit', 'for', 'orderBy']) chain[name] = vi.fn(() => chain);
    chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(value).then(resolve);
    return chain;
  });
  const db: any = { transaction: (callback: (t: any) => unknown) => callback(tx) };
  return { service: new CoachingService(db), tx };
}

describe('authoritative receipt idempotency', () => {
  const dto = { jobId: 'job', actions: [], provenance: {} };
  const hash = resultDigest({ actions: [], provenance: {}, overallScore: null });
  it('accepts an identical retry after completion without inserting again', async () => {
    const { service, tx } = fixture([[{ id: 'job', status: 'DONE' }], [{ id: 'analysis', styleProfile: { workerReceipt: { resultHash: hash } } }]]);
    await expect(service.persistWorkerResult(dto)).resolves.toMatchObject({ replayed: true, analysisId: 'analysis' });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
  });
  it('rejects a conflicting retry even when the job completed', async () => {
    const { service } = fixture([[{ id: 'job', status: 'DONE' }], [{ id: 'analysis', styleProfile: { workerReceipt: { resultHash: 'different' } } }]]);
    await expect(service.persistWorkerResult(dto)).rejects.toThrow('different result');
  });
  it('persists structured evidence and a receipt without marking the queue job done', async () => {
    const { service, tx } = fixture([[{ id: 'job', status: 'PROCESSING' }], [{ id: 'analysis' }], []]);
    const saved: any[] = [];
    tx.insert.mockImplementation(() => ({ values: (value: any) => {
      saved.push(value);
      return { returning: async () => [value] };
    } }));
    const update = vi.fn(() => ({ where: async () => undefined }));
    tx.update.mockReturnValue({ set: update });
    const action = { actionId: 'punch-1', technique: 'unknown_punch', limbSide: 'left', assessmentStatus: 'INSUFFICIENT_EVIDENCE', confidence: null };
    await expect(service.persistWorkerResult({ ...dto, actions: [action] })).resolves.toMatchObject({ persisted: true, actionCount: 1 });
    expect(tx.update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ confidenceScore: null, requiresReview: true,
      styleProfile: expect.objectContaining({ workerReceipt: expect.objectContaining({ jobId: 'job', analysisRevision: 1 }) }) }));
    expect(saved[0]).toMatchObject({ actionId: 'punch-1', confidence: null, overallScore: null });
    expect(saved[1]).toMatchObject({ action: 'PERSIST_WORKER_RESULT' });
  });
  it('rejects cross-job analysis IDs and unstarted jobs', async () => {
    const wrong = fixture([[{ id: 'job', status: 'PROCESSING' }], [{ id: 'other-analysis' }]]);
    await expect(wrong.service.persistWorkerResult({ ...dto, analysisId: 'analysis' })).rejects.toThrow('does not belong');
    const pending = fixture([[{ id: 'job', status: 'PENDING' }], []]);
    await expect(pending.service.persistWorkerResult(dto)).rejects.toThrow('processing job');
  });
  it('rejects review targets from another action before any write', async () => {
    const { service, tx } = fixture([[{ id: 'analysis', fighterId: 'fighter' }], []]);
    vi.spyOn(service, 'verifyCoachAuthorization').mockResolvedValue({});
    await expect(service.reviewFinding({ analysisId: 'analysis', coachId: 'coach', actionId: 'wrong', findingId: '@action', status: 'approved' })).rejects.toThrow('does not belong');
    expect(tx.insert).not.toHaveBeenCalled();
  });
});
