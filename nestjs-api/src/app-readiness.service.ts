import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from './database/database.module.js';
import { VIDEO_ANALYSIS_QUEUE } from './jobs/jobs.model.js';

const READINESS_TIMEOUT_MS = 3_000;

/** Probe treo (mất kết nối, hàng đợi lệnh offline) phải trả 503 thay vì giữ request. */
async function withTimeout<T>(probe: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error('Readiness probe timed out')),
      READINESS_TIMEOUT_MS,
    );
  });
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

@Injectable()
export class AppReadinessService {
  constructor(
    @Inject(DRIZZLE) private readonly database: DrizzleDB,
    @InjectQueue(VIDEO_ANALYSIS_QUEUE) private readonly queue: Queue,
  ) {}

  async check() {
    try {
      const [, redis] = await Promise.all([
        withTimeout(this.database.execute(sql`select 1`)),
        // waitUntilReady() chỉ phản ánh lần kết nối đầu tiên; cần trạng thái hiện tại.
        withTimeout(this.queue.getBackend().client),
      ]);
      if (redis.status !== 'ready') throw new Error('Redis is not ready');
      return {
        status: 'ready',
        dependencies: { postgres: 'up', redis: 'up' },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        statusCode: 503,
        error: 'Service Unavailable',
        code: 'SERVICE_NOT_READY',
        message: 'Database or queue dependency is unavailable',
      });
    }
  }
}
