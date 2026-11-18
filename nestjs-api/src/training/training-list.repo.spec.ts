import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema.js';
import type { DrizzleDB } from '../database/database.module.js';
import { TrainingRepository } from './training.repo.js';
import { listSessionsQuerySchema } from './training.model.js';

/**
 * T-063 / T-067: the SQL the list queries send. A fake node-postgres client
 * records every statement, so the tests count round trips and check the
 * filters without a database.
 */
function capturingDb(answer: (text: string) => unknown[][] = () => []) {
  const statements: { text: string; params: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (config: { text: string } | string, params: unknown[] = []) => {
      const text = typeof config === 'string' ? config : config.text;
      statements.push({ text, params });
      return { rows: answer(text), fields: [], rowCount: 0 };
    }),
  };
  const db = drizzle({ client: client as never, schema }) as unknown as DrizzleDB;
  return { db, statements };
}

const coachId = 'c1c1c1c1-0000-4000-8000-000000000001';
const fighterA = 'f0000000-0000-4000-8000-00000000000a';
const fighterB = 'f0000000-0000-4000-8000-00000000000b';
const doctorUserId = 'd0c00000-0000-4000-8000-000000000001';

const isCount = (text: string) => text.includes('count(*)');

describe('TrainingRepository list queries (T-063, T-067)', () => {
  it('filters sessions by several Fighters and statuses with = ANY-style IN lists', async () => {
    const { db, statements } = capturingDb((text) => (isCount(text) ? [[3, null]] : []));
    const repo = new TrainingRepository(db);
    const query = listSessionsQuerySchema.parse({
      fighterIds: `${fighterA},${fighterB}`,
      status: ['SCHEDULED', 'IN_PROGRESS'],
    });

    const result = await repo.findSessions(query);

    expect(result).toEqual({ data: [], total: 3 });
    expect(statements).toHaveLength(2);
    for (const { text, params } of statements) {
      expect(text).toMatch(/"training_sessions"\."fighter_id" in \(\$\d+, \$\d+\)/);
      expect(text).toMatch(/"training_sessions"\."status" in \(\$\d+, \$\d+\)/);
      expect(params).toEqual(
        expect.arrayContaining([fighterA, fighterB, 'SCHEDULED', 'IN_PROGRESS']),
      );
    }
  });

  it('keeps the single fighterId/status filters as equality', async () => {
    const { db, statements } = capturingDb((text) => (isCount(text) ? [[0, null]] : []));
    const repo = new TrainingRepository(db);

    await repo.findSessions(
      listSessionsQuerySchema.parse({ fighterId: fighterA, status: 'SCHEDULED' }),
    );

    expect(statements[0].text).toMatch(/"training_sessions"\."fighter_id" = \$\d+/);
    expect(statements[0].text).toMatch(/"training_sessions"\."status" in \(\$\d+\)/);
  });

  it.each([
    [[5, 2], true],
    [[5, 1], false],
    [[0, 0], false],
  ] as const)(
    'COACH with fighterIds: 2 statements, the count also reports assignment (%j -> %s)',
    async (countRow, assigned) => {
      const { db, statements } = capturingDb((text) => (isCount(text) ? [[...countRow]] : []));
      const repo = new TrainingRepository(db);

      const result = await repo.findSessions(
        listSessionsQuerySchema.parse({ fighterIds: [fighterA, fighterB] }),
        { activeCoachId: coachId, requiredFighterIds: [fighterA, fighterB] },
      );

      expect(statements).toHaveLength(2);
      const count = statements.find((s) => isCount(s.text))!;
      expect(count.text).toContain('count(distinct "coach_fighters"."fighter_id")');
      expect(count.text).toMatch(/exists \(select/);
      expect(result.total).toBe(countRow[0]);
      expect(result.requiredFightersAssigned).toBe(assigned);
    },
  );

  it('plans: COACH with fighterId folds the assignment into the count statement', async () => {
    const { db, statements } = capturingDb((text) => (isCount(text) ? [[1, 1]] : []));
    const repo = new TrainingRepository(db);

    const result = await repo.findPlans(
      { page: 1, limit: 20, fighterId: fighterA, status: ['ACTIVE', 'DRAFT'] },
      { activeCoachId: coachId, requiredFighterIds: [fighterA] },
    );

    expect(statements).toHaveLength(2);
    expect(result).toEqual({ data: [], total: 1, requiredFightersAssigned: true });
    expect(statements[0].text).toMatch(/"training_plans"\."status" in \(\$\d+, \$\d+\)/);
  });

  it('checks every requested Fighter of a DOCTOR in one statement', async () => {
    const { db, statements } = capturingDb(() => [[fighterA]]);
    const repo = new TrainingRepository(db);

    const assigned = await repo.findDoctorAssignedFighterIds(doctorUserId, [
      fighterA,
      fighterB,
    ]);

    expect([...assigned]).toEqual([fighterA]);
    expect(statements).toHaveLength(1);
    expect(statements[0].text).toMatch(/"doctor_fighters"\."fighter_id" in \(\$\d+, \$\d+\)/);
    expect(statements[0].params).toEqual(expect.arrayContaining([doctorUserId, fighterA, fighterB]));
  });
});
