import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mocked } from 'vitest';
import {
  sessionTemplateBaseSchema,
  type SessionTemplateEntity,
} from '../training.model.js';
import { SessionTemplateRepository } from './session-template.repo.js';
import {
  resolveSessionTemplate,
  SessionTemplateService,
} from './session-template.service.js';

const step = (name: string, detail: string) => ({ name, detail });

const template: SessionTemplateEntity = {
  id: '2f5e2b1e-6a64-4a3e-9d6e-2a3a0a7c9f11',
  code: 'distance',
  category: 'TECHNIQUE',
  sessionType: 'PAD_WORK',
  plannedDurationMin: 45,
  targetRpe: 5,
  translations: {
    vi: {
      name: 'Jab – cross – thoát góc',
      purpose: 'Mục đích',
      rationale: 'Lý do',
      steps: [step('Chuẩn bị', 'Kiểm tra tư thế')],
    },
    en: {
      name: 'Jab – cross – angle exit',
      purpose: 'Purpose',
      rationale: 'Rationale',
      steps: [step('Preparation', 'Check posture')],
    },
  },
  displayOrder: 10,
  isActive: true,
  createdAt: '2026-10-20T00:00:00.000Z',
  updatedAt: '2026-10-20T00:00:00.000Z',
};

describe('SessionTemplateService', () => {
  let repo: Mocked<SessionTemplateRepository>;
  let service: SessionTemplateService;

  beforeEach(() => {
    repo = { findActive: vi.fn() } as unknown as Mocked<SessionTemplateRepository>;
    service = new SessionTemplateService(repo);
  });

  it('returns the text in the requested language', async () => {
    repo.findActive.mockResolvedValue([template]);

    const [viText] = await service.listTemplates({ locale: 'vi' });
    const [en] = await service.listTemplates({ locale: 'en' });

    expect(viText).toMatchObject({
      code: 'distance',
      category: 'TECHNIQUE',
      sessionType: 'PAD_WORK',
      plannedDurationMin: 45,
      targetRpe: 5,
      name: 'Jab – cross – thoát góc',
      steps: [step('Chuẩn bị', 'Kiểm tra tư thế')],
    });
    expect(en).toMatchObject({
      name: 'Jab – cross – angle exit',
      purpose: 'Purpose',
      rationale: 'Rationale',
      steps: [step('Preparation', 'Check posture')],
    });
  });

  it('keeps the repository order and returns an empty list when nothing is active', async () => {
    repo.findActive.mockResolvedValue([
      { ...template, code: 'a' },
      { ...template, code: 'b' },
    ]);
    expect((await service.listTemplates({ locale: 'vi' })).map((t) => t.code)).toEqual(['a', 'b']);

    repo.findActive.mockResolvedValue([]);
    expect(await service.listTemplates({ locale: 'vi' })).toEqual([]);
  });

  it('does not expose stored-only columns', () => {
    const resolved = resolveSessionTemplate(template, 'vi');
    expect(Object.keys(resolved).sort()).toEqual(
      [
        'category', 'code', 'id', 'name', 'plannedDurationMin', 'purpose',
        'rationale', 'sessionType', 'steps', 'targetRpe',
      ],
    );
  });

  it('rejects a stored row that lacks a language', () => {
    const { en: _en, ...onlyVi } = template.translations;
    expect(
      sessionTemplateBaseSchema.safeParse({ ...template, translations: onlyVi }).success,
    ).toBe(false);
  });
});
