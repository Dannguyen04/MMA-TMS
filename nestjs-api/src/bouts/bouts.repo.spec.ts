import { describe, expect, it, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import type { DrizzleDB } from '../database/database.module.js';
import { BoutsRepository } from './bouts.repo.js';

function harness() {
  const query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
  const db = drizzle({ client: { query } as unknown as Pool }) as DrizzleDB;
  return { repo: new BoutsRepository(db), query };
}
const boutId = '40000000-0000-4000-8000-000000000001';
const sessionId = '70000000-0000-4000-8000-000000000001';
const fighterId = '10000000-0000-4000-8000-000000000001';

describe('T-010 repository SQL boundaries', () => {
  it('filters analysis sessions by IDs, owner and non-deleted state (AC9)', async () => {
    const { repo, query } = harness();
    await repo.findAnalysisSessions([sessionId], fighterId);
    const [config, params] = query.mock.calls[0]!;
    expect(config.text).toContain('"training_sessions"."fighter_id" =');
    expect(config.text).toContain('"training_sessions"."deleted_at" is null');
    expect(params).toEqual([sessionId, fighterId]);
    expect(config.text).not.toContain('coach_notes');
  });

  it('uses a row lock on the non-deleted parent and orders round reads (AC12–14)', async () => {
    const { repo, query } = harness();
    const db = drizzle({ client: { query } as unknown as Pool }) as DrizzleDB;
    await repo.lockBoutById(boutId, db);
    expect(query.mock.calls[0]?.[0].text).toContain('for update');
    expect(query.mock.calls[0]?.[0].text).toContain(
      '"bouts"."deleted_at" is null',
    );
    await repo.listRounds(boutId);
    expect(query.mock.calls[1]?.[0].text).toContain(
      'order by "bout_rounds"."round_no" asc',
    );
  });

  it('upserts by bout/round and updates only explicitly supplied fields (AC12)', async () => {
    const { repo, query } = harness();
    await expect(
      repo.upsertRound({
        boutId,
        roundNo: 1,
        recordedById: fighterId,
        note: null,
        stunned: false,
      }),
    ).rejects.toThrow('Round upsert returned no row');
    const sql = query.mock.calls[0]?.[0].text as string;
    expect(sql).toContain('on conflict ("bout_id","round_no") do update set');
    const update = sql.split('do update set')[1]!.split('returning')[0]!;
    expect(update).toContain('"note" =');
    expect(update).toContain('"stunned" =');
    expect(update).not.toContain('"tactic_marks" =');
    expect(update).not.toContain('"observation_marks" =');
    expect(update).not.toContain('"knockdowns_against" =');
  });

  it('keeps the coach assignment EXISTS scope in listBouts used by prior-context (AC15)', async () => {
    const { repo, query } = harness();
    await repo.listBouts({
      scope: { kind: 'COACH', userId: fighterId },
      limit: 100,
    });
    const sql = query.mock.calls[0]?.[0].text as string;
    expect(sql).toContain('exists (select');
    expect(sql).toContain(
      '"coach_fighters"."fighter_id" = "bouts"."fighter_id"',
    );
    expect(sql).toContain('"coaches"."user_id" =');
    expect(sql).toContain('"coach_fighters"."ends_at" is null');
    expect(sql).toContain('"coaches"."deleted_at" is null');
  });
});
