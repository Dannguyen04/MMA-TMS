import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { AcademySettingsRepository } from './academy-settings.repo.js';
import { AcademySettingsService } from './academy-settings.service.js';

describe('AcademySettingsService', () => {
  let service: AcademySettingsService;
  let repo: Mocked<AcademySettingsRepository>;

  const dummyTx = { execute: vi.fn() } as unknown as Transaction;
  const adminActor: AuthenticatedUser = {
    id: 'admin-user-001',
    authSubject: 'admin-subject-001',
    email: 'admin@example.com',
    role: USER.ADMIN,
  };
  const requestId = 'req-settings-123';

  beforeEach(() => {
    repo = {
      getSettings: vi.fn(),
      getMedicalSupervision: vi.fn(),
      updateSettings: vi.fn(),
      transaction: vi.fn(async (work) => work(dummyTx)),
    } as unknown as Mocked<AcademySettingsRepository>;

    service = new AcademySettingsService(repo);
  });

  it('getSettings delegates to repository', async () => {
    const expected = {
      medicalSupervision: 'DOCTOR' as const,
      changeReason: 'Initial setup',
      updatedAt: '2026-10-13T10:00:00.000Z',
    };
    repo.getSettings.mockResolvedValueOnce(expected);

    const result = await service.getSettings();

    expect(result).toEqual(expected);
    expect(repo.getSettings).toHaveBeenCalled();
  });

  it('getMedicalSupervision delegates to repository', async () => {
    repo.getMedicalSupervision.mockResolvedValueOnce('NONE');

    const result = await service.getMedicalSupervision();

    expect(result).toBe('NONE');
    expect(repo.getMedicalSupervision).toHaveBeenCalled();
  });

  it('updateSettings runs inside transaction and calls updateSettings with updatedById', async () => {
    const input = {
      medicalSupervision: 'NONE' as const,
      changeReason: 'Switching to no doctor supervision mode',
    };
    const expected = {
      medicalSupervision: 'NONE' as const,
      changeReason: input.changeReason,
      updatedAt: '2026-10-13T11:00:00.000Z',
    };
    repo.updateSettings.mockResolvedValueOnce(expected);

    const result = await service.updateSettings(adminActor, input, requestId);

    expect(repo.transaction).toHaveBeenCalled();
    expect(repo.updateSettings).toHaveBeenCalledWith(
      {
        ...input,
        updatedById: adminActor.id,
      },
      dummyTx,
    );
    expect(result).toEqual(expected);
  });
});
