import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { VideosService } from './videos.service.js';

/** Hourly is plenty: an upload only counts as abandoned after six hours. */
export const VIDEO_UPLOAD_SWEEP_MS = 60 * 60 * 1000;

/**
 * Cleans direct uploads the browser started but never confirmed (cancelled,
 * tab closed, network lost): their partial object in storage and their
 * PENDING_UPLOAD row. Runs once at start-up, then hourly. Idempotent, so
 * several instances running it is harmless. Off under tests and with
 * VIDEO_UPLOAD_SWEEP=off.
 */
@Injectable()
export class VideoUploadSweeper
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(VideoUploadSweeper.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly videos: VideosService) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.VIDEO_UPLOAD_SWEEP === 'off') return;
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), VIDEO_UPLOAD_SWEEP_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass; overlapping calls are skipped. Never throws. */
  async sweep(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const cleaned = await this.videos.cleanupStaleUploads();
      if (cleaned > 0) {
        this.logger.log(`Cleaned ${cleaned} abandoned video upload(s)`);
      }
      return cleaned;
    } catch (error) {
      this.logger.warn(`Video upload sweep failed: ${String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
