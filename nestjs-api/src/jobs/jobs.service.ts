import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, desc, and } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { analysisJobs, type HealthAlert, type JointStatesMap } from '../database/schema.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('video-analysis') private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  // ─── Tạo job mới ────────────────────────────────────────────────────────────

  async createJob(dto: CreateJobDto) {
    // 1. Lưu job metadata vào PostgreSQL
    const [job] = await this.db
      .insert(analysisJobs)
      .values({
        videoUrl: dto.videoUrl,
        userId: dto.userId ?? 'anonymous',
        status: 'PENDING',
      })
      .returning();

    // 2. Đẩy job vào BullMQ queue
    await this.queue.add(
      'analyze',
      { jobId: job.id, videoUrl: job.videoUrl },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    );

    return {
      jobId: job.id,
      status: job.status,
      message: 'Job đã được tạo và đưa vào hàng đợi',
    };
  }

  // ─── Lấy thông tin job ───────────────────────────────────────────────────────

  async getJob(id: string) {
    const [job] = await this.db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.id, id))
      .limit(1);

    if (!job) throw new NotFoundException(`Không tìm thấy job: ${id}`);
    return job;
  }

  // ─── Danh sách jobs ──────────────────────────────────────────────────────────

  async listJobs(userId?: string) {
    return this.db
      .select()
      .from(analysisJobs)
      .where(userId ? eq(analysisJobs.userId, userId) : undefined)
      .orderBy(desc(analysisJobs.createdAt))
      .limit(20);
  }

  // ─── Lấy health alerts của một job ──────────────────────────────────────────

  /**
   * Trả về danh sách CONFIRMED_IMPAIRMENT alerts của job,
   * cùng với snapshot trạng thái từng khớp.
   */
  async getHealthAlerts(jobId: string) {
    const job = await this.getJob(jobId);
    return {
      jobId,
      status:       job.status,
      alertCount:   job.alertCount,
      hasImpairment: job.hasImpairment,
      healthAlerts: job.healthAlerts as HealthAlert[],
      jointStates:  job.jointStates as JointStatesMap,
    };
  }

  /**
   * Lấy tất cả jobs có cảnh báo chấn thương (has_impairment = true).
   * Dùng partial index idx_analysis_jobs_has_impairment — rất nhanh.
   */
  async listImpairmentAlerts(userId?: string) {
    return this.db
      .select({
        id:            analysisJobs.id,
        userId:        analysisJobs.userId,
        videoUrl:      analysisJobs.videoUrl,
        status:        analysisJobs.status,
        score:         analysisJobs.score,
        alertCount:    analysisJobs.alertCount,
        hasImpairment: analysisJobs.hasImpairment,
        healthAlerts:  analysisJobs.healthAlerts,
        jointStates:   analysisJobs.jointStates,
        createdAt:     analysisJobs.createdAt,
      })
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.hasImpairment, true),
          userId ? eq(analysisJobs.userId, userId) : undefined,
        ),
      )
      .orderBy(desc(analysisJobs.createdAt))
      .limit(50);
  }

  // ─── Cập nhật trạng thái (gọi bởi Python Worker) ────────────────────────────

  /**
   * Python Worker gọi endpoint này sau khi xử lý xong video.
   * Bao gồm cả healthAlerts và jointStates từ SessionHealthMonitor.
   */
  async updateJobStatus(id: string, dto: UpdateJobStatusDto) {
    const alerts = dto.healthAlerts ?? [];
    const alertCount = alerts.length;
    const hasImpairment = alertCount > 0;

    const [updated] = await this.db
      .update(analysisJobs)
      .set({
        status:        dto.status as any,
        resultUrl:     dto.resultUrl,
        score:         dto.score,
        // ── Anomaly Detection fields ──
        healthAlerts:  alerts,
        jointStates:   dto.jointStates ?? {},
        alertCount,
        hasImpairment,
        updatedAt:     new Date(),
      })
      .where(eq(analysisJobs.id, id))
      .returning();

    return updated;
  }
}
