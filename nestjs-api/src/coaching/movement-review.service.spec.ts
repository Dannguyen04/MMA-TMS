import { describe, expect, it, vi } from 'vitest';
import { MovementReviewService } from './movement-review.service.js';
import { CoachingService } from './coaching.service.js';
import { movementReviewSchema } from './movement-review.dto.js';
import { movementEvidenceSchema } from './movement-evidence.contract.js';
import { resultDigest } from './result-receipt.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';

const jobId = '10000000-0000-4000-8000-000000000001';
const actor: AuthenticatedUser = { id: '10000000-0000-4000-8000-000000000002', authSubject: 'auth', email: 'coach@test.invalid', role: 'COACH' };
const input = { requestId: '10000000-0000-4000-8000-000000000003', windowId: 'w1', expectedRevision: 0, decision: 'confirmed' as const, notes: 'Hand remains visible.' };
const job = { id: jobId, status: 'DONE', fighterId: 'fighter' };
const report = {
  schemaVersion: '1.0.0', reportVersion: 'movement_evidence_v1', status: 'review_ready',
  context: { exerciseId: null, protocolId: 'whole_body_v1', purpose: 'training', source: 'unspecified', exerciseVerified: false, trainingMode: null, cameraView: null },
  coverage: { totalFrames: 12, freshPoseFrames: 12, usableFrames: 12, usableRatio: 1, excludedByReason: {} },
  reasonCodes: [], recordingGuidance: [], windows: [{ id: 'w1', startFrame: 0, endFrame: 11, startMs: 100, endMs: 500, sampleCount: 12, confidence: null, reviewStatus: 'requires_review' }],
  measurementPolicy: { validationStatus: 'NOT_VALIDATED', assessmentEnabled: false, clinicalUseEnabled: false, automaticComparisonEnabled: false, repetitionCount: null },
  provenance: { poseModel: 'pose', qualityVersion: null, requiredKeypoints: [5, 6], minKeypointConfidence: .5, minimumWindowMs: 250, minimumWindowFrames: 6, maxWindowSeconds: 5, thresholdStatus: 'ENGINEERING_DEFAULTS_NOT_CLINICALLY_VALIDATED' }, limitations: [],
};
const analysis = { id: 'analysis', styleProfile: { movementEvidence: report } };

function fixture(rows: unknown[][]) {
  const queue = [...rows];
  const inserted: unknown[] = [];
  const db: any = {};
  db.select = vi.fn(() => {
    const value = queue.shift();
    if (!value) throw new Error('Unexpected database read');
    const chain: any = {};
    for (const method of ['from', 'where', 'for', 'limit', 'orderBy']) chain[method] = vi.fn(() => chain);
    chain.then = (resolve: (r: unknown) => unknown) => Promise.resolve(value).then(resolve);
    return chain;
  });
  db.insert = vi.fn(() => ({ values: (value: unknown) => { inserted.push(value); return { returning: async () => [{ id: 'saved', ...(value as object) }] }; } }));
  db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: async () => undefined })) }));
  db.transaction = (callback: (tx: typeof db) => unknown) => callback(db);
  const access = { assertFighterAccess: vi.fn().mockResolvedValue(undefined) };
  const permissions = { hasPermissions: vi.fn().mockResolvedValue(true) };
  return { service: new MovementReviewService(db, access as never, permissions as never), db, inserted, access, permissions };
}

describe('movement window reviews', () => {
  it.each(['COACH', 'DOCTOR'] as const)('allows an assigned %s and never changes machine evidence', async role => {
    const f = fixture([[job], [{ id: 'fighter' }], [], [analysis], []]);
    await expect(f.service.append({ ...actor, role }, jobId, input)).resolves.toEqual({ id: 'saved', revision: 1, replayed: false });
    expect(f.access.assertFighterAccess).toHaveBeenCalledWith({ ...actor, role }, 'fighter');
    expect(f.inserted[0]).toMatchObject({ reviewerId: actor.id, reviewerRole: role, evidenceHash: resultDigest(movementEvidenceSchema.parse(report)), notes: input.notes });
    expect(f.db.update).not.toHaveBeenCalled();
  });
  it.each(['ADMIN', 'FIGHTER', 'GUEST'] as const)('rejects %s writes even with permission override', async role => {
    const f = fixture([[job]]);
    await expect(f.service.append({ ...actor, role }, jobId, input)).rejects.toThrow('access denied');
    expect(f.db.insert).not.toHaveBeenCalled();
  });
  it('honors explicit permission deny', async () => {
    const f = fixture([[job]]); f.permissions.hasPermissions.mockResolvedValue(false);
    await expect(f.service.append(actor, jobId, input)).rejects.toThrow('access denied');
    expect(f.db.insert).not.toHaveBeenCalled();
  });
  it('rejects expired/unassigned scope and inactive fighters', async () => {
    const f = fixture([[job]]); f.access.assertFighterAccess.mockRejectedValue(new Error('scope denied'));
    await expect(f.service.append(actor, jobId, input)).rejects.toThrow('scope denied');
    const inactive = fixture([[job], []]);
    await expect(inactive.service.append(actor, jobId, input)).rejects.toThrow('not active');
  });
  it('returns identical transport retries without another write', async () => {
    const f = fixture([[job], [{}], [{ id: 'prior', revision: 1, requestHash: resultDigest({ jobId, ...input }) }]]);
    await expect(f.service.append(actor, jobId, input)).resolves.toMatchObject({ id: 'prior', replayed: true });
    expect(f.db.insert).not.toHaveBeenCalled();
  });
  it('rejects reusing request ID for different content', async () => {
    const f = fixture([[job], [{}], [{ requestHash: 'different' }]]);
    await expect(f.service.append(actor, jobId, input)).rejects.toThrow('different review');
  });
  it('rejects stale revisions from another tab', async () => {
    const f = fixture([[job], [{}], [], [analysis], [{ revision: 2 }]]);
    await expect(f.service.append(actor, jobId, input)).rejects.toThrow('Reload');
    expect(f.db.insert).not.toHaveBeenCalled();
  });
  it('appends the next reviewer revision', async () => {
    const f = fixture([[job], [{}], [], [analysis], [{ revision: 2 }]]);
    await expect(f.service.append(actor, jobId, { ...input, expectedRevision: 2 })).resolves.toMatchObject({ revision: 3 });
  });
  it('rejects unknown windows, missing evidence and incomplete jobs', async () => {
    await expect(fixture([[job], [{}], [], [analysis]]).service.append(actor, jobId, { ...input, windowId: 'other' })).rejects.toThrow('does not belong');
    await expect(fixture([[job], [{}], [], [{}]]).service.append(actor, jobId, input)).rejects.toThrow('No valid persisted');
    await expect(fixture([[{ ...job, status: 'PROCESSING' }], [{}], []]).service.append(actor, jobId, input)).rejects.toThrow('complete');
  });
  it('allows narrowing only within the original evidence', async () => {
    const correction = { ...input, decision: 'corrected' as const, startMs: 150, endMs: 400 };
    const f = fixture([[job], [{}], [], [analysis], []]);
    await expect(f.service.append(actor, jobId, correction)).resolves.toMatchObject({ revision: 1 });
    await expect(fixture([[job], [{}], [], [analysis]]).service.append(actor, jobId, { ...correction, startMs: 0 })).rejects.toThrow('inside');
  });
  it('rejects forged actor, missing notes and invalid correction shape', () => {
    for (const extra of [{ reviewerId: actor.id }, { notes: '   ' }, { startMs: 0 }, { decision: 'corrected' }, { decision: 'corrected', startMs: 2, endMs: 1 }]) {
      expect(movementReviewSchema.safeParse({ ...input, ...extra }).success).toBe(false);
    }
  });
  it('keeps fighter/admin read-only and omits private request hashes', async () => {
    const f = fixture([[job], [{}], [{ requestHash: 'private', notes: 'observation' }]]);
    const result = await f.service.read({ ...actor, role: 'FIGHTER' }, jobId);
    expect(result.canReview).toBe(false);
    expect(result.reviews[0]).not.toHaveProperty('requestHash');
  });
});

describe('worker evidence persistence', () => {
  it('persists the full movement report with zero detected actions', async () => {
    const f = fixture([[{ ...job, status: 'PROCESSING' }], [{ id: 'analysis' }], []]);
    const set = vi.fn(() => ({ where: async () => undefined })); f.db.update.mockReturnValue({ set });
    await new CoachingService(f.db).persistWorkerResult({ jobId, actions: [], provenance: { movementEvidence: report } });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ styleProfile: expect.objectContaining({ movementEvidence: report }) }));
  });
  it('rejects context substitution and invalid clinical promotion before writes', async () => {
    const f = fixture([[{ ...job, evidenceContext: { exerciseId: 'assigned' } }]]);
    await expect(new CoachingService(f.db).persistWorkerResult({ jobId, actions: [], provenance: { movementEvidence: report } })).rejects.toThrow('assigned job context');
    const bad = { ...report, measurementPolicy: { ...report.measurementPolicy, clinicalUseEnabled: true } };
    const g = fixture([[job]]);
    await expect(new CoachingService(g.db).persistWorkerResult({ jobId, actions: [], provenance: { movementEvidence: bad } })).rejects.toThrow('Invalid movement');
    expect(g.db.insert).not.toHaveBeenCalled();
  });
});
