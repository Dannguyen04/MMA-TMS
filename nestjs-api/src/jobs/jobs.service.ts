import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, desc, eq } from 'drizzle-orm';
import { Readable } from 'node:stream';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  type AnalysisJob,
  analysisJobs,
  type HealthAlert,
  type InsertAnalysisJob,
  type JointStatesMap,
  videos,
} from '../database/schema.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { VideosService } from '../videos/videos.service.js';
import {
  type ByteRange,
  ObjectStorageService,
} from '../videos/object-storage.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import {
  VIDEO_ANALYSIS_QUEUE,
  type WorkerAnalysisResult,
  workerAnalysisResultSchema,
} from './jobs.model.js';

const MAX_WORKER_RESULT_BYTES = 100 * 1024 * 1024;

function resultStorageKey(jobId: string): string {
  return `analysis-results/${jobId}.json`;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue(VIDEO_ANALYSIS_QUEUE) private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly videosService: VideosService,
    private readonly storage: ObjectStorageService,
  ) {}

  async createJob(actor: AuthenticatedUser, dto: CreateJobDto) {
    const video = await this.videosService.findOne(actor, dto.videoId);
    const [job] = await this.db
      .insert(analysisJobs)
      .values({
        videoUrl: `/videos/${video.id}/content`,
        userId: actor.id,
        fighterId: video.fighterId,
        sessionId: video.sessionId,
        videoId: video.id,
        createdById: actor.id,
        status: 'PENDING',
      })
      .returning();

    if (!job) throw new Error('Không thể tạo công việc phân tích video.');

    try {
      await this.queue.add(
        'analyze',
        { jobId: job.id, videoId: video.id, schemaVersion: '1.0.0' },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );
    } catch (error) {
      // Không để lại bản ghi PENDING nếu Redis từ chối nhận công việc.
      await this.db.delete(analysisJobs).where(eq(analysisJobs.id, job.id));
      throw error;
    }

    return { jobId: job.id, status: job.status };
  }

  async getJobForActor(actor: AuthenticatedUser, id: string) {
    const job = await this.findJob(id);
    this.assertCanRead(actor, job);
    return job;
  }

  async listJobs(actor: AuthenticatedUser, requestedUserId?: string) {
    const userId = actor.role === 'ADMIN' ? requestedUserId : actor.id;
    return this.db
      .select()
      .from(analysisJobs)
      .where(userId ? eq(analysisJobs.userId, userId) : undefined)
      .orderBy(desc(analysisJobs.createdAt))
      .limit(20);
  }

  async getHealthAlerts(actor: AuthenticatedUser, jobId: string) {
    const job = await this.getJobForActor(actor, jobId);
    return {
      jobId,
      status: job.status,
      alertCount: job.alertCount,
      hasImpairment: job.hasImpairment,
      healthAlerts: job.healthAlerts as HealthAlert[],
      jointStates: job.jointStates as JointStatesMap,
    };
  }

  async openWorkerInput(jobId: string, range?: ByteRange) {
    const job = await this.findJob(jobId);
    if (!job.videoId) {
      throw new NotFoundException({
        code: 'JOB_VIDEO_NOT_FOUND',
        message: 'Analysis job has no persisted video input',
      });
    }
    return this.videosService.openWorkerContent(job.videoId, range);
  }

  async finalizeWorkerResult(
    id: string,
    source: Readable,
    contentLength: number,
  ) {
    const current = await this.findJob(id);
    if (current.status === 'DONE') return current;
    if (current.status !== 'PROCESSING' || !current.videoId) {
      throw this.transitionConflict(current.status, 'DONE');
    }
    if (
      !Number.isSafeInteger(contentLength) ||
      contentLength <= 0 ||
      contentLength > MAX_WORKER_RESULT_BYTES
    ) {
      throw new ConflictException({
        code: 'JOB_RESULT_SIZE_INVALID',
        message: 'Worker result size is missing or exceeds 100 MB',
      });
    }

    const result = await this.readWorkerResult(source, contentLength);
    const storageKey = resultStorageKey(id);
    const serialized = JSON.stringify(result);
    await this.storage.put(
      storageKey,
      Readable.from(serialized),
      Buffer.byteLength(serialized),
      'application/json',
    );
    try {
      const updated = await this.db.transaction(async (transaction) => {
        const summary = result.summary;
        const alerts: HealthAlert[] = result.healthAlerts ?? [];
        const jointStates = (summary.jointHealthStates ?? {}) as JointStatesMap;
        const score =
          typeof summary.bestScore === 'number'
            ? Math.max(0, Math.min(100, Math.round(summary.bestScore)))
            : null;
        const [job] = await transaction
          .update(analysisJobs)
          .set({
            status: 'DONE',
            resultUrl: `/jobs/${id}/result`,
            score,
            healthAlerts: alerts,
            jointStates,
            alertCount: alerts.length,
            hasImpairment: alerts.length > 0,
            updatedAt: new Date(),
          })
          .where(
            and(eq(analysisJobs.id, id), eq(analysisJobs.status, 'PROCESSING')),
          )
          .returning();
        if (!job) throw this.transitionConflict(current.status, 'DONE');
        await transaction
          .update(videos)
          .set({ status: 'PROCESSED', updatedAt: new Date() })
          .where(eq(videos.id, current.videoId!));
        return job;
      });
      return updated;
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async getResultForActor(actor: AuthenticatedUser, id: string) {
    const job = await this.getJobForActor(actor, id);
    if (job.status !== 'DONE') {
      throw new NotFoundException({
        code: 'JOB_RESULT_NOT_FOUND',
        message: 'Analysis result is not available yet',
      });
    }
    const stored = await this.storage.open(
      resultStorageKey(id),
      'application/json',
    );
    const chunks: Buffer[] = [];
    for await (const chunk of stored.stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return workerAnalysisResultSchema.parse(
      JSON.parse(Buffer.concat(chunks).toString('utf8')),
    );
  }

  async listImpairmentAlerts(
    actor: AuthenticatedUser,
    requestedUserId?: string,
  ) {
    if (actor.role !== 'ADMIN') throw forbidden();

    return this.db
      .select({
        id: analysisJobs.id,
        userId: analysisJobs.userId,
        videoUrl: analysisJobs.videoUrl,
        status: analysisJobs.status,
        score: analysisJobs.score,
        alertCount: analysisJobs.alertCount,
        hasImpairment: analysisJobs.hasImpairment,
        healthAlerts: analysisJobs.healthAlerts,
        jointStates: analysisJobs.jointStates,
        createdAt: analysisJobs.createdAt,
      })
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.hasImpairment, true),
          requestedUserId
            ? eq(analysisJobs.userId, requestedUserId)
            : undefined,
        ),
      )
      .orderBy(desc(analysisJobs.createdAt))
      .limit(50);
  }

  async updateJobStatus(id: string, dto: UpdateJobStatusDto) {
    const current = await this.findJob(id);
    if (current.status === dto.status) return current;
    if (current.status === 'DONE' || current.status === 'FAILED') {
      throw this.transitionConflict(current.status, dto.status);
    }

    const update: Partial<InsertAnalysisJob> = {
      status: dto.status,
      updatedAt: new Date(),
    };

    if (dto.status === 'DONE') {
      const alerts = dto.healthAlerts ?? [];
      update.resultUrl = dto.resultUrl;
      update.score = dto.score;
      update.healthAlerts = alerts;
      update.jointStates = dto.jointStates ?? {};
      update.alertCount = alerts.length;
      update.hasImpairment = alerts.length > 0;
    }

    const [updated] = await this.db
      .update(analysisJobs)
      .set(update)
      .where(
        and(eq(analysisJobs.id, id), eq(analysisJobs.status, current.status)),
      )
      .returning();

    if (updated) return updated;
    const raced = await this.findJob(id);
    if (raced.status === dto.status) return raced;
    throw this.transitionConflict(raced.status, dto.status);
  }

  private async findJob(id: string): Promise<AnalysisJob> {
    const [job] = await this.db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.id, id))
      .limit(1);

    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Analysis job not found',
      });
    }
    return job;
  }

  private async readWorkerResult(
    source: Readable,
    expectedBytes: number,
  ): Promise<WorkerAnalysisResult> {
    const chunks: Buffer[] = [];
    let received = 0;
    for await (const chunk of source) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      received += bytes.length;
      if (received > expectedBytes) {
        throw new ConflictException({
          code: 'JOB_RESULT_SIZE_INVALID',
          message: 'Worker result exceeded its declared size',
        });
      }
      chunks.push(bytes);
    }
    if (received !== expectedBytes) {
      throw new ConflictException({
        code: 'JOB_RESULT_SIZE_INVALID',
        message: 'Worker result did not match its declared size',
      });
    }
    try {
      return workerAnalysisResultSchema.parse(
        JSON.parse(Buffer.concat(chunks).toString('utf8')),
      );
    } catch {
      throw new ConflictException({
        code: 'JOB_RESULT_INVALID',
        message: 'Worker result failed schema validation',
      });
    }
  }

  private assertCanRead(actor: AuthenticatedUser, job: AnalysisJob): void {
    if (actor.role !== 'ADMIN' && job.userId !== actor.id) throw forbidden();
  }

  private transitionConflict(current: string, requested: string) {
    return new ConflictException({
      code: 'JOB_STATUS_CONFLICT',
      message: `Cannot change analysis job from ${current} to ${requested}`,
    });
  }
}
