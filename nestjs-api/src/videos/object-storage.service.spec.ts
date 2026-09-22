import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { ObjectStorageService } from './object-storage.service.js';

const temporaryDirectories: string[] = [];

async function createStorage(maxSizeMb = '1') {
  const root = await mkdtemp(join(tmpdir(), 'mma-tms-storage-'));
  temporaryDirectories.push(root);
  return new ObjectStorageService(
    new ConfigService({
      STORAGE_DRIVER: 'local',
      LOCAL_STORAGE_PATH: root,
      VIDEO_STORAGE_BUCKET: 'videos',
      VIDEO_MAX_SIZE_MB: maxSizeMb,
    }),
  );
}

async function readAll(source: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of source) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('ObjectStorageService', () => {
  it('ghi object riêng tư và chỉ trả đúng byte range được yêu cầu', async () => {
    const storage = await createStorage();
    const bytes = Buffer.from('0123456789');

    await storage.put(
      'actor/video.mp4',
      Readable.from(bytes),
      bytes.length,
      'video/mp4',
    );
    const result = await storage.open('actor/video.mp4', 'video/mp4', {
      start: 2,
      end: 5,
    });

    expect(result).toMatchObject({
      size: 10,
      start: 2,
      end: 5,
      partial: true,
      mimeType: 'video/mp4',
    });
    await expect(readAll(result.stream)).resolves.toEqual(Buffer.from('2345'));
  });

  it('chặn storage key thoát khỏi thư mục lưu trữ', async () => {
    const storage = await createStorage();

    await expect(
      storage.put('../escape.mp4', Readable.from('x'), 1, 'video/mp4'),
    ).rejects.toThrow('Storage key không hợp lệ');
  });

  it('không xóa object có sẵn khi ghi trùng storage key', async () => {
    const storage = await createStorage();
    await storage.put(
      'actor/result.json',
      Readable.from('first'),
      5,
      'application/json',
    );

    await expect(
      storage.put(
        'actor/result.json',
        Readable.from('other'),
        5,
        'application/json',
      ),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    const stored = await storage.open('actor/result.json', 'application/json');
    await expect(readAll(stored.stream)).resolves.toEqual(Buffer.from('first'));
  });

  it('trả 416 khi byte range nằm ngoài object', async () => {
    const storage = await createStorage();
    await storage.put('actor/video.mp4', Readable.from('0123'), 4, 'video/mp4');

    const error = await storage
      .open('actor/video.mp4', 'video/mp4', { start: 10 })
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(
      HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
    );
  });

  it('từ chối cấu hình giới hạn upload không hợp lệ', async () => {
    await expect(createStorage('not-a-number')).rejects.toThrow(
      'VIDEO_MAX_SIZE_MB',
    );
  });
});
