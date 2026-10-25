import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { setAuditContext } from '../shared/utils/audit-context.util.js';
import type {
  AcademySettingsResponse,
  MedicalSupervisionValue,
  UpdateAcademySettingsInput,
} from './academy-settings.model.js';
import { AcademySettingsRepository } from './academy-settings.repo.js';

@Injectable()
export class AcademySettingsService {
  constructor(private readonly repo: AcademySettingsRepository) {}

  async getSettings(): Promise<AcademySettingsResponse> {
    return this.repo.getSettings();
  }

  async getMedicalSupervision(): Promise<MedicalSupervisionValue> {
    return this.repo.getMedicalSupervision();
  }

  async updateSettings(
    actor: AuthenticatedUser,
    input: UpdateAcademySettingsInput,
    requestId: string,
  ): Promise<AcademySettingsResponse> {
    return this.repo.transaction(async (tx) => {
      await setAuditContext(actor.authSubject, requestId, tx);
      return this.repo.updateSettings(
        {
          ...input,
          updatedById: actor.id,
        },
        tx,
      );
    });
  }
}
