import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { parseByteRange } from './stored-object.response.js';

describe('parseByteRange', () => {
  it('parses open and closed single byte ranges', () => {
    expect(parseByteRange(undefined)).toBeUndefined();
    expect(parseByteRange('bytes=5-')).toEqual({ start: 5, end: undefined });
    expect(parseByteRange('bytes=0-99')).toEqual({ start: 0, end: 99 });
  });

  it('rejects unsupported range syntax with 416', () => {
    for (const value of ['bytes=-5', 'bytes=0-1,4-5', 'items=0-1']) {
      const error = (() => {
        try {
          return parseByteRange(value);
        } catch (reason) {
          return reason;
        }
      })();
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(
        HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE,
      );
    }
  });
});
