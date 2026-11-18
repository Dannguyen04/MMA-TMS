import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoUploadSweeper } from './video-upload-sweeper.service.js';
import { STALE_UPLOAD_AFTER_MS, VideosService } from './videos.service.js';

const now = new Date('2026-11-18T12:00:00.000Z');

function createFixture(stale: unknown[], cleanedIds: string[] = []) {
  const selectChain = {
    from: vi.fn(() => selectChain),
    where: vi.fn(() => selectChain),
    limit: vi.fn(() => Promise.resolve(stale)),
  };
  const updates: Record<string, unknown>[] = [];
  const db = {
    select: vi.fn(() => selectChain),
    update: vi.fn(() => ({
      set: (value: Record<string, unknown>) => {
        updates.push(value);
        return {
          where: () => ({
            returning: () => Promise.resolve(cleanedIds.map((id) => ({ id }))),
          }),
        };
      },
    })),
  };
  const removed: Record<string, string[]> = {};
  const supabase = {
    storage: {
      from: vi.fn((bucket: string) => ({
        remove: vi.fn((keys: string[]) => {
          removed[bucket] = keys;
          return Promise.resolve({ data: [], error: null });
        }),
      })),
    },
  };
  const service = new VideosService(
    db as never,
    supabase as never,
    { get: (_key: string, fallback: unknown) => fallback } as never,
    {} as never,
  );
  return { service, db, selectChain, supabase, removed, updates };
}

describe('VideosService.cleanupStaleUploads', () => {
  it('removes abandoned objects per bucket and soft-deletes their rows', async () => {
    const f = createFixture(
      [
        { id: 'a', storageBucket: 'videos', storageKey: 'f/a/source.mp4' },
        { id: 'b', storageBucket: 'videos', storageKey: 'f/b/source.mov' },
        { id: 'c', storageBucket: 'old', storageKey: 'f/c/source.webm' },
      ],
      ['a', 'b', 'c'],
    );

    await expect(f.service.cleanupStaleUploads(now)).resolves.toBe(3);

    expect(f.selectChain.limit).toHaveBeenCalledWith(100);
    expect(f.removed).toEqual({
      videos: ['f/a/source.mp4', 'f/b/source.mov'],
      old: ['f/c/source.webm'],
    });
    expect(f.updates).toEqual([
      {
        status: 'REJECTED',
        rejectionReason: 'The upload was not completed',
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      },
    ]);
  });

  it('does nothing when no upload is stale', async () => {
    const f = createFixture([]);
    await expect(f.service.cleanupStaleUploads(now)).resolves.toBe(0);
    expect(f.supabase.storage.from).not.toHaveBeenCalled();
    expect(f.db.update).not.toHaveBeenCalled();
  });

  it('still cleans the rows when storage is unreachable', async () => {
    const f = createFixture(
      [{ id: 'a', storageBucket: 'videos', storageKey: 'f/a/source.mp4' }],
      ['a'],
    );
    f.supabase.storage.from.mockReturnValue({
      remove: vi.fn().mockRejectedValue(new Error('storage down')),
    } as never);
    await expect(f.service.cleanupStaleUploads(now)).resolves.toBe(1);
    expect(f.db.update).toHaveBeenCalledOnce();
  });

  it('waits until the signed URL has long expired', () => {
    // Supabase signed upload URLs live two hours.
    expect(STALE_UPLOAD_AFTER_MS).toBeGreaterThan(2 * 60 * 60 * 1000);
  });
});

describe('VideoUploadSweeper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it('does not schedule anything under tests', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const videos = { cleanupStaleUploads: vi.fn() };
    new VideoUploadSweeper(videos as never).onApplicationBootstrap();
    expect(videos.cleanupStaleUploads).not.toHaveBeenCalled();
  });

  it('can be switched off', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('VIDEO_UPLOAD_SWEEP', 'off');
    const videos = { cleanupStaleUploads: vi.fn() };
    new VideoUploadSweeper(videos as never).onApplicationBootstrap();
    expect(videos.cleanupStaleUploads).not.toHaveBeenCalled();
  });

  it('sweeps at start-up and every hour until destroyed', async () => {
    vi.useFakeTimers();
    vi.stubEnv('NODE_ENV', 'production');
    const videos = { cleanupStaleUploads: vi.fn().mockResolvedValue(0) };
    const sweeper = new VideoUploadSweeper(videos as never);
    sweeper.onApplicationBootstrap();
    expect(videos.cleanupStaleUploads).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(videos.cleanupStaleUploads).toHaveBeenCalledTimes(2);
    sweeper.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(videos.cleanupStaleUploads).toHaveBeenCalledTimes(2);
  });

  it('never throws and skips an overlapping pass', async () => {
    let finish: (value: number) => void = () => undefined;
    const videos = {
      cleanupStaleUploads: vi
        .fn()
        .mockImplementationOnce(
          () => new Promise<number>((resolve) => (finish = resolve)),
        )
        .mockRejectedValueOnce(new Error('db down')),
    };
    const sweeper = new VideoUploadSweeper(videos as never);
    const first = sweeper.sweep();
    await expect(sweeper.sweep()).resolves.toBe(0);
    finish(2);
    await expect(first).resolves.toBe(2);
    await expect(sweeper.sweep()).resolves.toBe(0);
    expect(videos.cleanupStaleUploads).toHaveBeenCalledTimes(2);
  });
});
