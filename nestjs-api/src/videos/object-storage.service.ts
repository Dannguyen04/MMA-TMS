import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Readable, Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { videoRangeNotSatisfiable } from './videos.error.js';

export interface ByteRange {
  start: number;
  end?: number;
}

export interface StoredObjectRead {
  stream: Readable;
  size: number;
  start: number;
  end: number;
  mimeType: string;
  partial: boolean;
}

@Injectable()
export class ObjectStorageService {
  readonly provider: 'local' | 'supabase';
  readonly bucket: string;
  readonly maxUploadBytes: number;
  private readonly localRoot: string;
  private readonly supabaseUrl: string;
  private readonly supabaseKey: string;

  constructor(config: ConfigService) {
    this.provider =
      config.get<string>('STORAGE_DRIVER', 'local') === 'supabase'
        ? 'supabase'
        : 'local';
    this.bucket = config.get<string>('VIDEO_STORAGE_BUCKET', 'videos');
    const maxUploadMegabytes = Number(
      config.get<string>('VIDEO_MAX_SIZE_MB', '500'),
    );
    if (!Number.isFinite(maxUploadMegabytes) || maxUploadMegabytes <= 0) {
      throw new Error('VIDEO_MAX_SIZE_MB phải là số dương.');
    }
    this.maxUploadBytes = maxUploadMegabytes * 1024 * 1024;
    this.localRoot = resolve(
      config.get<string>('LOCAL_STORAGE_PATH', './.local-storage'),
      this.bucket,
    );
    this.supabaseUrl = config
      .get<string>('SUPABASE_URL', '')
      .replace(/\/$/, '');
    this.supabaseKey = config.get<string>('SUPABASE_SERVICE_KEY', '');
    if (
      this.provider === 'supabase' &&
      (!this.supabaseUrl || !this.supabaseKey)
    ) {
      throw new Error(
        'SUPABASE_URL và SUPABASE_SERVICE_KEY là bắt buộc khi STORAGE_DRIVER=supabase.',
      );
    }
  }

  async put(
    key: string,
    source: Readable,
    expectedBytes: number,
    mimeType: string,
  ): Promise<void> {
    if (this.provider === 'supabase') {
      await this.putSupabase(key, source, expectedBytes, mimeType);
      return;
    }
    const target = this.localPath(key);
    await mkdir(dirname(target), { recursive: true });
    let received = 0;
    const counter = new Transform({
      transform(
        chunk: Buffer,
        _encoding: BufferEncoding,
        callback: TransformCallback,
      ) {
        received += chunk.length;
        callback(
          received > expectedBytes
            ? new Error('Nội dung upload vượt quá Content-Length đã khai báo.')
            : null,
          chunk,
        );
      },
    });
    try {
      await pipeline(
        source,
        counter,
        createWriteStream(target, { flags: 'wx' }),
      );
      if (received !== expectedBytes) {
        throw new Error(
          'Kích thước video nhận được không khớp Content-Length.',
        );
      }
    } catch (error) {
      // 'wx' thất bại với EEXIST nghĩa là object thuộc về lần ghi khác; không được xóa.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        await unlink(target).catch(() => undefined);
      }
      throw error;
    }
  }

  async open(
    key: string,
    mimeType: string,
    range?: ByteRange,
  ): Promise<StoredObjectRead> {
    if (this.provider === 'supabase') {
      return this.openSupabase(key, mimeType, range);
    }
    const target = this.localPath(key);
    const metadata = await stat(target);
    const start = range?.start ?? 0;
    const end = Math.min(range?.end ?? metadata.size - 1, metadata.size - 1);
    if (start < 0 || start >= metadata.size || end < start) {
      throw videoRangeNotSatisfiable();
    }
    return {
      stream: createReadStream(target, { start, end }),
      size: metadata.size,
      start,
      end,
      mimeType,
      partial: range !== undefined,
    };
  }

  async delete(key: string): Promise<void> {
    if (this.provider === 'supabase') {
      const response = await fetch(this.objectUrl(key), {
        method: 'DELETE',
        headers: this.supabaseHeaders(),
      });
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Supabase Storage từ chối xóa object (${response.status}).`,
        );
      }
      return;
    }
    await unlink(this.localPath(key)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private localPath(key: string): string {
    const target = resolve(this.localRoot, key);
    if (!target.startsWith(`${this.localRoot}${sep}`)) {
      throw new Error('Storage key không hợp lệ.');
    }
    return target;
  }

  private async putSupabase(
    key: string,
    source: Readable,
    expectedBytes: number,
    mimeType: string,
  ): Promise<void> {
    const response = await fetch(this.objectUrl(key), {
      method: 'POST',
      headers: {
        ...this.supabaseHeaders(),
        'Content-Type': mimeType,
        'Content-Length': String(expectedBytes),
        'x-upsert': 'false',
      },
      body: source as unknown as BodyInit,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });
    if (!response.ok) {
      throw new Error(`Supabase Storage từ chối upload (${response.status}).`);
    }
  }

  private async openSupabase(
    key: string,
    mimeType: string,
    range?: ByteRange,
  ): Promise<StoredObjectRead> {
    const headers: Record<string, string> = this.supabaseHeaders();
    if (range) {
      headers.Range = `bytes=${range.start}-${range.end ?? ''}`;
    }
    const response = await fetch(this.objectUrl(key), {
      headers,
      cache: 'no-store',
    });
    if (!response.ok || !response.body) {
      throw new Error(`Không thể đọc object video (${response.status}).`);
    }
    const contentRange = response.headers.get('content-range');
    const match = contentRange?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
    const size = match
      ? Number(match[3])
      : Number(response.headers.get('content-length'));
    const start = match ? Number(match[1]) : 0;
    const end = match ? Number(match[2]) : size - 1;
    return {
      stream: Readable.fromWeb(response.body as never),
      size,
      start,
      end,
      mimeType,
      partial: response.status === 206,
    };
  }

  private objectUrl(key: string): string {
    const encoded = key.split('/').map(encodeURIComponent).join('/');
    return `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${encoded}`;
  }

  private supabaseHeaders(): Record<string, string> {
    return {
      apikey: this.supabaseKey,
      Authorization: `Bearer ${this.supabaseKey}`,
    };
  }
}
