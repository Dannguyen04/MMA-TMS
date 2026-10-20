import { describe, expect, it, vi } from 'vitest';
import type { DrizzleDB } from '../../database/database.module.js';
import { SessionTemplateRepository } from './session-template.repo.js';

const text = (name: string) => ({
  name,
  purpose: 'p',
  rationale: 'r',
  steps: [{ name: 's', detail: 'd' }],
});

/** Executor whose select chain resolves to `rows` at orderBy, like the real query. */
function executorReturning(rows: unknown[]) {
  const orderBy = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ orderBy });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });
  return { executor: { select } as unknown as DrizzleDB, orderBy, where };
}

describe('SessionTemplateRepository', () => {
  it('maps database rows (Date timestamps) to entities in query order', async () => {
    const { executor, orderBy, where } = executorReturning([
      {
        id: '2f5e2b1e-6a64-4a3e-9d6e-2a3a0a7c9f11',
        code: 'tactics',
        category: 'TACTICS',
        sessionType: 'TACTICAL_ANALYSIS',
        plannedDurationMin: 40,
        targetRpe: 2,
        translations: { vi: text('Đọc trận'), en: text('Reading') },
        displayOrder: 40,
        isActive: true,
        createdAt: new Date('2026-10-20T00:00:00.000Z'),
        updatedAt: new Date('2026-10-20T00:00:00.000Z'),
      },
    ]);
    const repo = new SessionTemplateRepository(executor);

    const result = await repo.findActive();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ code: 'tactics', sessionType: 'TACTICAL_ANALYSIS' });
    expect(result[0].createdAt).toBe('2026-10-20T00:00:00.000Z');
    expect(where).toHaveBeenCalledTimes(1);
    expect(orderBy).toHaveBeenCalledTimes(1);
  });

  it('fails loudly when a stored row is malformed', async () => {
    const { executor } = executorReturning([{ code: 'broken' }]);
    await expect(new SessionTemplateRepository(executor).findActive()).rejects.toThrow();
  });
});
