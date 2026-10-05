import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  analysisJobs,
  sessionExercises,
  trainingSessions,
  type HealthAlert,
  type JointStatesMap,
} from '../database/schema.js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { VideosService } from '../videos/videos.service.js';
import { VideoAccessService } from '../videos/video-access.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';

const workerResultBoundarySchema = z
  .object({
    schemaVersion: z.literal('1.0.0').optional(),
    meta: z
      .object({
        fps: z.number().finite().nonnegative(),
        totalFrames: z.number().int().nonnegative(),
        durationMs: z.number().finite().nonnegative(),
      })
      .passthrough(),
    frames: z.array(z.unknown()),
    kicks: z.array(z.unknown()),
  })
  .passthrough();

@Injectable()
export class JobsService {
  private readonly resultBucket: string;
  private readonly supabaseOrigin: string;

  constructor(
    @InjectQueue('video-analysis') private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
    private readonly videosService: VideosService,
    private readonly videoAccess: VideoAccessService,
  ) {
    this.resultBucket = config.get<string>(
      'ANALYSIS_RESULTS_BUCKET',
      'analysis-results',
    );
    this.supabaseOrigin = new URL(
      config.getOrThrow<string>('SUPABASE_URL'),
    ).origin;
  }

  async createJob(actor: AuthenticatedUser, dto: CreateJobDto) {
    const { video, url } = await this.videosService.signedWorkerUrl(
      actor,
      dto.videoId,
    );

    let exercise: typeof sessionExercises.$inferSelect | undefined;
    if (dto.sessionExerciseId) {
      const [row] = await this.db.select({ exercise: sessionExercises }).from(sessionExercises)
        .innerJoin(trainingSessions, eq(trainingSessions.id, sessionExercises.sessionId))
        .where(and(eq(sessionExercises.id, dto.sessionExerciseId),
          eq(trainingSessions.id, video.sessionId ?? '00000000-0000-0000-0000-000000000000'),
          eq(trainingSessions.fighterId, video.subjectFighterId),
          eq(trainingSessions.isActive, true), isNull(trainingSessions.deletedAt))).limit(1);
      if (!row || !video.sessionId) throw new BadRequestException('The exercise must belong to this video session and fighter.');
      exercise = row.exercise;
    }
    const evidenceContext = {
      exerciseId: exercise?.exerciseId ?? null, sessionExerciseId: exercise?.id ?? null,
      sessionId: video.sessionId, exerciseName: exercise?.exerciseNameSnapshot ?? null,
      protocolId: dto.evidenceProtocol ?? 'whole_body_v1' as const,
      purpose: 'training' as const, selectedBy: actor.id,
    };
    let job: typeof analysisJobs.$inferSelect;
    try {
      [job] = await this.db
        .insert(analysisJobs)
        .values({
          userId: actor.id,
          videoUrl: url,
          status: 'PENDING',
          fighterId: video.subjectFighterId,
          sessionId: video.sessionId,
          videoId: video.id,
          createdById: actor.id,
          evidenceContext,
        })
        .returning();
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'VIDEO_JOB_EXISTS',
          message: 'This video already has an analysis job',
        });
      }
      throw error;
    }

    try {
      await this.queue.add(
        'analyze',
        {
          jobId: job.id,
          videoId: video.id,
          videoUrl: url,
          trainingMode: video.trainingType,
          cameraView: video.cameraAngle,
          exerciseContext: { exerciseId: evidenceContext.exerciseId, protocolId: evidenceContext.protocolId, purpose: evidenceContext.purpose },
        },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );
    } catch {
      await this.db.delete(analysisJobs).where(eq(analysisJobs.id, job.id));
      throw new ServiceUnavailableException({
        code: 'ANALYSIS_QUEUE_UNAVAILABLE',
        message: 'The analysis queue is unavailable',
      });
    }

    return { jobId: job.id, status: job.status };
  }

  async getJob(id: string) {
    const [job] = await this.db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.id, id))
      .limit(1);
    if (!job)
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Analysis job not found',
      });
    return job;
  }

  async getJobForActor(actor: AuthenticatedUser, id: string) {
    const job = await this.getJob(id);
    if (!job.fighterId)
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: 'Analysis job not found',
      });
    await this.videoAccess.assertFighterAccess(actor, job.fighterId);
    return job;
  }

  async listJobs(actor: AuthenticatedUser) {
    const rows = await this.db
      .select()
      .from(analysisJobs)
      .orderBy(desc(analysisJobs.createdAt))
      .limit(100);
    const accessibleIds = await this.videoAccess.accessibleFighterIds(
      actor,
      rows.flatMap((job) => (job.fighterId ? [job.fighterId] : [])),
    );
    return rows.filter(
      (job) => job.fighterId && accessibleIds.has(job.fighterId),
    );
  }

  async getResult(actor: AuthenticatedUser, id: string): Promise<unknown> {
    const job = await this.getJobForActor(actor, id);
    if (job.status !== 'DONE') {
      throw new ConflictException({
        code: 'JOB_NOT_COMPLETE',
        message: 'The analysis result is not ready',
      });
    }
    if (!job.resultUrl)
      throw new NotFoundException({
        code: 'JOB_RESULT_NOT_FOUND',
        message: 'Analysis result not found',
      });
    const storageKey = this.resultStorageKey(job.resultUrl);
    const { data, error } = await this.supabase.storage
      .from(this.resultBucket)
      .download(storageKey);
    if (error || !data)
      throw new BadGatewayException({
        code: 'JOB_RESULT_UNAVAILABLE',
        message: 'The analysis result is unavailable',
      });
    if (data.size > 25 * 1024 * 1024)
      throw new BadGatewayException({
        code: 'JOB_RESULT_TOO_LARGE',
        message: 'The analysis result exceeds the allowed size',
      });
    let json: unknown;
    try {
      json = JSON.parse(await data.text());
    } catch {
      throw new BadGatewayException({
        code: 'JOB_RESULT_INVALID',
        message: 'The analysis result is invalid',
      });
    }
    const parsed = workerResultBoundarySchema.safeParse(json);
    if (!parsed.success)
      throw new BadGatewayException({
        code: 'JOB_RESULT_INVALID',
        message: 'The analysis result does not match the worker contract',
      });
    return parsed.data;
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

  async listImpairmentAlerts(actor: AuthenticatedUser) {
    const rows = await this.db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.hasImpairment, true))
      .orderBy(desc(analysisJobs.createdAt))
      .limit(50);
    const accessibleIds = await this.videoAccess.accessibleFighterIds(
      actor,
      rows.flatMap((job) => (job.fighterId ? [job.fighterId] : [])),
    );
    return rows.filter(
      (job) => job.fighterId && accessibleIds.has(job.fighterId),
    );
  }

  async updateJobStatus(id: string, dto: UpdateJobStatusDto) {
    const current = await this.getJob(id);
    // A committed callback may lose its HTTP response. Accept only an identical
    // completion receipt on retry; never let a terminal result be replaced.
    if (current.status === 'DONE' && dto.status === 'DONE' &&
        current.resultUrl === dto.resultUrl && (current.score ?? null) === (dto.score ?? null)) {
      return current;
    }
    if (current.status === 'DONE' || current.status === 'FAILED') {
      throw new ConflictException({
        code: 'JOB_TERMINAL',
        message: 'A terminal analysis job cannot change state',
      });
    }
    if (current.status === 'PENDING' && dto.status === 'DONE') {
      throw new ConflictException({
        code: 'JOB_STATUS_CONFLICT',
        message: 'A pending job must enter processing before completion',
      });
    }
    if (dto.status === 'DONE') {
      if (!dto.resultUrl) {
        throw new BadRequestException({
          code: 'JOB_RESULT_REQUIRED',
          message: 'A completed job requires a result URL',
        });
      }
      this.resultStorageKey(dto.resultUrl);
    }
    const alerts = dto.healthAlerts ?? [];
    const [updated] = await this.db
      .update(analysisJobs)
      .set({
        status: dto.status as typeof current.status,
        resultUrl: dto.resultUrl,
        score: dto.score,
        healthAlerts: alerts,
        jointStates: dto.jointStates ?? {},
        alertCount: alerts.length,
        hasImpairment: alerts.length > 0,
        updatedAt: new Date(),
      })
      .where(eq(analysisJobs.id, id))
      .returning();
    if (current.videoId) {
      const videoStatus =
        dto.status === 'PROCESSING'
          ? 'PROCESSING'
          : dto.status === 'DONE'
            ? 'PROCESSED'
            : dto.status === 'FAILED'
              ? 'FAILED'
              : undefined;
      if (videoStatus)
        await this.videosService.markStatus(current.videoId, videoStatus);
    }
    return updated;
  }

  private resultStorageKey(rawUrl: string): string {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadGatewayException({
        code: 'JOB_RESULT_URL_INVALID',
        message: 'The analysis result location is invalid',
      });
    }
    const prefix = `/storage/v1/object/public/${this.resultBucket}/`;
    if (
      url.origin !== this.supabaseOrigin ||
      !url.pathname.startsWith(prefix)
    ) {
      throw new BadGatewayException({
        code: 'JOB_RESULT_URL_INVALID',
        message: 'The analysis result location is not trusted',
      });
    }
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    if (
      !key ||
      key
        .split('/')
        .some(
          (segment) =>
            segment === '..' || segment === '.' || segment.includes('\\'),
        )
    ) {
      throw new BadGatewayException({
        code: 'JOB_RESULT_URL_INVALID',
        message: 'The analysis result location is invalid',
      });
    }
    return key;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === '23505'
    );
  }
}
