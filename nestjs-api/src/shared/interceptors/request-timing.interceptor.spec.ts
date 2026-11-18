import { NotFoundException, type ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import {
  isApiTimingLogEnabled,
  RequestTimingInterceptor,
} from './request-timing.interceptor.js';

function httpContext(statusCode = 200): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => ({
        method: 'GET',
        originalUrl: '/fighters?search=Nguyen&page=1',
      }),
      getResponse: () => ({ statusCode }),
    }),
  } as unknown as ExecutionContext;
}

function clock(...ticks: number[]) {
  const now = vi.fn();
  for (const tick of ticks) now.mockReturnValueOnce(tick);
  return now;
}

describe('isApiTimingLogEnabled', () => {
  it('is on only for API_TIMING_LOG=1', () => {
    expect(isApiTimingLogEnabled('1')).toBe(true);
    expect(isApiTimingLogEnabled(undefined)).toBe(false);
    expect(isApiTimingLogEnabled('0')).toBe(false);
    expect(isApiTimingLogEnabled('true')).toBe(false);
  });
});

describe('RequestTimingInterceptor', () => {
  it('logs method, path without query, status and duration', async () => {
    const logger = { log: vi.fn() };
    const interceptor = new RequestTimingInterceptor(logger, clock(100, 342.4));

    const result = await lastValueFrom(
      interceptor.intercept(httpContext(200), { handle: () => of({ ok: true }) }),
    );

    expect(result).toEqual({ ok: true });
    expect(logger.log).toHaveBeenCalledWith('GET /fighters 200 242ms');
  });

  it('logs the status of a failed request and rethrows', async () => {
    const logger = { log: vi.fn() };
    const interceptor = new RequestTimingInterceptor(logger, clock(0, 15));

    await expect(
      lastValueFrom(
        interceptor.intercept(httpContext(), {
          handle: () => throwError(() => new NotFoundException()),
        }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(logger.log).toHaveBeenCalledWith('GET /fighters 404 15ms');
  });

  it('passes non-HTTP contexts through untouched', async () => {
    const logger = { log: vi.fn() };
    const interceptor = new RequestTimingInterceptor(logger);
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;

    await lastValueFrom(interceptor.intercept(context, { handle: () => of(1) }));
    expect(logger.log).not.toHaveBeenCalled();
  });
});
