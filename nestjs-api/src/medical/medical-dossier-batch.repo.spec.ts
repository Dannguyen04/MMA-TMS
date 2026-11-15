import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema.js';
import type { DrizzleDB } from '../database/database.module.js';
import { USER } from '../shared/types/user.role.js';
import { MEDICAL_READ_AUDIT, MEDICAL_READ_VIEW } from './medical.constants.js';
import { MedicalRepository } from './medical.repo.js';

/**
 * T-064: the statements behind GET /medical/dossiers, captured from a fake
 * node-postgres client (one statement per batch method, whatever the size).
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

const ids = Array.from(
  { length: 20 },
  (_, i) => `f0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
);
const actorId = 'a0000000-0000-4000-8000-000000000001';

describe('MedicalRepository batch dossier reads (T-064)', () => {
  it('writes one audit row per Fighter in a single INSERT', async () => {
    const { db, statements } = capturingDb();
    await new MedicalRepository(db).insertMedicalReadAudits(
      actorId,
      ids,
      MEDICAL_READ_VIEW.DOSSIER,
      'req-1',
    );

    expect(statements).toHaveLength(1);
    expect(statements[0].text).toMatch(/^insert into "audit_logs"/);
    expect(statements[0].text.match(/\(default, /g)).toHaveLength(ids.length);
    expect(statements[0].params).toEqual(
      expect.arrayContaining([
        actorId,
        MEDICAL_READ_AUDIT.ACTION,
        MEDICAL_READ_AUDIT.RESOURCE_TYPE,
        'req-1',
        ...ids,
      ]),
    );
  });

  it.each([USER.COACH, USER.DOCTOR])(
    'scope check for %s is one statement and binds the assignment to the outer Fighter row',
    async (role) => {
      const { db, statements } = capturingDb(() => ids.map((id) => [id, true]));
      const rows = await new MedicalRepository(db).findFightersInMedicalReadScope(
        { id: actorId, role },
        ids,
        101,
      );

      expect(rows).toHaveLength(ids.length);
      expect(statements).toHaveLength(1);
      expect(statements[0].text).toMatch(/f\.fighter_id = fighters\.id\s/);
      expect(statements[0].text).toMatch(/"fighters"\."id" in \(/);
    },
  );

  it('without ids, lists the scope with the given limit', async () => {
    const { db, statements } = capturingDb(() => [[ids[0]]]);
    const rows = await new MedicalRepository(db).findFightersInMedicalReadScope(
      { id: actorId, role: USER.FIGHTER },
      undefined,
      101,
    );

    expect(rows).toEqual([{ id: ids[0], inScope: true }]);
    expect(statements[0].text).toContain('fighters.user_id = $');
    expect(statements[0].params).toContain(101);
  });

  it('reads the current examinations with DISTINCT ON (fighter_id, scope)', async () => {
    const { db, statements } = capturingDb();
    await new MedicalRepository(db).findCurrentExaminationsForFighters(ids);

    expect(statements).toHaveLength(1);
    expect(statements[0].text).toMatch(
      /^select distinct on \("medical_examinations"\."fighter_id", "medical_examinations"\."scope"\)/,
    );
    expect(statements[0].text).toMatch(/"sequence_no" desc$/);
  });

  it('runs exactly one statement per batch method for 20 Fighters', async () => {
    const { db, statements } = capturingDb();
    const repo = new MedicalRepository(db);
    await Promise.all([
      repo.listActiveInjuriesForFighters(ids),
      repo.listActiveRecoveryPlansForFighters(ids),
      repo.listActiveClearancesForFighters(ids),
      repo.listOpenReviewRequestsForFighters(ids),
      repo.findCurrentExaminationsForFighters(ids),
      repo.findFightersWithBaselineOnFile(ids),
      repo.listClearancesForExaminations(ids),
    ]);

    expect(statements).toHaveLength(7);
  });

  it('issues no statement for an empty batch', async () => {
    const { db, statements } = capturingDb();
    const repo = new MedicalRepository(db);
    await repo.insertMedicalReadAudits(actorId, [], MEDICAL_READ_VIEW.DOSSIER, 'r');
    await repo.listActiveInjuriesForFighters([]);
    await repo.findFightersWithBaselineOnFile([]);
    expect(statements).toHaveLength(0);
  });
});
