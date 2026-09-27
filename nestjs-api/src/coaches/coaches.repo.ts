import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { coaches } from '../database/schema.js';
import type { DatabaseExecutor } from '../shared/utils/audit-context.util.js';

@Injectable()
export class CoachesRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async isActiveCoach(
    coachId: string,
    database: DatabaseExecutor = this.db,
  ): Promise<boolean> {
    const [row] = await database
      .select({ id: coaches.id })
      .from(coaches)
      .where(
        and(
          eq(coaches.id, coachId),
          eq(coaches.isActive, true),
          isNull(coaches.deletedAt),
        ),
      )
      .limit(1);
    return row !== undefined;
  }
}
