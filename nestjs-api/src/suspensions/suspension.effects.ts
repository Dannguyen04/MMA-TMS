import { Injectable } from '@nestjs/common';
import type { SuspensionRow } from '../database/schema.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import type {
  AffectedPlan,
  AffectedSession,
} from './suspensions.model.js';

export interface SuspensionEffectResult {
  affectedSessions: AffectedSession[];
  affectedPlans: AffectedPlan[];
  afterCommit: () => Promise<void>;
}

export type SuspensionCreatedHandler = (
  suspensions: SuspensionRow[],
  tx: Transaction,
) => Promise<SuspensionEffectResult>;

const noopAfterCommit = async (): Promise<void> => {};

@Injectable()
export class SuspensionEffects {
  private handler: SuspensionCreatedHandler | null = null;

  register(handler: SuspensionCreatedHandler): void {
    if (this.handler !== null) {
      throw new Error('SuspensionEffects handler has already been registered');
    }
    this.handler = handler;
  }

  async runOnCreated(
    suspensions: SuspensionRow[],
    tx: Transaction,
  ): Promise<SuspensionEffectResult> {
    if (!this.handler || suspensions.length === 0) {
      return {
        affectedSessions: [],
        affectedPlans: [],
        afterCommit: noopAfterCommit,
      };
    }
    return this.handler(suspensions, tx);
  }
}
