import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { ObjectStorageService } from './object-storage.service.js';
import { VideosRepository } from './videos.repo.js';
import { VideosService } from './videos.service.js';

const actor: AuthenticatedUser = {
  id: '11111111-1111-4111-8111-111111111101',
  authSubject: '22222222-2222-4222-8222-222222222201',
  email: 'fighter@example.test',
  role: 'FIGHTER',
};

const input = {
  fighterId: '33333333-3333-4333-8333-333333333301',
  title: 'Heavy bag round',
  description: null,
  trainingType: 'HEAVY_BAG' as const,
  cameraAngle: 'DIAGONAL' as const,
  sessionId: null,
  durationMs: 10_000,
  originalFilename: 'round.mp4',
  mimeType: 'video/mp4',
  fileSizeBytes: 4,
};

describe('VideosService', () => {
  it('persists a private object and video owned by the authenticated actor', async () => {
    const created = {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ...input,
      subjectFighterId: input.fighterId,
      uploadedById: actor.id,
      storageKey: `${actor.id}/video.mp4`,
      storageBucket: 'videos',
      storageProvider: 'local',
      status: 'UPLOAD_COMPLETE' as const,
      createdAt: new Date('2026-09-21T00:00:00.000Z'),
      updatedAt: new Date('2026-09-21T00:00:00.000Z'),
      deletedAt: null,
      rejectionReason: null,
      thumbnailUrl: null,
      recordedAt: null,
      codec: null,
      fps: null,
      resolutionWidth: null,
      resolutionHeight: null,
      isActive: true,
    };
    const repository = {
      canUploadForFighter: vi.fn().mockResolvedValue(true),
      transaction: vi.fn((work) => work({ execute: vi.fn() })),
      create: vi.fn().mockResolvedValue(created),
    } as unknown as VideosRepository;
    const storage = {
      provider: 'local',
      bucket: 'videos',
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorageService;
    const service = new VideosService(repository, storage);

    const result = await service.upload(
      actor,
      input,
      Readable.from(Buffer.from('test')),
      'request-id',
    );

    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${actor.id}/[0-9a-f-]+-round\\.mp4$`)),
      expect.anything(),
      4,
      'video/mp4',
    );
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedById: actor.id,
        subjectFighterId: input.fighterId,
        trainingType: 'HEAVY_BAG',
        cameraAngle: 'DIAGONAL',
        storageProvider: 'local',
      }),
      expect.anything(),
    );
    expect(result).toMatchObject({
      id: created.id,
      sourceUrl: `/videos/${created.id}/content`,
    });
  });

  it('removes the object when video persistence fails', async () => {
    const repository = {
      canUploadForFighter: vi.fn().mockResolvedValue(true),
      transaction: vi.fn().mockRejectedValue(new Error('database failed')),
      create: vi.fn(),
    } as unknown as VideosRepository;
    const storage = {
      provider: 'local',
      bucket: 'videos',
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    } as unknown as ObjectStorageService;
    const service = new VideosService(repository, storage);

    await expect(
      service.upload(
        actor,
        input,
        Readable.from(Buffer.from('test')),
        'request-id',
      ),
    ).rejects.toThrow('database failed');
    expect(storage.delete).toHaveBeenCalledTimes(1);
  });
});
