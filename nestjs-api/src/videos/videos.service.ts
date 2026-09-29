import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ilike, isNull, or } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { fighters, trainingSessions, videos } from '../database/schema.js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { VideoAccessService } from './video-access.service.js';
import type { ListVideosQueryDto, UploadVideoQueryDto } from './videos.dto.js';

const ALLOWED_VIDEO_TYPES = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
]);

@Injectable()
export class VideosService {
  private readonly bucket: string;
  private readonly maxBytes: number;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    @Inject(SUPABASE_ADMIN_CLIENT) private readonly supabase: SupabaseClient,
    private readonly config: ConfigService,
    private readonly access: VideoAccessService,
  ) {
    this.bucket = config.get<string>('VIDEO_STORAGE_BUCKET', 'videos');
    this.maxBytes = config.get<number>('VIDEO_MAX_SIZE_MB', 500) * 1024 * 1024;
  }

  async upload(
    actor: AuthenticatedUser,
    metadata: UploadVideoQueryDto,
    request: Request,
  ) {
    await this.assertUploadContext(actor, metadata);
    const contentType = (request.headers['content-type'] ?? '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const extension = ALLOWED_VIDEO_TYPES.get(contentType);
    if (!extension) {
      throw new BadRequestException({
        code: 'VIDEO_FORMAT_UNSUPPORTED',
        message: 'Only MP4, MOV, and WebM video files are supported',
      });
    }

    const declaredLength = Number(request.headers['content-length']);
    if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0) {
      throw new BadRequestException({
        code: 'VIDEO_SIZE_REQUIRED',
        message: 'A valid Content-Length header is required',
      });
    }
    if (declaredLength > this.maxBytes) {
      throw new PayloadTooLargeException({
        code: 'VIDEO_TOO_LARGE',
        message: 'The video exceeds the configured upload limit',
      });
    }

    const videoId = randomUUID();
    const storageKey = `${metadata.fighterId}/${videoId}/source${extension}`;
    await this.streamToStorage(
      storageKey,
      contentType,
      declaredLength,
      request,
    );

    try {
      const [video] = await this.db
        .insert(videos)
        .values({
          id: videoId,
          subjectFighterId: metadata.fighterId,
          uploadedById: actor.id,
          sessionId: metadata.sessionId ?? null,
          title: metadata.title.trim(),
          description: metadata.description?.trim() || null,
          trainingType: metadata.trainingType,
          storageKey,
          storageBucket: this.bucket,
          storageProvider: 'supabase',
          originalFilename: metadata.originalFilename,
          fileSizeBytes: BigInt(declaredLength),
          mimeType: contentType,
          durationMs: metadata.durationMs,
          cameraAngle: metadata.cameraAngle,
          status: 'UPLOAD_COMPLETE',
        })
        .returning();
      return this.toDto(video);
    } catch (error) {
      await this.supabase.storage
        .from(this.bucket)
        .remove([storageKey])
        .catch(() => undefined);
      throw error;
    }
  }

  async list(actor: AuthenticatedUser, query: ListVideosQueryDto) {
    const conditions = [eq(videos.isActive, true), isNull(videos.deletedAt)];
    if (query.fighterId)
      conditions.push(eq(videos.subjectFighterId, query.fighterId));
    if (query.trainingType)
      conditions.push(eq(videos.trainingType, query.trainingType));
    if (query.search) {
      conditions.push(
        or(
          ilike(videos.title, `%${query.search}%`),
          ilike(videos.originalFilename, `%${query.search}%`),
          ilike(videos.description, `%${query.search}%`),
        )!,
      );
    }
    const rows = await this.db
      .select()
      .from(videos)
      .where(and(...conditions))
      .orderBy(desc(videos.createdAt))
      .limit(query.limit);
    const visible = [];
    for (const row of rows) {
      if (await this.access.canAccessFighter(actor, row.subjectFighterId))
        visible.push(row);
    }
    return {
      items: visible.map((row) => this.toDto(row)),
      pageInfo: { hasNextPage: false, endCursor: null },
      total: visible.length,
    };
  }

  async getById(actor: AuthenticatedUser, id: string) {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    return this.toDto(video);
  }

  async signedContentUrl(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<string> {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    const { data, error } = await this.supabase.storage
      .from(video.storageBucket)
      .createSignedUrl(video.storageKey, 300);
    if (error || !data?.signedUrl)
      throw new ServiceUnavailableException({
        code: 'VIDEO_STORAGE_UNAVAILABLE',
        message: 'The video stream is unavailable',
      });
    return data.signedUrl;
  }

  async signedWorkerUrl(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<{ video: typeof videos.$inferSelect; url: string }> {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    const { data, error } = await this.supabase.storage
      .from(video.storageBucket)
      .createSignedUrl(video.storageKey, 3600);
    if (error || !data?.signedUrl)
      throw new ServiceUnavailableException({
        code: 'VIDEO_STORAGE_UNAVAILABLE',
        message: 'The video cannot be prepared for analysis',
      });
    return { video, url: data.signedUrl };
  }

  async markStatus(
    id: string,
    status: 'PROCESSING' | 'PROCESSED' | 'FAILED',
  ): Promise<void> {
    await this.db
      .update(videos)
      .set({ status, updatedAt: new Date() })
      .where(eq(videos.id, id));
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<null> {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    await this.db
      .update(videos)
      .set({ isActive: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(videos.id, id));
    return null;
  }

  private async assertUploadContext(
    actor: AuthenticatedUser,
    metadata: UploadVideoQueryDto,
  ): Promise<void> {
    const [fighter] = await this.db
      .select({ id: fighters.id })
      .from(fighters)
      .where(
        and(
          eq(fighters.id, metadata.fighterId),
          eq(fighters.isActive, true),
          isNull(fighters.deletedAt),
        ),
      )
      .limit(1);
    if (!fighter)
      throw new NotFoundException({
        code: 'FIGHTER_NOT_FOUND',
        message: 'Fighter not found',
      });
    await this.access.assertFighterAccess(actor, metadata.fighterId);
    if (metadata.sessionId) {
      const [session] = await this.db
        .select({ id: trainingSessions.id })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.id, metadata.sessionId),
            eq(trainingSessions.fighterId, metadata.fighterId),
          ),
        )
        .limit(1);
      if (!session)
        throw new ConflictException({
          code: 'VIDEO_SESSION_MISMATCH',
          message: 'The selected session does not belong to this fighter',
        });
    }
  }

  private async streamToStorage(
    key: string,
    contentType: string,
    length: number,
    request: Request,
  ): Promise<void> {
    const baseUrl = this.config
      .getOrThrow<string>('SUPABASE_URL')
      .replace(/\/$/, '');
    const serviceKey = this.config.getOrThrow<string>('SUPABASE_SERVICE_KEY');
    const objectPath = key.split('/').map(encodeURIComponent).join('/');
    let response: globalThis.Response;
    try {
      response = await fetch(
        `${baseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}/${objectPath}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': contentType,
            'Content-Length': String(length),
            'x-upsert': 'false',
          },
          body: request as unknown as BodyInit,
          duplex: 'half',
        } as RequestInit & { duplex: 'half' },
      );
    } catch {
      throw new ServiceUnavailableException({
        code: 'VIDEO_STORAGE_UNAVAILABLE',
        message: 'The video storage service is unavailable',
      });
    }
    if (!response.ok) {
      throw new BadGatewayException({
        code: 'VIDEO_STORAGE_REJECTED',
        message: 'The video storage service rejected the upload',
      });
    }
  }

  private async requireVideo(id: string) {
    const [video] = await this.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.id, id),
          eq(videos.isActive, true),
          isNull(videos.deletedAt),
        ),
      )
      .limit(1);
    if (!video)
      throw new NotFoundException({
        code: 'VIDEO_NOT_FOUND',
        message: 'Video not found',
      });
    return video;
  }

  private toDto(video: typeof videos.$inferSelect) {
    return {
      id: video.id,
      fighterId: video.subjectFighterId,
      uploadedById: video.uploadedById,
      sessionId: video.sessionId,
      title: video.title,
      description: video.description,
      trainingType: video.trainingType,
      cameraAngle: video.cameraAngle,
      status: video.status,
      originalFilename: video.originalFilename,
      fileSizeBytes: Number(video.fileSizeBytes),
      mimeType: video.mimeType,
      durationMs: video.durationMs,
      sourceUrl: `/videos/${video.id}/content`,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
    };
  }
}
