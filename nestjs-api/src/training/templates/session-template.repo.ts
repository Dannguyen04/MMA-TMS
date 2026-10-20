import { Inject, Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../../database/database.module.js';
import { sessionTemplates } from '../../database/schema.js';
import type { DatabaseExecutor } from '../../shared/utils/audit-context.util.js';
import {
  sessionTemplateBaseSchema,
  type SessionTemplateEntity,
} from '../training.model.js';

@Injectable()
export class SessionTemplateRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Active templates in display order. */
  async findActive(
    database: DatabaseExecutor = this.db,
  ): Promise<SessionTemplateEntity[]> {
    const rows = await database
      .select()
      .from(sessionTemplates)
      .where(eq(sessionTemplates.isActive, true))
      .orderBy(asc(sessionTemplates.displayOrder), asc(sessionTemplates.code));
    return rows.map((row) => sessionTemplateBaseSchema.parse(row));
  }
}
