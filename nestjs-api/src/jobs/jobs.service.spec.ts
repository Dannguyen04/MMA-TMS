import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AnalysisJob } from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { JobsService } from './jobs.service.js';

const actor: AuthenticatedUser = {
  id: '516a01dc-f842-40e4-ae88-abca224921b7',
  authSubject: 'fighter-subject',
  email: 'fighter@example.com',
  role: 'FIGHTER',
};

const now = new Date('2026-09-19T10:00:00.000Z');
const videoId = '759ac179-4d6c-45e1-a07a-ae0149e69080';
const job = {
  id: 'c61e6859-4a4e-4313-b762-9343270153f5',
  userId: actor.id,
  videoUrl: 'https://storage.example.test/video.mp4',
  status: 'PENDING' as const,
  resultUrl: null,
  score: null,
  createdAt: now,
  updatedAt: now,
  healthAlerts: [],
  jointStates: {},
  alertCount: 0,
  hasImpairment: false,
  fighterId: null,
  sessionId: null,
  videoId,
  algorithmConfigId: null,
  createdById: actor.id,
};

const scopedVideo = {
  id: videoId,
  fighterId: '35d9d3f7-7872-47d1-8f53-8fdb5874b9df',
  sessionId: null,
};

function serviceWithDb(
  db: Record<string, unknown>,
  queue = { add: vi.fn() },
  videos = { findOne: vi.fn(async () => scopedVideo) },
  storage = {},
) {
  return {
    service: new JobsService(
      queue as never,
      db as never,
      videos as never,
      storage as never,
    ),
    queue,
    videos,
  };
}

function selectDb(row: AnalysisJob) {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [row]) })),
      })),
    })),
  };
}

describe('JobsService', () => {
  it('derives job ownership from the authenticated actor', async () => {
    const returning = vi.fn(async () => [job]);
    const values = vi.fn(() => ({ returning }));
    const db = { insert: vi.fn(() => ({ values })), delete: vi.fn() };
    const { service, queue } = serviceWithDb(db);

    await expect(service.createJob(actor, { videoId })).resolves.toEqual({
      jobId: job.id,
      status: 'PENDING',
    });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: actor.id,
        createdById: actor.id,
        videoId,
        fighterId: scopedVideo.fighterId,
      }),
    );
    expect(queue.add).toHaveBeenCalledWith(
      'analyze',
      { jobId: job.id, videoId, schemaVersion: '1.0.0' },
      expect.objectContaining({ jobId: job.id, attempts: 3 }),
    );
    expect(queue.add.mock.calls[0]?.[1]).not.toHaveProperty('videoUrl');
  });

  it('conceals another user job from a non-admin actor', async () => {
    const { service } = serviceWithDb(
      selectDb({ ...job, userId: '59d6ba46-32f2-4e67-b486-e966b2064328' }),
    );

    await expect(service.getJobForActor(actor, job.id)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('treats a duplicate terminal callback as idempotent', async () => {
    const doneJob = { ...job, status: 'DONE' as const };
    const { service } = serviceWithDb(selectDb(doneJob));

    await expect(
      service.updateJobStatus(job.id, { status: 'DONE' }),
    ).resolves.toEqual(doneJob);
  });

  it('reports a missing result until the job is done', async () => {
    const { service } = serviceWithDb(selectDb(job));

    await expect(service.getResultForActor(actor, job.id)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects attempts to overwrite a terminal state', async () => {
    const { service } = serviceWithDb(
      selectDb({ ...job, status: 'FAILED' as const }),
    );

    await expect(
      service.updateJobStatus(job.id, { status: 'DONE' }),
    ).rejects.toThrow(ConflictException);
  });
});
