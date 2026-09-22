import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkerAuthGuard } from './worker-auth.guard.js';

function contextWithHeaders(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  } as unknown as ExecutionContext;
}

describe('WorkerAuthGuard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the configured secret from either supported header', () => {
    vi.stubEnv('WORKER_SECRET_TOKEN', 'worker-secret');
    const guard = new WorkerAuthGuard();

    expect(
      guard.canActivate(
        contextWithHeaders({ 'x-worker-secret': 'worker-secret' }),
      ),
    ).toBe(true);
    expect(
      guard.canActivate(
        contextWithHeaders({ authorization: 'Bearer worker-secret' }),
      ),
    ).toBe(true);
  });

  it('rejects a wrong or differently sized secret', () => {
    vi.stubEnv('WORKER_SECRET_TOKEN', 'worker-secret');
    const guard = new WorkerAuthGuard();

    for (const provided of ['worker-secreT', 'short', 'worker-secret-extra']) {
      expect(() =>
        guard.canActivate(contextWithHeaders({ 'x-worker-secret': provided })),
      ).toThrow(UnauthorizedException);
    }
  });

  it('fails closed when no secret is configured', () => {
    vi.stubEnv('WORKER_SECRET_TOKEN', '');
    const guard = new WorkerAuthGuard();

    expect(() =>
      guard.canActivate(contextWithHeaders({ 'x-worker-secret': '' })),
    ).toThrow(UnauthorizedException);
  });
});
