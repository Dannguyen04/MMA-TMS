import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

// Called only by the disposable PostgreSQL harness; never reads DATABASE_URL.
export async function testMedicalMigration({ connection, migrationSql }) {
  const authId = '00000000-0000-4000-8000-000000000001';
  const userId = '00000000-0000-4000-8000-000000000002';
  const fighterUserId = '00000000-0000-4000-8000-000000000003';
  const fighterId = '00000000-0000-4000-8000-000000000004';
  const doctorId = '00000000-0000-4000-8000-000000000005';
  const examId = '00000000-0000-4000-8000-000000000006';
  const fixture = `
    INSERT INTO auth.users(id) VALUES ('${authId}'), ('${fighterUserId}');
    INSERT INTO users(id, auth_user_id, email, role) VALUES
      ('${userId}', '${authId}', 'doctor@example.test', 'DOCTOR'),
      ('${fighterUserId}', '${fighterUserId}', 'fighter@example.test', 'FIGHTER');
    INSERT INTO fighters(id, user_id, first_name, last_name, date_of_birth, weight_class)
      VALUES ('${fighterId}', '${fighterUserId}', 'Test', 'Fighter', '2000-01-01', 'LIGHTWEIGHT');
    INSERT INTO sports_doctors(id, user_id, first_name, last_name, license_number)
      VALUES ('${doctorId}', '${userId}', 'Test', 'Doctor', 'TEST-012');
    INSERT INTO medical_examinations(id, fighter_id, doctor_id, recorded_by_id,
      scope, decision, examined_at, reason)
      VALUES ('${examId}', '${fighterId}', '${doctorId}', '${userId}',
        'TRAINING', 'ELIGIBLE', '2026-01-01', 'Migration concurrency fixture');
  `;
  const insertClearance = (type) => `
    INSERT INTO medical_clearances(fighter_id, issued_by_id, examination_id,
      clearance_type, valid_from, created_at)
    VALUES ('${fighterId}', '${doctorId}', '${examId}', '${type}',
      '2026-01-02', '2026-01-02') RETURNING id, issue_sequence;
  `;
  let passed = 0;
  function pass(label) {
    passed++;
    console.log(`PASS ${label}`);
  }

  for (const outcome of ['commit', 'rollback']) {
    const database = `mma_medical_${outcome}`;
    const admin = new pg.Client({ ...connection, database: 'postgres' });
    await admin.connect();
    try {
      await admin.query(`CREATE DATABASE ${database} TEMPLATE mma_medical`);
    } finally {
      await admin.end();
    }
    const observer = new pg.Client({ ...connection, database });
    const writer = new pg.Client({ ...connection, database });
    const migrator = new pg.Client({ ...connection, database });
    let migrationResult;
    try {
      await observer.connect();
      await writer.connect();
      await migrator.connect();
      await observer.query(fixture);
      await writer.query('BEGIN');
      await writer.query(
        "SELECT set_config('request.jwt.claim.sub', $1, true)",
        [authId],
      );
      // Before 012 there is no issue_sequence column yet.
      await writer.query(
        insertClearance('TRAINING').replace(', issue_sequence', ''),
      );
      const {
        rows: [{ pid }],
      } = await migrator.query('SELECT pg_backend_pid() AS pid');
      // Attach a rejection handler immediately; both outcomes are asserted below.
      migrationResult = migrator.query(migrationSql).then(
        () => ({ error: null }),
        (error) => ({ error }),
      );
      const deadline = Date.now() + 4000;
      let waiting = false;
      while (Date.now() < deadline) {
        const { rows } = await observer.query(
          `
          SELECT 1 FROM pg_locks WHERE pid = $1
            AND relation = 'public.medical_clearances'::regclass
            AND mode = 'AccessExclusiveLock' AND NOT granted
        `,
          [pid],
        );
        if (rows.length) {
          waiting = true;
          break;
        }
        await delay(20);
      }
      assert.ok(
        waiting,
        'migration must wait for the in-flight clearance issuer',
      );
      await writer.query(outcome === 'commit' ? 'COMMIT' : 'ROLLBACK');
      const result = await migrationResult;

      if (outcome === 'commit') {
        assert.match(
          result.error?.message ?? '',
          /012 must run before examination-linked clearances exist/,
        );
        await migrator.query('ROLLBACK');
        const {
          rows: [state],
        } = await observer.query(`
          SELECT
            (SELECT count(*)::int FROM medical_clearances) AS clearances,
            (SELECT count(*)::int FROM medical_clearance_revisions) AS revisions,
            EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 12) AS applied,
            EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_name = 'medical_clearances' AND column_name = 'issue_sequence') AS column_exists
        `);
        assert.deepEqual(state, {
          clearances: 1,
          revisions: 1,
          applied: false,
          column_exists: false,
        });
        pass(
          '012 rejects a concurrently committed clearance and rolls back DDL/ledger',
        );
      } else {
        assert.equal(result.error, null);
        const {
          rows: [state],
        } = await observer.query(`
          SELECT
            (SELECT count(*)::int FROM medical_clearances) AS clearances,
            (SELECT count(*)::int FROM medical_clearance_revisions) AS revisions,
            EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 12) AS applied
        `);
        assert.deepEqual(state, { clearances: 0, revisions: 0, applied: true });
        pass(
          '012 proceeds after a concurrent issuer rolls back; no orphan revision',
        );

        await writer.query('BEGIN');
        await writer.query(
          "SELECT set_config('request.jwt.claim.sub', $1, true)",
          [authId],
        );
        const {
          rows: [first],
        } = await writer.query(insertClearance('TRAINING'));
        const {
          rows: [second],
        } = await writer.query(insertClearance('RETURN_FROM_INJURY'));
        await writer.query('COMMIT');
        assert.ok(BigInt(second.issue_sequence) > BigInt(first.issue_sequence));
        const { rows } = await observer.query(`
          SELECT id FROM medical_clearances ORDER BY issue_sequence DESC
        `);
        assert.deepEqual(
          rows.map((row) => row.id),
          [second.id, first.id],
        );
        pass(
          '012 orders identical created_at values by server issuance sequence',
        );

        await assert.rejects(
          migrator.query(migrationSql),
          /012 has already been applied/,
        );
        await migrator.query('ROLLBACK');
        pass('012 rejects reapplication without changing the applied ledger');
      }
    } finally {
      await writer.query('ROLLBACK').catch(() => {});
      if (migrationResult) await migrationResult;
      await migrator.query('ROLLBACK').catch(() => {});
      await Promise.allSettled([writer.end(), migrator.end(), observer.end()]);
    }
  }
  return passed;
}
