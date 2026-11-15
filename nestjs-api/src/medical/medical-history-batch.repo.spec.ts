import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema.js';
import type { DrizzleDB } from '../database/database.module.js';
import { MedicalRepository } from './medical.repo.js';

/**
 * GET /medical/history: the statement behind the batch history read, captured
 * from a fake node-postgres client, and compared with the single read's.
 */
function capturingDb(answer: (text: string) => unknown[] = () => []) {
  const statements: { text: string; params: unknown[] }[] = [];
  const client = {
    query: vi.fn(async (config: { text: string } | string, params: unknown[] = []) => {
      const text = typeof config === 'string' ? config : config.text;
      const values = typeof config === 'string' ? params : ((config as { values?: unknown[] }).values ?? params);
      statements.push({ text, params: values });
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
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();

/** Raw rows as PostgreSQL returns them for the history UNION. */
const rawRows = [
  {
    fighter_id: ids[0],
    record_type: 'INJURY',
    record_id: '11000000-0000-4000-8000-000000000001',
    revision: 2,
    source: 'APPLICATION',
    recorded_at: '2026-11-10T08:00:00.000Z',
    recorded_by_user_id: 'd0000000-0000-4000-8000-000000000001',
    snapshot: {
      id: '11000000-0000-4000-8000-000000000001',
      fighter_id: ids[0],
      severity: 'MINOR',
      deleted_at: null,
      internal_column: 'never exposed',
    },
  },
  {
    fighter_id: ids[0],
    record_type: 'TREATMENT',
    record_id: '12000000-0000-4000-8000-000000000001',
    revision: 1,
    source: null,
    recorded_at: new Date('2026-11-09T08:00:00.000Z'),
    recorded_by_user_id: null,
    snapshot: { id: '12000000-0000-4000-8000-000000000001', treatment_type: 'ice' },
  },
];

describe('MedicalRepository batch history read', () => {
  it('reads every Fighter in one statement with an IN list and the given row limit', async () => {
    const { db, statements } = capturingDb();
    await new MedicalRepository(db).listHistoryForFighters(ids, 'INJURY', 5001);

    expect(statements).toHaveLength(1);
    const text = normalize(statements[0].text);
    // Six branches of the UNION, each restricted to the batch.
    expect(text.match(/fighter_id IN \(/g)).toHaveLength(6);
    expect(text).toContain('ORDER BY h.recorded_at DESC, h.record_id, h.revision DESC');
    expect(text).toMatch(/LIMIT \$\d+$/);
    expect(statements[0].params).toEqual(expect.arrayContaining([...ids, 'INJURY', 5001]));
  });

  it('uses the same UNION, filter and ordering as the single read', async () => {
    const single = capturingDb();
    const batch = capturingDb();
    await new MedicalRepository(single.db).listHistory(ids[0], {
      page: 1,
      limit: 20,
      recordType: 'TREATMENT',
    });
    await new MedicalRepository(batch.db).listHistoryForFighters([ids[0]], 'TREATMENT', 5001);

    const shape = (text: string) =>
      normalize(text)
        .replace(/\$\d+(::uuid)?/g, '$')
        .replace(/fighter_id (=|IN \() ?\$\)?/g, 'fighter_id ~ $')
        .replace(/ LIMIT .*$/, '');
    expect(shape(batch.statements[0].text)).toBe(shape(single.statements[0].text));
  });

  it('maps rows to exactly the entries the single read returns', async () => {
    const single = capturingDb((text) => (/count\(\*\)/.test(text) ? [{ count: 2 }] : rawRows));
    const batch = capturingDb(() => rawRows);

    const { data } = await new MedicalRepository(single.db).listHistory(ids[0], {
      page: 1,
      limit: 20,
      recordType: undefined,
    });
    const rows = await new MedicalRepository(batch.db).listHistoryForFighters(
      [ids[0]],
      undefined,
      5001,
    );

    expect(rows.map((row) => row.fighterId)).toEqual([ids[0], ids[0]]);
    expect(rows.map((row) => row.entry)).toEqual(data);
    expect(data[0].snapshot).not.toHaveProperty('internal_column');
    expect(data[1].recordedAt).toEqual(new Date('2026-11-09T08:00:00.000Z'));
  });

  it('issues no statement for an empty batch', async () => {
    const { db, statements } = capturingDb();
    await expect(
      new MedicalRepository(db).listHistoryForFighters([], undefined, 5001),
    ).resolves.toEqual([]);
    expect(statements).toHaveLength(0);
  });
});
