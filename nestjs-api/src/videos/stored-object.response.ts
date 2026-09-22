import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { pipeline } from 'node:stream';
import type { ByteRange, StoredObjectRead } from './object-storage.service.js';
import { videoRangeNotSatisfiable } from './videos.error.js';

/** Chỉ hỗ trợ một khoảng `bytes=start-[end]`; định dạng khác trả về 416. */
export function parseByteRange(
  value: string | undefined,
): ByteRange | undefined {
  if (!value) return undefined;
  const match = value.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) throw videoRangeNotSatisfiable();
  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : undefined,
  };
}

/** Stream object riêng tư về client với header range và no-store. */
export function sendStoredObject(
  response: Response,
  content: StoredObjectRead,
): void {
  response.status(content.partial ? HttpStatus.PARTIAL_CONTENT : HttpStatus.OK);
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', content.mimeType);
  response.setHeader('Content-Length', String(content.end - content.start + 1));
  response.setHeader('Cache-Control', 'private, no-store');
  if (content.partial) {
    response.setHeader(
      'Content-Range',
      `bytes ${content.start}-${content.end}/${content.size}`,
    );
  }
  // pipeline hủy stream nguồn khi client ngắt kết nối; lỗi đọc giữa chừng chỉ
  // đóng response thay vì phát 'error' không có listener làm sập tiến trình.
  pipeline(content.stream, response, () => undefined);
}
