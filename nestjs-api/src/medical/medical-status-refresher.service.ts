import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { MedicalService } from './medical.service.js';

/** Hourly: clearances start and expire without any write. */
export const MEDICAL_STATUS_REFRESH_MS = 60 * 60 * 1000;

/**
 * Keeps `fighters.current_medical_status` in step with time-driven changes.
 * Clinical writes already re-derive it in their own transaction; this pass
 * covers what changes with the clock alone (a clearance coming into force or
 * expiring). It also runs once at start-up, which backfills rows written before
 * the status was derived. Idempotent: only rows whose status differs are
 * updated, so several instances running it is harmless. Off under tests and
 * with MEDICAL_STATUS_REFRESH=off.
 */
@Injectable()
export class MedicalStatusRefresher
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(MedicalStatusRefresher.name);
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(private readonly medical: MedicalService) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') return;
    if (process.env.MEDICAL_STATUS_REFRESH === 'off') return;
    void this.refresh();
    this.timer = setInterval(() => void this.refresh(), MEDICAL_STATUS_REFRESH_MS);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** One pass; overlapping calls are skipped. Never throws. */
  async refresh(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    try {
      const changed = await this.medical.syncAllMedicalStatuses();
      if (changed > 0) {
        this.logger.log(`Medical status refreshed for ${changed} fighter(s)`);
      }
      return changed;
    } catch (error) {
      this.logger.warn(`Medical status refresh failed: ${String(error)}`);
      return 0;
    } finally {
      this.running = false;
    }
  }
}
