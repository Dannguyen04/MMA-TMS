import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { analysisJobs } from '../database/schema.js';
import { CreateJobDto } from './dto/create-job.dto.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectQueue('video-analysis') private readonly queue: Queue,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

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

  async getJob(id: string) {
    const [job] = await this.db
      .select()
      .from(analysisJobs)
      .where(eq(analysisJobs.id, id))
      .limit(1);

    if (!job) throw new NotFoundException(`Không tìm thấy job: ${id}`);
    return job;
  }

  async updateJobStatus(
    id: string,
    data: { status: string; resultUrl?: string; score?: number },
  ) {
    const [updated] = await this.db
      .update(analysisJobs)
      .set({
        status: data.status as any,
        resultUrl: data.resultUrl,
        score: data.score,
        updatedAt: new Date(),
      })
      .where(eq(analysisJobs.id, id))
      .returning();

    return updated;
  }

  async listJobs(userId?: string) {
    return this.db
      .select()
      .from(analysisJobs)
      .where(userId ? eq(analysisJobs.userId, userId) : undefined)
      .orderBy(analysisJobs.createdAt)
      .limit(20);
  }
}
