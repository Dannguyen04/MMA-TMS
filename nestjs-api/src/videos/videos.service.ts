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
import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  notInArray,
  or,
} from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { fighters, trainingSessions, videos } from '../database/schema.js';
import { SUPABASE_ADMIN_CLIENT } from '../common/supabase/supabase.module.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { VideoAccessService } from './video-access.service.js';
import type {
  CreateVideoUploadDto,
  ListVideosQueryDto,
  UploadVideoQueryDto,
} from './videos.dto.js';

const ALLOWED_VIDEO_TYPES = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
]);

/** Rows a direct upload has not finished (or that failed its check) stay out of the library and the worker. */
const NOT_READY_STATUSES = ['PENDING_UPLOAD', 'REJECTED'] as const;

/** Supabase signed upload URLs are valid for two hours; the API cannot change that. */
const SIGNED_UPLOAD_TTL_SECONDS = 2 * 60 * 60;

/**
 * A direct upload still PENDING after this long was abandoned: its signed URL
 * expired after two hours, so nothing can complete it any more.
 */
export const STALE_UPLOAD_AFTER_MS = 6 * 60 * 60 * 1000;

/** Rows cleaned per pass; the next pass picks up the rest. */
const STALE_UPLOAD_BATCH = 100;

type VideoRow = typeof videos.$inferSelect;

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
    const extension = this.requireExtension(contentType);

    const declaredLength = Number(request.headers['content-length']);
    if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0) {
      throw new BadRequestException({
        code: 'VIDEO_SIZE_REQUIRED',
        message: 'A valid Content-Length header is required',
      });
    }
    this.assertWithinSizeLimit(declaredLength);

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

  /**
   * Step 1 of a direct upload: check the same metadata as `upload`, record the
   * video as PENDING_UPLOAD and hand back a Supabase signed upload URL, so the
   * browser sends the file straight to storage (no Vercel body limit).
   */
  async createUpload(actor: AuthenticatedUser, metadata: CreateVideoUploadDto) {
    await this.assertUploadContext(actor, metadata);
    const contentType = metadata.contentType.toLowerCase();
    const extension = this.requireExtension(contentType);
    this.assertWithinSizeLimit(metadata.fileSizeBytes);

    const videoId = randomUUID();
    const storageKey = `${metadata.fighterId}/${videoId}/source${extension}`;
    // Sign first: a failed signature leaves no row behind.
    const { data, error } = await this.supabase.storage
      .from(this.bucket)
      .createSignedUploadUrl(storageKey);
    if (error || !data?.signedUrl || !data.token)
      throw new ServiceUnavailableException({
        code: 'VIDEO_STORAGE_UNAVAILABLE',
        message: 'The video storage service is unavailable',
      });

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
        fileSizeBytes: BigInt(metadata.fileSizeBytes),
        mimeType: contentType,
        durationMs: metadata.durationMs,
        cameraAngle: metadata.cameraAngle,
        status: 'PENDING_UPLOAD',
      })
      .returning();
    return {
      video: this.toDto(video),
      upload: {
        method: 'PUT' as const,
        url: data.signedUrl,
        token: data.token,
        bucket: this.bucket,
        path: storageKey,
        contentType,
        expiresInSeconds: SIGNED_UPLOAD_TTL_SECONDS,
      },
    };
  }

  /**
   * Step 2 of a direct upload: confirm the object reached storage with an
   * allowed size and type, then mark the video UPLOAD_COMPLETE. Calling it
   * again on a finished video returns the video unchanged.
   */
  async completeUpload(actor: AuthenticatedUser, id: string) {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    if (video.status === 'REJECTED')
      throw new ConflictException({
        code: 'VIDEO_UPLOAD_REJECTED',
        message: video.rejectionReason ?? 'The uploaded video was rejected',
      });
    if (video.status !== 'PENDING_UPLOAD') return this.toDto(video);

    const stored = await this.storedObject(
      video.storageBucket,
      video.storageKey,
    );
    if (!stored)
      throw new ConflictException({
        code: 'VIDEO_UPLOAD_MISSING',
        message: 'The video file has not reached storage yet',
      });
    if (stored.size <= 0 || stored.size > this.maxBytes) {
      await this.rejectUpload(
        video,
        'The video exceeds the configured upload limit',
      );
      throw new PayloadTooLargeException({
        code: 'VIDEO_TOO_LARGE',
        message: 'The video exceeds the configured upload limit',
      });
    }
    if (stored.contentType && stored.contentType !== video.mimeType) {
      await this.rejectUpload(
        video,
        'The stored file type does not match the declared video type',
      );
      throw new BadRequestException({
        code: 'VIDEO_FORMAT_UNSUPPORTED',
        message: 'Only MP4, MOV, and WebM video files are supported',
      });
    }

    const [updated] = await this.db
      .update(videos)
      .set({
        status: 'UPLOAD_COMPLETE',
        fileSizeBytes: BigInt(stored.size),
        updatedAt: new Date(),
      })
      .where(and(eq(videos.id, id), eq(videos.status, 'PENDING_UPLOAD')))
      .returning();
    // A concurrent confirm won the race; report the row as it is now.
    return this.toDto(updated ?? (await this.requireVideo(id)));
  }

  async list(actor: AuthenticatedUser, query: ListVideosQueryDto) {
    const conditions = [
      eq(videos.isActive, true),
      isNull(videos.deletedAt),
      notInArray(videos.status, [...NOT_READY_STATUSES]),
    ];
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
    const accessibleIds = await this.access.accessibleFighterIds(
      actor,
      rows.map((row) => row.subjectFighterId),
    );
    const visible = rows.filter((row) =>
      accessibleIds.has(row.subjectFighterId),
    );
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
    this.assertReady(video);
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
  ): Promise<{ video: VideoRow; url: string }> {
    const video = await this.requireVideo(id);
    await this.access.assertFighterAccess(actor, video.subjectFighterId);
    this.assertReady(video);
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

  /**
   * Deletes abandoned direct uploads: any partial object in storage, and the
   * row (soft delete, as `remove`, marked REJECTED). Only rows still
   * PENDING_UPLOAD are touched, so a run racing a confirm cannot undo it.
   * Returns how many rows were cleaned.
   */
  async cleanupStaleUploads(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STALE_UPLOAD_AFTER_MS);
    const stale = await this.db
      .select({
        id: videos.id,
        storageBucket: videos.storageBucket,
        storageKey: videos.storageKey,
      })
      .from(videos)
      .where(
        and(
          eq(videos.status, 'PENDING_UPLOAD'),
          eq(videos.isActive, true),
          isNull(videos.deletedAt),
          lt(videos.createdAt, cutoff),
        ),
      )
      .limit(STALE_UPLOAD_BATCH);
    if (stale.length === 0) return 0;

    const keysByBucket = new Map<string, string[]>();
    for (const row of stale) {
      keysByBucket.set(row.storageBucket, [
        ...(keysByBucket.get(row.storageBucket) ?? []),
        row.storageKey,
      ]);
    }
    for (const [bucket, keys] of keysByBucket) {
      // Removing a key that was never uploaded is not an error; an outage only
      // leaves an orphan object, which must not keep the row alive.
      await this.supabase.storage
        .from(bucket)
        .remove(keys)
        .catch(() => undefined);
    }

    const cleaned = await this.db
      .update(videos)
      .set({
        status: 'REJECTED',
        rejectionReason: 'The upload was not completed',
        isActive: false,
        deletedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          inArray(
            videos.id,
            stale.map((row) => row.id),
          ),
          eq(videos.status, 'PENDING_UPLOAD'),
        ),
      )
      .returning({ id: videos.id });
    return cleaned.length;
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

  private requireExtension(contentType: string): string {
    const extension = ALLOWED_VIDEO_TYPES.get(contentType);
    if (!extension) {
      throw new BadRequestException({
        code: 'VIDEO_FORMAT_UNSUPPORTED',
        message: 'Only MP4, MOV, and WebM video files are supported',
      });
    }
    return extension;
  }

  private assertWithinSizeLimit(bytes: number): void {
    if (bytes > this.maxBytes) {
      throw new PayloadTooLargeException({
        code: 'VIDEO_TOO_LARGE',
        message: 'The video exceeds the configured upload limit',
      });
    }
  }

  private assertReady(video: VideoRow): void {
    if ((NOT_READY_STATUSES as readonly string[]).includes(video.status))
      throw new ConflictException({
        code: 'VIDEO_NOT_READY',
        message: 'The video upload has not been completed',
      });
  }

  /** Size and type of the stored object, or null when nothing is stored at that key. */
  private async storedObject(
    bucket: string,
    key: string,
  ): Promise<{ size: number; contentType: string | null } | null> {
    const slash = key.lastIndexOf('/');
    const folder = key.slice(0, slash);
    const name = key.slice(slash + 1);
    const { data, error } = await this.supabase.storage
      .from(bucket)
      .list(folder, { search: name, limit: 10 });
    if (error)
      throw new ServiceUnavailableException({
        code: 'VIDEO_STORAGE_UNAVAILABLE',
        message: 'The video storage service is unavailable',
      });
    const object = data?.find((item) => item.name === name);
    if (!object) return null;
    const metadata = (object.metadata ?? {}) as Record<string, unknown>;
    const size = Number(metadata.size ?? metadata.contentLength);
    const mimetype =
      typeof metadata.mimetype === 'string'
        ? metadata.mimetype.split(';', 1)[0].trim().toLowerCase()
        : null;
    return { size: Number.isFinite(size) ? size : 0, contentType: mimetype };
  }

  private async rejectUpload(video: VideoRow, reason: string): Promise<void> {
    await this.supabase.storage
      .from(video.storageBucket)
      .remove([video.storageKey])
      .catch(() => undefined);
    await this.db
      .update(videos)
      .set({
        status: 'REJECTED',
        rejectionReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(videos.id, video.id), eq(videos.status, 'PENDING_UPLOAD')));
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
      const upstreamMessage = await response.text().catch(() => '');
      const normalizedMessage = upstreamMessage.toLowerCase();
      const rejectedForSize =
        response.status === 413 ||
        normalizedMessage.includes('maximum allowed size') ||
        normalizedMessage.includes('file size limit') ||
        normalizedMessage.includes('payload too large') ||
        normalizedMessage.includes('entity too large');
      if (rejectedForSize) {
        throw new PayloadTooLargeException({
          code: 'VIDEO_STORAGE_FILE_TOO_LARGE',
          message:
            'The video exceeds the Supabase project storage limit. Increase the global Storage file-size limit or upload a smaller video.',
        });
      }
      throw new BadGatewayException({
        code: 'VIDEO_STORAGE_REJECTED',
        message: `The video storage service rejected the upload (status ${response.status})`,
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

  private toDto(video: VideoRow) {
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
