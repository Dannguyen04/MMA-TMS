import { HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { ACADEMY_SETTINGS_PERMISSIONS } from './academy-settings.constants.js';
import { AcademySettingsController } from './academy-settings.controller.js';
import {
  academySettingsResponseSchema,
  updateAcademySettingsSchema,
} from './academy-settings.model.js';
import { AcademySettingsService } from './academy-settings.service.js';

describe('AcademySettingsController (Criterion 9)', () => {
  let controller: AcademySettingsController;
  let service: Mocked<AcademySettingsService>;
  const reflector = new Reflector();

  const adminActor: AuthenticatedUser = {
    id: 'user-admin-1',
    authSubject: 'sub-admin-1',
    email: 'admin@example.com',
    role: USER.ADMIN,
  };

  beforeEach(() => {
    service = {
      getSettings: vi.fn(),
      getMedicalSupervision: vi.fn(),
      updateSettings: vi.fn(),
    } as unknown as Mocked<AcademySettingsService>;

    controller = new AcademySettingsController(service);
  });

  describe('Route Permissions', () => {
    it('GET /academy-settings requires academy_settings:read', () => {
      const permissions = reflector.get(
        REQUIRED_PERMISSIONS,
        controller.getSettings,
      );
      expect(permissions).toEqual({
        allOf: [ACADEMY_SETTINGS_PERMISSIONS.READ],
      });
    });

    it('PATCH /academy-settings requires academy_settings:manage', () => {
      const permissions = reflector.get(
        REQUIRED_PERMISSIONS,
        controller.updateSettings,
      );
      expect(permissions).toEqual({
        allOf: [ACADEMY_SETTINGS_PERMISSIONS.MANAGE],
      });
    });
  });

  describe('DTO Validation (Criterion 9: 422 on invalid/missing input)', () => {
    it('accepts valid update input with DOCTOR', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'DOCTOR',
        changeReason: 'Restoring standard medical supervision with licensed doctor',
      });
      expect(result.success).toBe(true);
    });

    it('accepts valid update input with NONE', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'NONE',
        changeReason: 'Switching to self-supervised training for trial period',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid medicalSupervision value', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'INVALID_MODE',
        changeReason: 'Valid reason here',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing changeReason', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'NONE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects changeReason shorter than 3 characters', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'NONE',
        changeReason: 'no',
      });
      expect(result.success).toBe(false);
    });

    it('rejects changeReason longer than 500 characters', () => {
      const result = updateAcademySettingsSchema.safeParse({
        medicalSupervision: 'NONE',
        changeReason: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    it('validates academySettingsResponseSchema format', () => {
      const valid = {
        medicalSupervision: 'DOCTOR',
        changeReason: 'Initial setup',
        updatedAt: new Date().toISOString(),
      };
      expect(academySettingsResponseSchema.safeParse(valid).success).toBe(true);
    });
  });

  describe('Handlers Execution', () => {
    it('getSettings returns current academy settings', async () => {
      const mockResult = {
        medicalSupervision: 'DOCTOR' as const,
        changeReason: 'Initial academy configuration',
        updatedAt: '2026-10-13T10:00:00.000Z',
      };
      service.getSettings.mockResolvedValueOnce(mockResult);

      const result = await controller.getSettings();

      expect(result).toEqual(mockResult);
      expect(service.getSettings).toHaveBeenCalled();
    });

    it('updateSettings updates academy settings with actor', async () => {
      const body = {
        medicalSupervision: 'NONE' as const,
        changeReason: 'Switching to no-doctor mode by admin',
      };
      const mockResult = {
        medicalSupervision: 'NONE' as const,
        changeReason: body.changeReason,
        updatedAt: '2026-10-13T11:00:00.000Z',
      };
      service.updateSettings.mockResolvedValueOnce(mockResult);

      const result = await controller.updateSettings(adminActor, body);

      expect(result).toEqual(mockResult);
      expect(service.updateSettings).toHaveBeenCalledWith(
        adminActor,
        body,
        expect.any(String),
      );
    });

    it('updateSettings throws 401 when actor is undefined', async () => {
      const body = {
        medicalSupervision: 'NONE' as const,
        changeReason: 'Switching to no-doctor mode',
      };

      await expect(
        controller.updateSettings(undefined, body),
      ).rejects.toMatchObject({
        status: HttpStatus.UNAUTHORIZED,
      });
    });
  });
});
