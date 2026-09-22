import { ServiceUnavailableException } from '@nestjs/common';
import type { Queue } from 'bullmq';
import type { DrizzleDB } from './database/database.module.js';
import { AppReadinessService } from './app-readiness.service.js';

function queueWithRedisStatus(status: string) {
  return {
    getBackend: () => ({ client: Promise.resolve({ status }) }),
  } as unknown as Queue;
}

async function readinessError(service: AppReadinessService) {
  const error = await service.check().catch((reason: unknown) => reason);
  expect(error).toBeInstanceOf(ServiceUnavailableException);
  expect((error as ServiceUnavailableException).getResponse()).toMatchObject({
    code: 'SERVICE_NOT_READY',
  });
}

describe('AppReadinessService', () => {
  it('reports PostgreSQL and Redis as ready', async () => {
    const database = { execute: vi.fn().mockResolvedValue([]) };
    const service = new AppReadinessService(
      database as unknown as DrizzleDB,
      queueWithRedisStatus('ready'),
    );

    await expect(service.check()).resolves.toMatchObject({
      status: 'ready',
      dependencies: { postgres: 'up', redis: 'up' },
    });
  });

  it('returns a safe unavailable error when a dependency fails', async () => {
    const database = {
      execute: vi.fn().mockRejectedValue(new Error('connection detail')),
    };
    const service = new AppReadinessService(
      database as unknown as DrizzleDB,
      queueWithRedisStatus('ready'),
    );

    await readinessError(service);
  });

  it('reports unavailable while Redis is reconnecting', async () => {
    const database = { execute: vi.fn().mockResolvedValue([]) };
    const service = new AppReadinessService(
      database as unknown as DrizzleDB,
      queueWithRedisStatus('reconnecting'),
    );

    await readinessError(service);
  });
});
