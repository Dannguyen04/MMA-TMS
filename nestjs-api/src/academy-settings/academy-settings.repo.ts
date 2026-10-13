import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import { academySettings } from '../database/schema.js';
import type {
  DatabaseExecutor,
  Transaction,
} from '../shared/utils/audit-context.util.js';
import {
  academySettingsResponseSchema,
  type AcademySettingsResponse,
  type MedicalSupervisionValue,
  type UpdateAcademySettingsInput,
} from './academy-settings.model.js';

@Injectable()
export class AcademySettingsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  transaction<T>(work: (transaction: Transaction) => Promise<T>): Promise<T> {
    return this.db.transaction(work);
  }

  async getSettings(
    database: DatabaseExecutor = this.db,
  ): Promise<AcademySettingsResponse> {
    const [row] = await database
      .select({
        medicalSupervision: academySettings.medicalSupervision,
        changeReason: academySettings.changeReason,
        updatedAt: academySettings.updatedAt,
      })
      .from(academySettings)
      .where(eq(academySettings.id, true))
      .limit(1);

    if (!row) {
      return {
        medicalSupervision: 'DOCTOR',
        changeReason: null,
        updatedAt: new Date().toISOString(),
      };
    }

    return academySettingsResponseSchema.parse(row);
  }

  async getMedicalSupervision(
    database: DatabaseExecutor = this.db,
  ): Promise<MedicalSupervisionValue> {
    const [row] = await database
      .select({ medicalSupervision: academySettings.medicalSupervision })
      .from(academySettings)
      .where(eq(academySettings.id, true))
      .limit(1);

    return row?.medicalSupervision ?? 'DOCTOR';
  }

  async updateSettings(
    input: UpdateAcademySettingsInput & { updatedById?: string },
    database: DatabaseExecutor = this.db,
  ): Promise<AcademySettingsResponse> {
    const [row] = await database
      .update(academySettings)
      .set({
        medicalSupervision: input.medicalSupervision,
        changeReason: input.changeReason,
        ...(input.updatedById ? { updatedById: input.updatedById } : {}),
        updatedAt: new Date(),
      })
      .where(eq(academySettings.id, true))
      .returning({
        medicalSupervision: academySettings.medicalSupervision,
        changeReason: academySettings.changeReason,
        updatedAt: academySettings.updatedAt,
      });

    if (!row) {
      const [inserted] = await database
        .insert(academySettings)
        .values({
          id: true,
          medicalSupervision: input.medicalSupervision,
          changeReason: input.changeReason,
          ...(input.updatedById ? { updatedById: input.updatedById } : {}),
          updatedAt: new Date(),
        })
        .returning({
          medicalSupervision: academySettings.medicalSupervision,
          changeReason: academySettings.changeReason,
          updatedAt: academySettings.updatedAt,
        });

      return academySettingsResponseSchema.parse(inserted);
    }

    return academySettingsResponseSchema.parse(row);
  }
}
