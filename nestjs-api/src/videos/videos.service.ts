import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import {
  type ByteRange,
  ObjectStorageService,
} from './object-storage.service.js';
import {
  videoMediaTypeUnsupported,
  videoNotFound,
  videoScopeDenied,
  videoSizeInvalid,
} from './videos.error.js';
import {
  type ListVideosQuery,
  type PublicVideo,
  type UploadVideoInput,
  videoTrainingTypes,
} from './videos.model.js';
import {
  type NewVideoRecord,
  type VideoRecord,
  VideosRepository,
} from './videos.repo.js';

const allowedMimeTypes = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

@Injectable()
export class VideosService {
  constructor(
    private readonly repository: VideosRepository,
    private readonly storage: ObjectStorageService,
  ) {}

  async upload(
    actor: AuthenticatedUser,
    input: UploadVideoInput,
    source: Readable,
    requestId: string,
  ): Promise<PublicVideo> {
    if (!allowedMimeTypes.has(input.mimeType)) {
      throw videoMediaTypeUnsupported();
    }
    if (
      !Number.isSafeInteger(input.fileSizeBytes) ||
      input.fileSizeBytes <= 0 ||
      input.fileSizeBytes > this.storage.maxUploadBytes
    ) {
      throw videoSizeInvalid();
    }
    if (!(await this.repository.canUploadForFighter(actor, input.fighterId))) {
      throw videoScopeDenied();
    }

    const filename = this.safeFilename(input.originalFilename);
    const storageKey = `${actor.id}/${randomUUID()}-${filename}`;
    await this.storage.put(
      storageKey,
      source,
      input.fileSizeBytes,
      input.mimeType,
    );
    try {
      const created = await this.repository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        const record: NewVideoRecord = {
          subjectFighterId: input.fighterId,
          uploadedById: actor.id,
          sessionId: input.sessionId ?? null,
          title: input.title,
          description: input.description ?? null,
          trainingType: input.trainingType,
          storageKey,
          storageBucket: this.storage.bucket,
          storageProvider: this.storage.provider,
          originalFilename: filename,
          fileSizeBytes: BigInt(input.fileSizeBytes),
          mimeType: input.mimeType,
          durationMs: input.durationMs,
          cameraAngle: input.cameraAngle,
          status: 'UPLOAD_COMPLETE',
        };
        return this.repository.create(record, transaction);
      });
      return this.toPublic(created);
    } catch (error) {
      await this.storage.delete(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async findOne(actor: AuthenticatedUser, id: string): Promise<PublicVideo> {
    const video = await this.findRecord(actor, id);
    return this.toPublic(video);
  }

  async list(actor: AuthenticatedUser, query: ListVideosQuery) {
    const page = await this.repository.listForActor(actor, query);
    return { ...page, items: page.items.map((video) => this.toPublic(video)) };
  }

  async openContent(actor: AuthenticatedUser, id: string, range?: ByteRange) {
    const video = await this.findRecord(actor, id);
    return this.storage.open(video.storageKey, video.mimeType, range);
  }

  async openWorkerContent(id: string, range?: ByteRange) {
    const video = await this.repository.findActiveById(id);
    if (!video) throw videoNotFound();
    return this.storage.open(video.storageKey, video.mimeType, range);
  }

  async delete(
    actor: AuthenticatedUser,
    id: string,
    requestId: string,
  ): Promise<void> {
    const video = await this.findRecord(actor, id);
    if (actor.role !== 'ADMIN' && video.uploadedById !== actor.id) {
      throw videoScopeDenied();
    }
    await this.repository.transaction(async (transaction) => {
      await setAuditContext(actor.authSubject, requestId, transaction);
      const deleted = await this.repository.softDelete(id, transaction);
      if (!deleted) throw videoNotFound();
    });
    await this.storage.delete(video.storageKey);
  }

  private async findRecord(
    actor: AuthenticatedUser,
    id: string,
  ): Promise<VideoRecord> {
    const video = await this.repository.findForActor(actor, id);
    if (!video) throw videoNotFound();
    return video;
  }

  private safeFilename(filename: string): string {
    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
    if (!safe || safe.startsWith('.')) return 'video.bin';
    return safe;
  }

  private toPublic(video: VideoRecord): PublicVideo {
    const trainingType = videoTrainingTypes.find(
      (candidate) => candidate === video.trainingType,
    );
    if (!trainingType) {
      throw new Error('Loại hình tập luyện của video không được hỗ trợ.');
    }
    return {
      id: video.id,
      fighterId: video.subjectFighterId,
      uploadedById: video.uploadedById,
      sessionId: video.sessionId,
      title: video.title,
      description: video.description,
      trainingType,
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
