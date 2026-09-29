import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { CoachingController, CoachingWorkerController } from '../src/coaching/coaching.controller.js';
import { AccessTokenGuard, AuthorizationGuard } from '../src/shared/guards/auth.guard.js';
import { WorkerAuthGuard } from '../src/jobs/guards/worker-auth.guard.js';
import { REQUIRED_ROLES } from '../src/shared/decorators/auth.decorator.js';

describe('coaching authentication boundary', () => {
  it('declares allowed user roles so AuthorizationGuard does not fail every route closed', () => {
    expect(Reflect.getMetadata(REQUIRED_ROLES, CoachingController)).toEqual([
      'FIGHTER',
      'COACH',
      'ADMIN',
    ]);
    expect(Reflect.getMetadata(GUARDS_METADATA, CoachingController)).toEqual([
      AccessTokenGuard,
      AuthorizationGuard,
    ]);
  });

  it('isolates result persistence behind the worker secret rather than a spoofable user identity', () => {
    const handler = CoachingWorkerController.prototype.persistWorkerResult;
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([WorkerAuthGuard]);
    expect(Reflect.getMetadata(GUARDS_METADATA, CoachingWorkerController)).toBeUndefined();
  });

  it('rejects the historical development fallback token', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-worker-secret': 'mma-tms-worker-local-secret-2026' } }),
      }),
    } as any;

    expect(() => new WorkerAuthGuard().canActivate(context)).toThrowError(
      /Worker Secret Token/,
    );
  });
});
