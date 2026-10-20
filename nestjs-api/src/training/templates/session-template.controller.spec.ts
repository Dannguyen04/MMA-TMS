import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../../shared/decorators/auth.decorator.js';
import {
  listSessionTemplatesQuerySchema,
  SessionType,
  TRAINING_PERMISSIONS,
} from '../training.model.js';
import { SessionTemplateController } from './session-template.controller.js';
import { SessionTemplateService } from './session-template.service.js';

describe('SessionTemplateController', () => {
  const reflector = new Reflector();
  let service: Mocked<SessionTemplateService>;
  let controller: SessionTemplateController;

  beforeEach(() => {
    service = { listTemplates: vi.fn() } as unknown as Mocked<SessionTemplateService>;
    controller = new SessionTemplateController(service);
  });

  it('GET /training-session-templates requires training.session_template:read', () => {
    expect(TRAINING_PERMISSIONS.SESSION_TEMPLATE_READ).toBe('training.session_template:read');
    expect(reflector.get(REQUIRED_PERMISSIONS, controller.listTemplates)).toEqual({
      allOf: [TRAINING_PERMISSIONS.SESSION_TEMPLATE_READ],
    });
  });

  it('delegates the validated query to the service', async () => {
    service.listTemplates.mockResolvedValue([]);
    await controller.listTemplates({ locale: 'en' });
    expect(service.listTemplates).toHaveBeenCalledWith({ locale: 'en' });
  });

  describe('query', () => {
    it('defaults to Vietnamese', () => {
      expect(listSessionTemplatesQuerySchema.parse({})).toEqual({ locale: 'vi' });
    });

    it('accepts vi and en only, and rejects unknown keys', () => {
      expect(listSessionTemplatesQuerySchema.safeParse({ locale: 'en' }).success).toBe(true);
      expect(listSessionTemplatesQuerySchema.safeParse({ locale: 'fr' }).success).toBe(false);
      expect(listSessionTemplatesQuerySchema.safeParse({ locale: 'vi', x: 1 }).success).toBe(false);
    });
  });

  it('the session type enum accepts the tactical analysis type', () => {
    expect(SessionType.safeParse('TACTICAL_ANALYSIS').success).toBe(true);
    expect(SessionType.safeParse('TECHNICAL_DRILLING').success).toBe(false);
  });
});
