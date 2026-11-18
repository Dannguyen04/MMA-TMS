import {
  BadRequestException,
  ConflictException,
  PayloadTooLargeException,
  RequestMethod,
  ServiceUnavailableException,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_ROLES } from '../shared/decorators/auth.decorator.js';
import { USER } from '../shared/types/user.role.js';
import { VideosController } from './videos.controller.js';
import { CreateVideoUploadDto } from './videos.dto.js';
import { VideosService } from './videos.service.js';

const actor = {
  id: '00000000-0000-4000-8000-0000000000a1',
  authSubject: 'auth',
  email: 'coach@test.invalid',
  role: 'COACH' as const,
};
const fighterId = '11111111-1111-4111-8111-111111111101';
const videoId = '22222222-2222-4222-8222-222222222222';
const MB = 1024 * 1024;

const metadata = {
  fighterId,
  title: '  Bag work  ',
  trainingType: 'HEAVY_BAG' as const,
  cameraAngle: 'FRONT' as const,
  durationMs: 45_000,
  originalFilename: 'bag-work.mp4',
  contentType: 'video/mp4' as const,
  fileSizeBytes: 27 * MB,
};

function videoRow(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-11-18T08:00:00.000Z');
  return {
    id: videoId,
    subjectFighterId: fighterId,
    uploadedById: actor.id,
    sessionId: null,
    title: 'Bag work',
    description: null,
    trainingType: 'HEAVY_BAG',
    storageKey: `${fighterId}/${videoId}/source.mp4`,
    storageBucket: 'videos',
    storageProvider: 'supabase',
    originalFilename: 'bag-work.mp4',
    fileSizeBytes: BigInt(27 * MB),
    mimeType: 'video/mp4',
    durationMs: 45_000,
    cameraAngle: 'FRONT',
    status: 'PENDING_UPLOAD',
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Drizzle stand-in: each `select()` resolves the next queued row set. */
function createFixture(
  options: {
    selects?: unknown[][];
    signed?: { data: unknown; error: unknown };
    listed?: { data: unknown; error: unknown };
    updated?: unknown[];
    maxMb?: number;
  } = {},
) {
  const selects = [...(options.selects ?? [])];
  const inserted: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: vi.fn(() => {
      const chain: Record<string, unknown> = {};
      for (const name of ['from', 'where', 'orderBy'])
        chain[name] = vi.fn(() => chain);
      chain.limit = vi.fn(() => Promise.resolve(selects.shift() ?? []));
      return chain;
    }),
    insert: vi.fn(() => ({
      values: (value: Record<string, unknown>) => {
        inserted.push(value);
        return {
          returning: () =>
            Promise.resolve([
              videoRow({
                ...value,
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            ]),
        };
      },
    })),
    update: vi.fn(() => ({
      set: (value: Record<string, unknown>) => {
        updates.push(value);
        const where = vi.fn(() => {
          const result = Promise.resolve(undefined);
          return Object.assign(result, {
            returning: () =>
              Promise.resolve(options.updated ?? [videoRow({ ...value })]),
          });
        });
        return { where };
      },
    })),
  };
  const bucket = {
    createSignedUploadUrl: vi.fn().mockResolvedValue(
      options.signed ?? {
        data: {
          signedUrl:
            'https://project.supabase.co/storage/v1/object/upload/sign/videos/key?token=t0k',
          token: 't0k',
          path: 'key',
        },
        error: null,
      },
    ),
    list: vi.fn().mockResolvedValue(
      options.listed ?? {
        data: [
          {
            name: 'source.mp4',
            metadata: { size: 27 * MB, mimetype: 'video/mp4' },
          },
        ],
        error: null,
      },
    ),
    remove: vi.fn().mockResolvedValue({ data: [], error: null }),
  };
  const supabase = { storage: { from: vi.fn(() => bucket) } };
  const config = {
    get: vi.fn((key: string, fallback: unknown) =>
      key === 'VIDEO_MAX_SIZE_MB' ? (options.maxMb ?? fallback) : fallback,
    ),
  };
  const access = { assertFighterAccess: vi.fn().mockResolvedValue(undefined) };
  const service = new VideosService(
    db as never,
    supabase as never,
    config as never,
    access as never,
  );
  return { service, db, bucket, supabase, access, inserted, updates };
}

describe('VideosService.createUpload', () => {
  it('records a pending video and returns a signed upload URL for its key', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }]] });

    const result = await f.service.createUpload(actor, metadata);

    expect(f.access.assertFighterAccess).toHaveBeenCalledWith(actor, fighterId);
    expect(f.supabase.storage.from).toHaveBeenCalledWith('videos');
    const key = f.bucket.createSignedUploadUrl.mock.calls[0][0] as string;
    expect(key).toMatch(
      new RegExp(`^${fighterId}/[0-9a-f-]{36}/source\\.mp4$`),
    );
    expect(f.inserted[0]).toMatchObject({
      subjectFighterId: fighterId,
      uploadedById: actor.id,
      title: 'Bag work',
      storageKey: key,
      storageBucket: 'videos',
      fileSizeBytes: BigInt(27 * MB),
      mimeType: 'video/mp4',
      status: 'PENDING_UPLOAD',
    });
    expect(result.upload).toEqual({
      method: 'PUT',
      url: 'https://project.supabase.co/storage/v1/object/upload/sign/videos/key?token=t0k',
      token: 't0k',
      bucket: 'videos',
      path: key,
      contentType: 'video/mp4',
      expiresInSeconds: 7200,
    });
    expect(result.video).toMatchObject({
      status: 'PENDING_UPLOAD',
      fileSizeBytes: 27 * MB,
      sourceUrl: expect.stringMatching(/^\/videos\/.+\/content$/),
    });
  });

  it('uses the extension of the declared type', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }]] });
    await f.service.createUpload(actor, {
      ...metadata,
      contentType: 'video/quicktime',
    });
    expect(f.bucket.createSignedUploadUrl.mock.calls[0][0]).toMatch(
      /\/source\.mov$/,
    );
  });

  it('rejects a file above VIDEO_MAX_SIZE_MB before signing or inserting', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }]], maxMb: 20 });
    await expect(f.service.createUpload(actor, metadata)).rejects.toThrow(
      PayloadTooLargeException,
    );
    expect(f.bucket.createSignedUploadUrl).not.toHaveBeenCalled();
    expect(f.db.insert).not.toHaveBeenCalled();
  });

  it('rejects an unsupported format', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }]] });
    await expect(
      f.service.createUpload(actor, {
        ...metadata,
        contentType: 'video/x-msvideo' as never,
      }),
    ).rejects.toThrow(BadRequestException);
    expect(f.db.insert).not.toHaveBeenCalled();
  });

  it('checks fighter access before anything else', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }]] });
    f.access.assertFighterAccess.mockRejectedValueOnce(new Error('forbidden'));
    await expect(f.service.createUpload(actor, metadata)).rejects.toThrow(
      'forbidden',
    );
    expect(f.bucket.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('rejects a session that belongs to another fighter', async () => {
    const f = createFixture({ selects: [[{ id: fighterId }], []] });
    await expect(
      f.service.createUpload(actor, {
        ...metadata,
        sessionId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('leaves no row behind when storage cannot sign the URL', async () => {
    const f = createFixture({
      selects: [[{ id: fighterId }]],
      signed: { data: null, error: new Error('bucket missing') },
    });
    await expect(f.service.createUpload(actor, metadata)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(f.db.insert).not.toHaveBeenCalled();
  });
});

describe('VideosService.completeUpload', () => {
  it('marks a stored upload complete with the size storage reports', async () => {
    const f = createFixture({
      selects: [[videoRow()]],
      listed: {
        data: [
          {
            name: 'source.mp4.bak',
            metadata: { size: 1, mimetype: 'video/mp4' },
          },
          {
            name: 'source.mp4',
            metadata: { size: 26 * MB, mimetype: 'video/mp4' },
          },
        ],
        error: null,
      },
    });

    const result = await f.service.completeUpload(actor, videoId);

    expect(f.access.assertFighterAccess).toHaveBeenCalledWith(actor, fighterId);
    expect(f.bucket.list).toHaveBeenCalledWith(`${fighterId}/${videoId}`, {
      search: 'source.mp4',
      limit: 10,
    });
    expect(f.updates[0]).toMatchObject({
      status: 'UPLOAD_COMPLETE',
      fileSizeBytes: BigInt(26 * MB),
    });
    expect(result).toMatchObject({
      id: videoId,
      status: 'UPLOAD_COMPLETE',
      fileSizeBytes: 26 * MB,
    });
  });

  it('answers 409 VIDEO_UPLOAD_MISSING while the object is not in storage', async () => {
    const f = createFixture({
      selects: [[videoRow()]],
      listed: { data: [], error: null },
    });
    await expect(
      f.service.completeUpload(actor, videoId),
    ).rejects.toMatchObject({ response: { code: 'VIDEO_UPLOAD_MISSING' } });
    expect(f.db.update).not.toHaveBeenCalled();
  });

  it('rejects and deletes an object above the size limit', async () => {
    const f = createFixture({
      selects: [[videoRow()]],
      maxMb: 20,
      listed: {
        data: [
          {
            name: 'source.mp4',
            metadata: { size: 27 * MB, mimetype: 'video/mp4' },
          },
        ],
        error: null,
      },
    });
    await expect(f.service.completeUpload(actor, videoId)).rejects.toThrow(
      PayloadTooLargeException,
    );
    expect(f.bucket.remove).toHaveBeenCalledWith([
      `${fighterId}/${videoId}/source.mp4`,
    ]);
    expect(f.updates[0]).toMatchObject({ status: 'REJECTED' });
  });

  it('rejects an object stored with a different type than declared', async () => {
    const f = createFixture({
      selects: [[videoRow()]],
      listed: {
        data: [
          { name: 'source.mp4', metadata: { size: MB, mimetype: 'text/html' } },
        ],
        error: null,
      },
    });
    await expect(f.service.completeUpload(actor, videoId)).rejects.toThrow(
      BadRequestException,
    );
    expect(f.updates[0]).toMatchObject({ status: 'REJECTED' });
  });

  it('is idempotent once the video is complete', async () => {
    const f = createFixture({
      selects: [[videoRow({ status: 'UPLOAD_COMPLETE' })]],
    });
    await expect(
      f.service.completeUpload(actor, videoId),
    ).resolves.toMatchObject({ status: 'UPLOAD_COMPLETE' });
    expect(f.bucket.list).not.toHaveBeenCalled();
    expect(f.db.update).not.toHaveBeenCalled();
  });

  it('refuses to complete a rejected upload', async () => {
    const f = createFixture({
      selects: [[videoRow({ status: 'REJECTED', rejectionReason: 'too big' })]],
    });
    await expect(
      f.service.completeUpload(actor, videoId),
    ).rejects.toMatchObject({
      response: { code: 'VIDEO_UPLOAD_REJECTED', message: 'too big' },
    });
  });

  it('reports the current row when a concurrent confirm already won', async () => {
    const f = createFixture({
      selects: [[videoRow()], [videoRow({ status: 'UPLOAD_COMPLETE' })]],
      updated: [],
    });
    await expect(
      f.service.completeUpload(actor, videoId),
    ).resolves.toMatchObject({ status: 'UPLOAD_COMPLETE' });
  });
});

describe('VideosService pending uploads', () => {
  it('keeps a pending video away from the analysis worker', async () => {
    const f = createFixture({ selects: [[videoRow()]] });
    await expect(
      f.service.signedWorkerUrl(actor, videoId),
    ).rejects.toMatchObject({ response: { code: 'VIDEO_NOT_READY' } });
  });

  it('does not sign playback for a pending video', async () => {
    const f = createFixture({ selects: [[videoRow()]] });
    await expect(f.service.signedContentUrl(actor, videoId)).rejects.toThrow(
      ConflictException,
    );
  });
});

describe('CreateVideoUploadDto', () => {
  const body = { ...metadata, title: 'Bag work' };

  it('accepts the wizard metadata', async () => {
    const dto = plainToInstance(CreateVideoUploadDto, body);
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each([
    ['contentType', 'video/x-msvideo'],
    ['fileSizeBytes', 0],
    ['fighterId', 'not-a-uuid'],
    ['trainingType', 'YOGA'],
  ])('rejects an invalid %s', async (field, value) => {
    const dto = plainToInstance(CreateVideoUploadDto, {
      ...body,
      [field]: value,
    });
    const errors = await validate(dto);
    expect(errors.map((error) => error.property)).toContain(field);
  });
});

describe('VideosController direct upload routes', () => {
  const reflector = new Reflector();
  const proto = VideosController.prototype;

  it.each([
    ['createUpload', 'upload-url'],
    ['completeUpload', ':id/complete'],
  ] as const)(
    '%s is POST /videos/%s for fighters, coaches and admins',
    (method, path) => {
      const handler = proto[method];
      expect(reflector.get(PATH_METADATA, VideosController)).toBe('videos');
      expect(reflector.get(PATH_METADATA, handler)).toBe(path);
      expect(reflector.get(METHOD_METADATA, handler)).toBe(RequestMethod.POST);
      expect(reflector.get(REQUIRED_ROLES, handler)).toEqual([
        USER.FIGHTER,
        USER.COACH,
        USER.ADMIN,
      ]);
    },
  );

  it('passes the authenticated actor and body to the service', async () => {
    const service = {
      createUpload: vi.fn().mockResolvedValue({ ok: true }),
      completeUpload: vi.fn().mockResolvedValue({ ok: true }),
    };
    const controller = new VideosController(service as never);
    await controller.createUpload(actor, metadata as never);
    await controller.completeUpload(actor, { id: videoId });
    expect(service.createUpload).toHaveBeenCalledWith(actor, metadata);
    expect(service.completeUpload).toHaveBeenCalledWith(actor, videoId);
    expect(() =>
      controller.completeUpload(undefined, { id: videoId }),
    ).toThrow();
  });
});
