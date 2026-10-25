import { Injectable } from '@nestjs/common';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';
import {
  academyDateOf,
  isInForceOn,
  type BlockingSuspension,
  type SessionType,
} from './suspensions.model.js';
import { SuspensionsRepository } from './suspensions.repo.js';

export type { BlockingSuspension };

@Injectable()
export class SuspensionGate {
  constructor(private readonly repo: SuspensionsRepository) {}

  /**
   * Returns the fighter's suspensions that are in force on `academyDateOf(at)`
   * and whose `blocked_session_types` contains `sessionType`.
   */
  async blockingSuspensions(
    fighterId: string,
    sessionType: SessionType,
    at: Date,
    database?: DatabaseExecutor,
  ): Promise<BlockingSuspension[]> {
    const date = academyDateOf(at);
    const rows = await this.repo.findSuspensionsByFighterId(
      fighterId,
      database,
    );
    const blocking: BlockingSuspension[] = [];
    for (const row of rows) {
      if (row.deletedAt !== null) continue;
      if (!isInForceOn(row, date)) continue;
      if (!row.blockedSessionTypes.includes(sessionType)) continue;
      blocking.push({
        suspensionId: row.id,
        reason: row.reason,
        endsOn: row.endsOn,
        requiresClearance: row.requiresClearance,
      });
    }
    return blocking;
  }
}
