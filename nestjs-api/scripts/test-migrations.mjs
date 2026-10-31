import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { migrationNames, readVerifiedMigrations } from './migration-files.mjs';
import { testMedicalMigration } from './test-medical-migration.mjs';

// Isolated disposable PostgreSQL only. Never reads .env or DATABASE_URL.
const api = resolve(dirname(fileURLToPath(import.meta.url)), '..');
readVerifiedMigrations();
const bin =
  process.env.PG_TEST_BIN ||
  (process.platform === 'win32' ? 'C:/Program Files/PostgreSQL/18/bin' : '');
const scratch = mkdtempSync(join(tmpdir(), 'mma-migrations-'));
const data = join(scratch, 'data');
const env = Object.fromEntries(
  Object.entries(process.env).filter(([k]) => !/^PG|^DATABASE_URL$/i.test(k)),
);
env.PGCLIENTENCODING = 'UTF8';
function run(command, args, options = {}) {
  const exe = bin
    ? join(bin, command + (process.platform === 'win32' ? '.exe' : ''))
    : command;
  const result = spawnSync(exe, args, {
    env,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 8 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr || result.stdout}`);
  return (result.stdout || '').trim();
}
const port = await new Promise((resolvePort, reject) => {
  const server = createServer();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const p = server.address().port;
    server.close(() => resolvePort(p));
  });
});
function psql(database, sql) {
  const inputFile = join(scratch, 'query.sql');
  writeFileSync(inputFile, sql);
  return run('psql', [
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-h',
    '127.0.0.1',
    '-p',
    String(port),
    '-U',
    'mma_test_owner',
    '-d',
    database,
    '-At',
    '-f',
    inputFile,
  ]);
}
function migration(database, name) {
  return psql(database, readFileSync(join(api, 'migrations', name), 'utf8'));
}
const baseline = ['001_create_analysis_jobs.sql', '002_add_health_alerts.sql'];
const target003 = '003_mma_tms_complete_schema.sql';
const target004 = '004_seed_api_permissions.sql';
const target005 = '005_training_management.sql';
const target006 = '006_training_permissions.sql';
const target013 = '013_coaching_loop_and_constraints.sql';
const target014 = '014_video_ai_vertical_slice.sql';
const target015 = '015_notifications_delivery.sql';
const target016 = '016_medical_examination_details.sql';
const target017 = '017_doctor_assignment_notification.sql';
const target018 = '018_training_plan_phase.sql';
const target019 = '019_ai_delivery_receipts.sql';
const target020 = '020_movement_evidence_reviews.sql';
const target023 = '023_academy_settings.sql';
const target024 = '024_bouts.sql';
const trainingPermissionCodes = [
  'training.plan:get_all',
  'training.plan:read',
  'training.plan:create',
  'training.plan:update',
  'training.plan:transition',
  'training.plan_exercise:read',
  'training.plan_exercise:create',
  'training.plan_exercise:update',
  'training.plan_exercise:delete',
  'training.session:get_all',
  'training.session:read',
  'training.session:create',
  'training.session:update',
  'training.session:transition',
  'training.exercise:get_all',
  'training.exercise:read',
  'training.exercise:create',
  'training.exercise:update',
];
const authFixture = `CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
-- Match Supabase default grants to prove 003 explicitly revokes them.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;`;
let started = false,
  passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`PASS ${label}`);
}
function rejects(database, sql, pattern) {
  assert.throws(() => psql(database, sql), pattern);
}
function prepare(name) {
  psql('postgres', `CREATE DATABASE ${name};`);
  psql(name, authFixture);
  for (const file of baseline) migration(name, file);
}
try {
  run('initdb', [
    '-D',
    data,
    '-U',
    'mma_test_owner',
    '--auth-local=trust',
    '--auth-host=trust',
    '--encoding=UTF8',
    '--locale=C',
  ]);
  run(
    'pg_ctl',
    [
      '-D',
      data,
      '-l',
      join(scratch, 'postgres.log'),
      '-o',
      `-h 127.0.0.1 -p ${port}`,
      '-w',
      'start',
    ],
    { stdio: 'ignore' },
  );
  started = true;
  psql(
    'postgres',
    'CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;',
  );
  prepare('mma_clean');
  check('001 -> 002 -> 003 on an empty isolated database', () =>
    migration('mma_clean', target003),
  );
  check('004 registers Users and Fighters permissions without grants', () => {
    migration('mma_clean', target004);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(code, ',' ORDER BY code) FROM public.permissions;`,
      ),
      [
        'fighter:read',
        'fighter:get_all',
        'fighter:create',
        'fighter:update',
        'fighter:delete',
        'fighter.coach:assign',
        'fighter.coach:end',
        'fighter.coach:read',
        'fighter.measurement:read',
        'fighter.measurement:write',
        'fighter.medical:read',
        'fighter.session:read',
        'users.create',
        'users.delete',
        'users.profile.read',
        'users.read',
        'users.update',
      ]
        .sort()
        .join(','),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT (SELECT count(*) FROM public.role_permissions) + (SELECT count(*) FROM public.user_permissions);`,
      ),
      '0',
    );
  });
  check('005 adds milestones with defaults and constraints', () => {
    migration('mma_clean', target005);
    const info = psql(
      'mma_clean',
      `SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'training_plans' AND column_name = 'milestones';`,
    );
    assert.ok(info.includes('NO'), 'Expected NO for is_nullable');
    assert.ok(info.includes("'[]'::jsonb"), 'Expected default []');

    rejects(
      'mma_clean',
      `INSERT INTO public.training_plans (fighter_id, coach_id, title, start_date, milestones) VALUES ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'Test', '2026-01-01', '{"a":1}');`,
      /ck_training_plans_milestones/,
    );

    const version5 = psql(
      'mma_clean',
      `SELECT count(*) FROM mma_private.migration_history WHERE version = 5;`,
    );
    assert.equal(version5.trim(), '1');
  });
  check('reapplying 005 fails without changing migration history', () => {
    rejects(
      'mma_clean',
      readFileSync(join(api, 'migrations', target005), 'utf8'),
      /already been applied|collision/,
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 5;`,
      ),
      '1',
    );
  });
  check('reapplying 004 fails without changing the catalogue', () => {
    rejects(
      'mma_clean',
      readFileSync(join(api, 'migrations', target004), 'utf8'),
      /already been applied|collision/,
    );
    assert.equal(
      psql('mma_clean', `SELECT count(*) FROM public.permissions;`),
      '17',
    );
  });
  check('006 registers Training permissions with ADMIN grants only', () => {
    migration('mma_clean', target006);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(code, ',' ORDER BY code) FROM public.permissions WHERE code LIKE 'training.%';`,
      ),
      [...trainingPermissionCodes].sort().join(','),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions WHERE role = 'ADMIN';`,
      ),
      String(trainingPermissionCodes.length),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions WHERE role <> 'ADMIN';`,
      ),
      '0',
    );
    assert.equal(
      psql('mma_clean', `SELECT count(*) FROM public.user_permissions;`),
      '0',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT name FROM mma_private.migration_history WHERE version = 6;`,
      ),
      target006,
    );
  });
  check('reapplying 006 fails without changing the catalogue', () => {
    rejects(
      'mma_clean',
      readFileSync(join(api, 'migrations', target006), 'utf8'),
      /already been applied|collision/,
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.permissions WHERE code LIKE 'training.%';`,
      ),
      String(trainingPermissionCodes.length),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions WHERE role = 'ADMIN';`,
      ),
      String(trainingPermissionCodes.length),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 6;`,
      ),
      '1',
    );
  });
  check('018 adds the required plan phase enum and records ledger 18', () => {
    migration('mma_clean', target018);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'training_plan_phase';`,
      ),
      'base,build,fight_camp,taper,rehab,maintenance',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT data_type || ':' || udt_name || ':' || is_nullable || ':' || coalesce(column_default, 'none') FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'training_plans' AND column_name = 'phase';`,
      ),
      'USER-DEFINED:training_plan_phase:NO:none',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT name FROM mma_private.migration_history WHERE version = 18;`,
      ),
      target018,
    );
  });
  check('reapplying 018 fails without duplicating migration history', () => {
    rejects(
      'mma_clean',
      readFileSync(join(api, 'migrations', target018), 'utf8'),
      /018 has already been applied/,
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
      ),
      '1',
    );
  });
  const planFixture = (deletedAt) => `
    INSERT INTO auth.users(id) VALUES ('00000000-0000-4000-8000-0000000000a1'), ('00000000-0000-4000-8000-0000000000a2');
    INSERT INTO public.users(id, auth_user_id, email, role) VALUES
      ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'f018@example.invalid', 'FIGHTER'),
      ('00000000-0000-4000-8000-0000000000b2', '00000000-0000-4000-8000-0000000000a2', 'c018@example.invalid', 'COACH');
    INSERT INTO fighters(id, user_id, first_name, last_name, date_of_birth, weight_class)
      VALUES ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000b1', 'Test', 'Fighter', '2000-01-01', 'LIGHTWEIGHT');
    INSERT INTO coaches(id, user_id, first_name, last_name)
      VALUES ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000b2', 'Test', 'Coach');
    INSERT INTO training_plans(fighter_id, coach_id, title, start_date, deleted_at)
      VALUES ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2', 'Legacy plan', '2026-01-01', ${deletedAt ? "'2026-02-01'" : 'NULL'});`;
  for (const [database, deletedAt] of [
    ['mma_018_active_plan', false],
    ['mma_018_deleted_plan', true],
  ]) {
    prepare(database);
    for (const name of [target003, target004, target005])
      migration(database, name);
    psql(database, planFixture(deletedAt));
    check(
      `018 backfills ${deletedAt ? 'soft-deleted' : 'live'} plan to base`,
      () => {
        migration(database, target018);
        assert.equal(
          psql(
            database,
            `SELECT phase FROM training_plans;`,
          ),
          'base',
        );
        assert.equal(
          psql(
            database,
            `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
          ),
          '1',
        );
      },
    );
  }
  prepare('mma_018_missing_005');
  migration('mma_018_missing_005', target003);
  migration('mma_018_missing_005', target004);
  check('018 rejects a database without migration 005 history', () => {
    rejects(
      'mma_018_missing_005',
      readFileSync(join(api, 'migrations', target018), 'utf8'),
      /018 requires migration 005 history/,
    );
    assert.equal(
      psql(
        'mma_018_missing_005',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
      ),
      '0',
    );
  });
  for (const [database, prepareSql, pattern] of [
    [
      'mma_018_enum_collision',
      `CREATE TYPE public.training_plan_phase AS ENUM ('base');`,
      /018 training_plan_phase enum collision/,
    ],
    [
      'mma_018_column_collision',
      `ALTER TABLE public.training_plans ADD COLUMN phase text;`,
      /018 training_plans phase collision/,
    ],
  ]) {
    prepare(database);
    for (const name of [target003, target004, target005])
      migration(database, name);
    psql(database, prepareSql);
    check(`018 rejects ${database} without writing history`, () => {
      rejects(
        database,
        readFileSync(join(api, 'migrations', target018), 'utf8'),
        pattern,
      );
      assert.equal(
        psql(
          database,
          `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
        ),
        '0',
      );
    });
  }
  prepare('mma_013');
  for (const name of migrationNames.filter((name) => {
    const version = Number(name.slice(0, 3));
    return version >= 3 && version <= 12;
  }))
    migration('mma_013', name);
  check(
    '013 applies with migration history and coach identity foreign keys',
    () => {
      migration('mma_013', target013);
      assert.equal(
        psql(
          'mma_013',
          `SELECT count(*) FROM mma_private.migration_history WHERE version = 13;`,
        ),
        '1',
      );
      assert.equal(
        psql(
          'mma_013',
          `SELECT string_agg(f.attname || '->' || ft.relname, ',' ORDER BY f.attname)
         FROM pg_constraint c
         JOIN pg_class t ON t.oid = c.conrelid
         JOIN pg_class ft ON ft.oid = c.confrelid
         JOIN LATERAL unnest(c.conkey) k(attnum) ON true
         JOIN pg_attribute f ON f.attrelid = t.oid AND f.attnum = k.attnum
         WHERE t.relname = 'technique_references'
           AND c.contype = 'f'
           AND f.attname IN ('selected_by_id', 'revoked_by_id');`,
        ),
        'revoked_by_id->coaches,selected_by_id->coaches',
      );
    },
  );
  check('reapplying 013 fails without duplicating migration history', () => {
    rejects(
      'mma_013',
      readFileSync(join(api, 'migrations', target013), 'utf8'),
      /already been applied/,
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 13;`,
      ),
      '1',
    );
  });
  check('014 adds video training context and diagonal camera support', () => {
    migration('mma_013', target014);
    assert.equal(
      psql(
        'mma_013',
        `SELECT data_type || ':' || is_nullable || ':' || column_default
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'training_type';`,
      ),
      "USER-DEFINED:NO:'SHADOW_BOXING'::session_type",
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
         WHERE t.typname='camera_angle' AND enumlabel='DIAGONAL';`,
      ),
      'DIAGONAL',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 14;`,
      ),
      '1',
    );
  });
  check('reapplying 014 fails without duplicating migration history', () => {
    rejects(
      'mma_013',
      readFileSync(join(api, 'migrations', target014), 'utf8'),
      /already been applied/,
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 14;`,
      ),
      '1',
    );
  });
  check('015 adds notification dedupe and records ledger version 15', () => {
    migration('mma_013', target015);
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 15;`,
      ),
      '1',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'dedupe_key';`,
      ),
      'YES',
    );
  });
  check('reapplying 015 fails without duplicating migration history', () => {
    rejects(
      'mma_013',
      readFileSync(join(api, 'migrations', target015), 'utf8'),
      /already been applied/,
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 15;`,
      ),
      '1',
    );
  });
  check('016 adds examination details, snapshot exemptions, and ledger 16', () => {
    migration('mma_013', target016);
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 16;`,
      ),
      '1',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT to_regclass('public.medical_examination_details') IS NOT NULL AND to_regclass('public.medical_baseline_exemptions') IS NOT NULL;`,
      ),
      't',
    );
  });
  check('017 adds doctor assignment notification type and ledger 17', () => {
    migration('mma_013', target017);
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 17;`,
      ),
      '1',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='notification_type' AND enumlabel='FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED';`,
      ),
      'FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED',
    );
  });
  check('018 applies on the upgraded 013-017 chain and records ledger 18', () => {
    migration('mma_013', target018);
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
      ),
      '1',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'training_plans' AND column_name = 'phase';`,
      ),
      'NO',
    );
  });
  check('019 and 020 add immutable movement review history with scoped grants', () => {
    migration('mma_013', target019);
    migration('mma_013', target020);
    assert.equal(psql('mma_013', `SELECT relrowsecurity FROM pg_class WHERE oid='public.movement_evidence_reviews'::regclass;`), 't');
    assert.equal(psql('mma_013', `SELECT string_agg(role::text, ',' ORDER BY role::text) FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE p.code='movement.evidence:review';`), 'COACH,DOCTOR');
    assert.equal(psql('mma_013', `SELECT count(*) FROM pg_trigger WHERE tgrelid='public.movement_evidence_reviews'::regclass AND NOT tgisinternal;`), '2');
    psql('mma_013', `
      INSERT INTO auth.users(id) VALUES ('20000000-0000-4000-8000-000000000001');
      INSERT INTO public.users(id, auth_user_id, email, role) VALUES
        ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'review-test@example.invalid', 'COACH');
      INSERT INTO public.analysis_jobs(id, video_url) VALUES ('20000000-0000-4000-8000-000000000003', 'https://example.invalid/test');
      INSERT INTO public.movement_evidence_reviews(job_id, window_id, reviewer_id, reviewer_role, revision, request_id, request_hash, evidence_hash, decision, notes)
      VALUES ('20000000-0000-4000-8000-000000000003', 'w1', '20000000-0000-4000-8000-000000000002', 'COACH', 1, '20000000-0000-4000-8000-000000000004', 'request', 'evidence', 'confirmed', 'Visible observation');
    `);
    rejects('mma_013', `UPDATE public.movement_evidence_reviews SET notes='overwritten';`, /append-only/);
    rejects('mma_013', `DELETE FROM public.movement_evidence_reviews;`, /append-only/);
    rejects('mma_013', `INSERT INTO public.movement_evidence_reviews SELECT * FROM public.movement_evidence_reviews;`, /duplicate key/);
    assert.equal(psql('mma_013', `SELECT count(*) FROM public.movement_evidence_reviews WHERE notes='Visible observation';`), '1');
    rejects('mma_013', `TRUNCATE public.movement_evidence_reviews;`, /append-only/);
    rejects('mma_013', `SET ROLE authenticated; SELECT * FROM public.movement_evidence_reviews;`, /permission denied/);
    rejects('mma_013', readFileSync(join(api, 'migrations', target020), 'utf8'), /already applied/);
  });
  check('023 applies on ledger 20, rejects second row, and records ledger 23', () => {
    migration('mma_013', target023);
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM mma_private.migration_history WHERE version = 23;`),
      '1',
    );
    assert.equal(
      psql('mma_013', `SELECT medical_supervision FROM public.academy_settings;`),
      'DOCTOR',
    );
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.academy_settings;`),
      '1',
    );
    rejects('mma_013', `INSERT INTO public.academy_settings DEFAULT VALUES;`, /duplicate key|violates/);
    rejects('mma_013', readFileSync(join(api, 'migrations', target023), 'utf8'), /already applied/);

    // Verify audit trigger on update
    psql('mma_013', `
      SELECT set_config('request.jwt.claims', '{"sub":"test-admin-sub"}', true);
      SELECT set_config('mma.request_id', 'test-req-001', true);
      UPDATE public.academy_settings SET medical_supervision = 'NONE', change_reason = 'Testing no doctor mode' WHERE id = true;
    `);
    assert.equal(
      psql('mma_013', `SELECT medical_supervision FROM public.academy_settings;`),
      'NONE',
    );
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.audit_logs WHERE resource_type = 'academy_settings' AND action = 'UPDATE';`),
      '1',
    );
  });
  check('024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions', () => {
    const writePermission = (role) =>
      psql(
        'mma_013',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = '${role}' AND p.code = 'fighter.measurement:write';`,
      );
    assert.equal(writePermission('FIGHTER'), '0');
    migration('mma_013', target024);
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM mma_private.migration_history WHERE version = 24;`),
      '1',
    );

    // Three presets with the agreed flags and list sizes.
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.competition_rulesets;`),
      '3',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT string_agg(name || '|' || sport || '|' || verified || '|' || jsonb_array_length(weight_classes) || '|' || jsonb_array_length(requirement_templates) || '|' || jsonb_array_length(suspension_rules) || '|' || coalesce(array_to_string(default_blocked_session_types, ','), ''), ' # ' ORDER BY name) FROM public.competition_rulesets;`,
      ),
      [
        'Boxing nghiệp dư – AIBA (tham khảo)|BOXING|false|12|3|5|SHADOW_BOXING,PAD_WORK,HEAVY_BAG,SPARRING,GRAPPLING,STRENGTH_CONDITIONING',
        'MMA – VMMAF 2021|MMA|true|12|0|0|SPARRING,GRAPPLING',
        'Tự nhập|MMA|false|0|0|0|',
      ].join(' # '),
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT string_agg(t->>'code' || ':' || (t->>'required') || ':' || (t->>'validityDays'), ',' ORDER BY t->>'code') FROM public.competition_rulesets, jsonb_array_elements(requirement_templates) t WHERE name LIKE 'Boxing%';`,
      ),
      'FEDERATION_REG:true:365,HEALTH_CERT:true:180,INSURANCE:true:365',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT string_agg(coalesce(c->>'limitKg', 'open'), ',') FROM public.competition_rulesets, jsonb_array_elements(weight_classes) c WHERE name LIKE 'MMA%';`,
      ),
      '44,48,52,56,60,65,70,77,84,93,120,open',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT string_agg(coalesce(c->>'limitKg', 'open'), ',') FROM public.competition_rulesets, jsonb_array_elements(weight_classes) c WHERE name LIKE 'Boxing%';`,
      ),
      '48,51,54,57,60,63.5,67,71,75,81,91,open',
    );
    assert.equal(
      psql(
        'mma_013',
        `SELECT count(*) FROM public.competition_rulesets WHERE source_note IS NULL OR btrim(source_note) = '' OR (name LIKE 'Boxing%' AND source_note NOT LIKE '%mẫu tham khảo cho demo%');`,
      ),
      '0',
    );

    // Permission matrix.
    assert.equal(
      psql(
        'mma_013',
        `SELECT string_agg(p.code || '=' || roles, ';' ORDER BY p.code) FROM public.permissions p JOIN LATERAL (SELECT string_agg(rp.role::text, ',' ORDER BY rp.role::text) AS roles FROM public.role_permissions rp WHERE rp.permission_id = p.id) r ON true WHERE p.code IN ('ruleset:read','bout:get_all','bout:read','bout:create','bout:update','bout:result','bout:requirement');`,
      ),
      [
        'bout:create=ADMIN,COACH',
        'bout:get_all=ADMIN,COACH,DOCTOR,FIGHTER',
        'bout:read=ADMIN,COACH,DOCTOR,FIGHTER',
        'bout:requirement=ADMIN,COACH',
        'bout:result=ADMIN,COACH',
        'bout:update=ADMIN,COACH',
        'ruleset:read=ADMIN,COACH,DOCTOR',
      ].join(';'),
    );
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.permissions WHERE code IN ('ruleset:manage','bout:requirement_confirm');`),
      '0',
    );
    assert.equal(writePermission('FIGHTER'), '1');
    assert.equal(writePermission('COACH'), '0');
    assert.equal(writePermission('ADMIN'), '1');

    // Fixtures.
    psql('mma_013', `
      INSERT INTO auth.users(id) VALUES
        ('00000000-0000-4000-8000-0000000024a1'), ('00000000-0000-4000-8000-0000000024a2'),
        ('00000000-0000-4000-8000-0000000024a3');
      INSERT INTO public.users(id, auth_user_id, email, role) VALUES
        ('00000000-0000-4000-8000-0000000024b1', '00000000-0000-4000-8000-0000000024a1', 'f1-024@example.invalid', 'FIGHTER'),
        ('00000000-0000-4000-8000-0000000024b2', '00000000-0000-4000-8000-0000000024a2', 'c-024@example.invalid', 'COACH'),
        ('00000000-0000-4000-8000-0000000024b3', '00000000-0000-4000-8000-0000000024a3', 'f2-024@example.invalid', 'FIGHTER');
      INSERT INTO public.fighters(id, user_id, first_name, last_name, date_of_birth, weight_class) VALUES
        ('00000000-0000-4000-8000-0000000024c1', '00000000-0000-4000-8000-0000000024b1', 'Test', 'One', '2000-01-01', 'LIGHTWEIGHT'),
        ('00000000-0000-4000-8000-0000000024c3', '00000000-0000-4000-8000-0000000024b3', 'Test', 'Two', '2000-01-01', 'LIGHTWEIGHT');
      INSERT INTO public.coaches(id, user_id, first_name, last_name)
        VALUES ('00000000-0000-4000-8000-0000000024c2', '00000000-0000-4000-8000-0000000024b2', 'Test', 'Coach');
      INSERT INTO public.training_plans(id, fighter_id, coach_id, title, start_date, phase) VALUES
        ('00000000-0000-4000-8000-0000000024d1', '00000000-0000-4000-8000-0000000024c1', '00000000-0000-4000-8000-0000000024c2', 'Camp 1', '2026-09-01', 'fight_camp'),
        ('00000000-0000-4000-8000-0000000024d3', '00000000-0000-4000-8000-0000000024c3', '00000000-0000-4000-8000-0000000024c2', 'Camp 2', '2026-09-01', 'fight_camp');
    `);
    const boutInsert = (id, extra = {}) => {
      const v = {
        fighter: '00000000-0000-4000-8000-0000000024c1',
        weighIn: '2026-11-10 01:00:00+00',
        boutAt: '2026-11-11 03:00:00+00',
        status: 'SCHEDULED',
        plan: 'NULL',
        ...extra,
      };
      return `INSERT INTO public.bouts(id, fighter_id, coach_id, ruleset_id, event_name, weight_class_code, weight_limit_kg, acute_loss_limit_pct, requirements_due_days, weigh_in_at, bout_at, status, training_plan_id, created_by_id)
        SELECT '${id}', '${v.fighter}', '00000000-0000-4000-8000-0000000024c2', r.id, 'Test Cup', '60', 60, 8, 7, '${v.weighIn}', '${v.boutAt}', '${v.status}', ${v.plan}, '00000000-0000-4000-8000-0000000024b2'
        FROM public.competition_rulesets r WHERE r.name = 'Tự nhập';`;
    };
    const bout1 = '00000000-0000-4000-8000-0000000024e1';
    const bout2 = '00000000-0000-4000-8000-0000000024e2';
    psql('mma_013', boutInsert(bout1));
    assert.equal(
      psql('mma_013', `SELECT status || ',' || jsonb_array_length(history) FROM public.bouts WHERE id = '${bout1}';`),
      'SCHEDULED,0',
    );

    // weigh_in_at < bout_at
    rejects('mma_013', boutInsert('00000000-0000-4000-8000-0000000024e9', { weighIn: '2026-11-11 03:00:00+00' }), /ck_bouts_schedule/);
    rejects('mma_013', boutInsert('00000000-0000-4000-8000-0000000024e9', { weighIn: '2026-11-12 03:00:00+00' }), /ck_bouts_schedule/);

    // One running bout per fighter (CAMP, FIGHT_WEEK, WEIGHED_IN); SCHEDULED is unrestricted.
    psql('mma_013', `UPDATE public.bouts SET status = 'CAMP' WHERE id = '${bout1}';`);
    rejects('mma_013', boutInsert(bout2, { status: 'FIGHT_WEEK' }), /uq_bouts_active_per_fighter/);
    psql('mma_013', boutInsert(bout2));
    rejects('mma_013', `UPDATE public.bouts SET status = 'CAMP' WHERE id = '${bout2}';`, /uq_bouts_active_per_fighter/);
    psql('mma_013', boutInsert('00000000-0000-4000-8000-0000000024e3', { fighter: '00000000-0000-4000-8000-0000000024c3', status: 'CAMP' }));

    // cancel_reason and result/method consistency
    rejects('mma_013', `UPDATE public.bouts SET status = 'CANCELLED' WHERE id = '${bout2}';`, /ck_bouts_cancel_reason/);
    rejects('mma_013', `UPDATE public.bouts SET cancel_reason = 'x' WHERE id = '${bout2}';`, /ck_bouts_cancel_reason/);
    psql('mma_013', `UPDATE public.bouts SET status = 'CANCELLED', cancel_reason = 'Đối thủ rút' WHERE id = '${bout2}';`);
    rejects('mma_013', `UPDATE public.bouts SET status = 'COMPLETED' WHERE id = '${bout1}';`, /ck_bouts_(result|method)/);
    rejects('mma_013', `UPDATE public.bouts SET result = 'WIN', method = 'KO' WHERE id = '${bout1}';`, /ck_bouts_(result|method)/);
    psql('mma_013', `UPDATE public.bouts SET status = 'COMPLETED', result = 'WIN', method = 'KO' WHERE id = '${bout1}';`);

    // fighter_id is immutable; plans must belong to the same fighter.
    rejects('mma_013', `UPDATE public.bouts SET fighter_id = '00000000-0000-4000-8000-0000000024c3' WHERE id = '${bout2}';`, /immutable/);
    rejects('mma_013', boutInsert('00000000-0000-4000-8000-0000000024e8', { plan: `'00000000-0000-4000-8000-0000000024d3'` }), /fk_bout_plan_fighter/);
    psql('mma_013', boutInsert('00000000-0000-4000-8000-0000000024e7', { plan: `'00000000-0000-4000-8000-0000000024d1'` }));

    // Requirements
    const requirementInsert = (code, columns = '', values = '', source = 'PRESET') =>
      `INSERT INTO public.bout_requirements(bout_id, code, label, required, source${columns})
       VALUES ('${bout2}', '${code}', 'Label', true, '${source}'${values});`;
    psql('mma_013', requirementInsert('HEALTH_CERT'));
    rejects('mma_013', requirementInsert('HEALTH_CERT'), /uq_bout_requirements_code/);
    rejects('mma_013', requirementInsert('BAD_SOURCE', '', '', 'OTHER'), /ck_bout_requirements_source/);
    rejects('mma_013', requirementInsert('NO_VALID_UNTIL', ', status', ", 'PROVIDED'"), /ck_bout_requirements_valid_until/);
    rejects('mma_013', requirementInsert('NO_REASON', ', status', ", 'REJECTED'"), /ck_bout_requirements_rejected_reason/);
    psql('mma_013', requirementInsert('PROVIDED_OK', ', status, valid_until', ", 'PROVIDED', '2027-01-01'"));
    psql('mma_013', `DELETE FROM public.bout_requirements WHERE bout_id = '${bout2}' AND code = 'PROVIDED_OK';`);
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.audit_logs WHERE resource_type = 'bout_requirements' AND action = 'DELETE';`),
      '1',
    );
    assert.equal(
      psql('mma_013', `SELECT count(*) FROM public.audit_logs WHERE resource_type = 'bouts' AND action = 'INSERT';`),
      '4',
    );
    psql('mma_013', `UPDATE public.bout_requirements SET label = 'Renamed' WHERE code = 'HEALTH_CERT';`);
    assert.equal(
      psql('mma_013', `SELECT updated_at > created_at FROM public.bout_requirements WHERE code = 'HEALTH_CERT';`),
      't',
    );

    // Ruleset constraints
    rejects('mma_013', `INSERT INTO public.competition_rulesets(name, sport, weight_classes, requirement_templates) VALUES ('Bad', 'MMA', '{}'::jsonb, '[]'::jsonb);`, /ck_rulesets_weight_classes/);
    rejects('mma_013', `INSERT INTO public.competition_rulesets(name, sport, weight_classes, requirement_templates, acute_loss_limit_pct_long) VALUES ('Bad2', 'MMA', '[]'::jsonb, '[]'::jsonb, 20.5);`, /ck_rulesets_acute_pct/);
    rejects('mma_013', `INSERT INTO public.competition_rulesets(name, sport, weight_classes, requirement_templates) VALUES ('tự nhập', 'MMA', '[]'::jsonb, '[]'::jsonb);`, /uq_competition_rulesets_name/);

    // RLS on, no direct client access.
    for (const table of ['competition_rulesets', 'bouts', 'bout_requirements']) {
      assert.equal(
        psql('mma_013', `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.${table}'::regclass;`),
        't',
      );
      rejects('mma_013', `SET ROLE authenticated; SELECT * FROM public.${table};`, /permission denied/);
      rejects('mma_013', `SET ROLE anon; SELECT * FROM public.${table};`, /permission denied/);
    }

    // Re-application is refused.
    rejects('mma_013', readFileSync(join(api, 'migrations', target024), 'utf8'), /already applied/);
  });
  check('024 requires ledger 23 and leaves nothing behind on a collision', () => {
    prepare('mma_024_no_023');
    for (const name of migrationNames.filter((name) => {
      const version = Number(name.slice(0, 3));
      return version >= 3 && version <= 20;
    }))
      migration('mma_024_no_023', name);
    rejects('mma_024_no_023', readFileSync(join(api, 'migrations', target024), 'utf8'), /024 requires migration 023/);

    prepare('mma_024_collision');
    for (const name of migrationNames.filter((name) => {
      const version = Number(name.slice(0, 3));
      return version >= 3 && version <= 23;
    }))
      migration('mma_024_collision', name);
    psql('mma_024_collision', `CREATE TABLE public.bouts(id uuid);`);
    rejects('mma_024_collision', readFileSync(join(api, 'migrations', target024), 'utf8'), /024 type or table collision/);
    assert.equal(
      psql('mma_024_collision', `SELECT count(*) FROM mma_private.migration_history WHERE version = 24;`),
      '0',
    );
    assert.equal(
      psql('mma_024_collision', `SELECT count(*) FROM pg_type WHERE typname IN ('bout_status', 'bout_sport');`),
      '0',
    );
  });

  check('027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS', () => {
    const db = 'mma_013';
    const target = '027_opponent_analysis_and_rounds.sql';
    assert.equal(psql(db, 'SELECT count(*) FROM mma_private.migration_history WHERE version IN (25,26);'), '0');
    migration(db, target);
    const bout = '00000000-0000-4000-8000-0000000024e2';
    const user = '00000000-0000-4000-8000-0000000024b2';
    assert.equal(psql(db, `SELECT opponent_analysis::text || '|' || (scheduled_rounds IS NULL) FROM public.bouts WHERE id = '${bout}';`), '{}|true');
    for (const n of [0,13]) {
      rejects(db, `UPDATE public.bouts SET scheduled_rounds = ${n} WHERE id = '${bout}';`, /ck_bouts_scheduled_rounds/);
      rejects(db, `INSERT INTO public.bout_rounds(bout_id, round_no, recorded_by_id) VALUES ('${bout}', ${n}, '${user}');`, /round_no_check/);
    }
    rejects(db, `UPDATE public.bouts SET opponent_analysis = '[]' WHERE id = '${bout}';`, /ck_bouts_opponent_analysis/);
    psql(db, `INSERT INTO public.bout_rounds(bout_id, round_no, recorded_by_id) VALUES ('${bout}', 1, '${user}');`);
    rejects(db, `INSERT INTO public.bout_rounds(bout_id, round_no, recorded_by_id) VALUES ('${bout}', 1, '${user}');`, /uq_bout_rounds_bout_round/);
    rejects(db, `UPDATE public.bout_rounds SET tactic_marks = '[]';`, /ck_bout_rounds_tactic_marks/);
    rejects(db, `UPDATE public.bout_rounds SET observation_marks = '[]';`, /ck_bout_rounds_observation_marks/);
    rejects(db, `UPDATE public.bout_rounds SET self_score = 'OTHER';`, /self_score_check/);
    rejects(db, `UPDATE public.bout_rounds SET knockdowns_against = 11;`, /knockdowns_against_check/);
    rejects(db, `UPDATE public.bout_rounds SET note = repeat('x',301);`, /note_check/);
    psql(db, `INSERT INTO public.bout_rounds(bout_id, round_no, recorded_by_id, note) VALUES ('${bout}', 1, '${user}', 'new') ON CONFLICT (bout_id,round_no) DO UPDATE SET note=EXCLUDED.note;`);
    assert.equal(psql(db, `SELECT count(*) || '|' || min(note) FROM public.bout_rounds WHERE bout_id = '${bout}';`), '1|new');
    assert.equal(psql(db, `SELECT updated_at >= created_at FROM public.bout_rounds WHERE bout_id = '${bout}';`), 't');
    assert.equal(psql(db, `SELECT count(*) FROM public.audit_logs WHERE resource_type = 'bout_rounds' AND action IN ('INSERT','UPDATE');`), '2');
    assert.equal(psql(db, `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bout_rounds'::regclass;`), 't');
    for (const role of ['anon','authenticated']) {
      rejects(db, `SET ROLE ${role}; SELECT * FROM public.bout_rounds;`, /permission denied/);
      assert.equal(psql(db, `SELECT has_table_privilege('${role}', 'public.bout_rounds', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');`), 'f');
    }
    psql(db, `DELETE FROM public.bouts WHERE id = '${bout}';`);
    assert.equal(psql(db, 'SELECT count(*) FROM public.bout_rounds;'), '0');
    rejects(db, readFileSync(join(api,'migrations',target),'utf8'), /027 already applied/);
  });
  check('025 applies on ledger 24: enum, table, constraints, permissions, notifications, triggers and RLS', () => {
    const db = 'mma_013';
    const target = '025_suspensions.sql';
    migration(db, target);
    assert.equal(psql(db, 'SELECT count(*) FROM mma_private.migration_history WHERE version = 25;'), '1');
    assert.equal(
      psql(db, `SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'suspension_reason';`),
      'KO,TKO,DQ,MANDATORY_REST,MEDICAL,OTHER',
    );
    assert.equal(
      psql(db, `SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'notification_type' AND enumlabel IN ('BOUT_CREATED','BOUT_WEIGHT_AT_RISK','BOUT_REQUIREMENT_REJECTED','BOUT_REQUIREMENT_DUE','BOUT_WEIGHT_MISSING','SUSPENSION_CREATED','SUSPENSION_AWAITING_CLEARANCE');`),
      '7',
    );
    assert.equal(
      psql(
        db,
        `SELECT string_agg(p.code || '=' || roles, ';' ORDER BY p.code) FROM public.permissions p JOIN LATERAL (SELECT string_agg(rp.role::text, ',' ORDER BY rp.role::text) AS roles FROM public.role_permissions rp WHERE rp.permission_id = p.id) r ON true WHERE p.code IN ('suspension:read','suspension:create','suspension:clear');`,
      ),
      [
        'suspension:clear=COACH,DOCTOR',
        'suspension:create=ADMIN,COACH,DOCTOR',
        'suspension:read=ADMIN,COACH,DOCTOR,FIGHTER',
      ].join(';'),
    );
    const suspId = '00000000-0000-4000-8000-0000000025a1';
    const fighter = '00000000-0000-4000-8000-0000000024c1';
    const bout = '00000000-0000-4000-8000-0000000024e1';
    const user = '00000000-0000-4000-8000-0000000024b2';
    psql(
      db,
      `INSERT INTO public.suspensions(id, fighter_id, bout_id, reason, starts_on, ends_on, loss_of_consciousness, suggested_days, blocked_session_types, requires_clearance, created_by_id)
       VALUES ('${suspId}', '${fighter}', '${bout}', 'KO', '2026-11-11', '2026-12-10', 'UNDER_1_MIN', 30, '{SPARRING}', true, '${user}');`,
    );
    rejects(
      db,
      `INSERT INTO public.suspensions(fighter_id, reason, starts_on, ends_on, blocked_session_types, requires_clearance, created_by_id)
       VALUES ('${fighter}', 'MEDICAL', '2026-12-10', '2026-11-11', '{SPARRING}', true, '${user}');`,
      /ck_suspensions_dates/,
    );
    rejects(
      db,
      `INSERT INTO public.suspensions(fighter_id, reason, starts_on, ends_on, loss_of_consciousness, blocked_session_types, requires_clearance, created_by_id)
       VALUES ('${fighter}', 'KO', '2026-11-11', '2026-12-10', 'SEVERE', '{SPARRING}', true, '${user}');`,
      /ck_suspensions_loss_of_consciousness/,
    );
    rejects(
      db,
      `UPDATE public.suspensions SET cleared_at = now() WHERE id = '${suspId}';`,
      /ck_suspensions_cleared/,
    );
    rejects(
      db,
      `UPDATE public.suspensions SET cleared_by_id = '${user}' WHERE id = '${suspId}';`,
      /ck_suspensions_cleared/,
    );
    psql(
      db,
      `UPDATE public.suspensions SET cleared_at = now(), cleared_by_id = '${user}', clearance_note = 'Cleared by doctor' WHERE id = '${suspId}';`,
    );
    assert.equal(psql(db, `SELECT updated_at >= created_at FROM public.suspensions WHERE id = '${suspId}';`), 't');
    assert.equal(psql(db, `SELECT count(*) FROM public.audit_logs WHERE resource_type = 'suspensions' AND action IN ('INSERT','UPDATE');`), '2');
    assert.equal(psql(db, `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.suspensions'::regclass;`), 't');
    for (const role of ['anon', 'authenticated']) {
      rejects(db, `SET ROLE ${role}; SELECT * FROM public.suspensions;`, /permission denied/);
      assert.equal(psql(db, `SELECT has_table_privilege('${role}', 'public.suspensions', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER');`), 'f');
    }
    rejects(db, readFileSync(join(api, 'migrations', target), 'utf8'), /025 already applied/);
  });
  check('025 rejects missing ledger 24 and collisions atomically', () => {
    const target = readFileSync(join(api, 'migrations', '025_suspensions.sql'), 'utf8');
    rejects('mma_024_no_023', target, /025 requires migration 024/);
    assert.equal(psql('mma_024_no_023', 'SELECT count(*) FROM mma_private.migration_history WHERE version = 25;'), '0');
    psql('mma_013', 'DELETE FROM mma_private.migration_history WHERE version = 25;');
    rejects('mma_013', target, /025 .*collision/);
    assert.equal(psql('mma_013', 'SELECT count(*) FROM mma_private.migration_history WHERE version = 25;'), '0');
  });
  check('027 rejects missing ledger 24 and collisions atomically', () => {
    const target = readFileSync(join(api,'migrations','027_opponent_analysis_and_rounds.sql'),'utf8');
    rejects('mma_024_no_023', target, /027 requires migration 024/);
    assert.equal(psql('mma_024_no_023', 'SELECT count(*) FROM mma_private.migration_history WHERE version = 27;'), '0');
    psql('mma_013', 'DELETE FROM mma_private.migration_history WHERE version = 27;');
    rejects('mma_013', target, /027 .*collision/);
    assert.equal(psql('mma_013', 'SELECT count(*) FROM mma_private.migration_history WHERE version = 27;'), '0');
  });
  if (process.argv.includes('--export-catalog')) {
    mkdirSync(resolve(api, '../tmp'), { recursive: true });
    const catalog = psql(
      'mma_clean',
      readFileSync(join(api, 'scripts', 'schema-catalog.sql'), 'utf8'),
    );
    writeFileSync(resolve(api, '../tmp/schema-catalog.json'), catalog);
  }
  prepare('mma_005_collision');
  migration('mma_005_collision', target003);
  migration('mma_005_collision', target004);
  psql(
    'mma_005_collision',
    `ALTER TABLE public.training_plans ADD COLUMN milestones jsonb;`,
  );
  check(
    '005 rejects a pre-existing milestones column without writing history',
    () => {
      rejects(
        'mma_005_collision',
        readFileSync(join(api, 'migrations', target005), 'utf8'),
        /005 training_plans milestones collision/,
      );
      assert.equal(
        psql(
          'mma_005_collision',
          `SELECT count(*) FROM mma_private.migration_history WHERE version = 5;`,
        ),
        '0',
      );
      assert.equal(
        psql(
          'mma_005_collision',
          `SELECT is_nullable FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'training_plans' AND column_name = 'milestones';`,
        ),
        'YES',
      );
    },
  );
  prepare('mma_006_missing_005');
  migration('mma_006_missing_005', target003);
  migration('mma_006_missing_005', target004);
  check('006 rejects a database without migration 005 history', () => {
    rejects(
      'mma_006_missing_005',
      readFileSync(join(api, 'migrations', target006), 'utf8'),
      /006 requires migration 005 history/,
    );
    assert.equal(
      psql(
        'mma_006_missing_005',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 6;`,
      ),
      '0',
    );
  });
  prepare('mma_006_collision');
  migration('mma_006_collision', target003);
  migration('mma_006_collision', target004);
  migration('mma_006_collision', target005);
  psql(
    'mma_006_collision',
    `INSERT INTO public.permissions (code, name, resource, action) VALUES ('training.plan:read', 'Collision', 'training_plan', 'read');`,
  );
  check('006 rejects a permission collision without partial inserts', () => {
    rejects(
      'mma_006_collision',
      readFileSync(join(api, 'migrations', target006), 'utf8'),
      /006 API permission catalogue collision/,
    );
    assert.equal(
      psql(
        'mma_006_collision',
        `SELECT count(*) FROM public.permissions WHERE code LIKE 'training.%';`,
      ),
      '1',
    );
    assert.equal(
      psql(
        'mma_006_collision',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 6;`,
      ),
      '0',
    );
  });
  prepare('mma_existing');
  psql(
    'mma_existing',
    `INSERT INTO public.analysis_jobs (id,video_url,score,health_alerts,joint_states,alert_count) VALUES
    ('00000000-0000-0000-0000-000000000001','https://example.invalid/legacy.mp4',123,'{"legacy":"shape"}','[1,2]',-1);
    CREATE TABLE baseline_snapshot AS SELECT to_jsonb(j) AS payload FROM public.analysis_jobs j;`,
  );
  check('003 preserves nonempty legacy data without coercion', () => {
    migration('mma_existing', target003);
    assert.equal(
      psql(
        'mma_existing',
        `SELECT (to_jsonb(j)-ARRAY['fighter_id','session_id','video_id','algorithm_config_id','created_by_id'])=s.payload FROM public.analysis_jobs j CROSS JOIN baseline_snapshot s;`,
      ),
      't',
    );
  });
  check('old insert/update contract still works', () => {
    psql(
      'mma_existing',
      `INSERT INTO analysis_jobs(video_url) VALUES ('https://example.invalid/new.mp4'); UPDATE analysis_jobs SET status='DONE',score=50,health_alerts='[]',joint_states='{}',alert_count=0,has_impairment=false WHERE score IS NULL;`,
    );
    assert.equal(
      psql(
        'mma_existing',
        `SELECT count(*) FROM analysis_jobs WHERE user_id='anonymous';`,
      ),
      '2',
    );
    assert.equal(
      psql(
        'mma_existing',
        `SELECT count(*) FROM pg_trigger WHERE tgrelid='analysis_jobs'::regclass AND tgfoid='update_updated_at()'::regprocedure;`,
      ),
      '1',
    );
  });
  check('reapplying 003 fails safely', () => {
    rejects(
      'mma_existing',
      readFileSync(join(api, 'migrations', target003), 'utf8'),
      /Baseline drift|already/,
    );
    assert.equal(
      psql('mma_existing', 'SELECT count(*) FROM analysis_jobs;'),
      '2',
    );
  });
  prepare('mma_drift');
  psql(
    'mma_drift',
    'ALTER TABLE analysis_jobs ALTER COLUMN score TYPE bigint;',
  );
  check('baseline drift aborts before domain DDL', () => {
    rejects(
      'mma_drift',
      readFileSync(join(api, 'migrations', target003), 'utf8'),
      /Baseline column drift/,
    );
    assert.equal(
      psql(
        'mma_drift',
        `SELECT to_regclass('public.users') IS NULL AND to_regnamespace('mma_private') IS NULL;`,
      ),
      't',
    );
  });
  prepare('mma_partial');
  psql('mma_partial', 'CREATE TABLE public.fighters (id uuid);');
  check('partial domain collision rolls back all new objects', () => {
    rejects(
      'mma_partial',
      readFileSync(join(api, 'migrations', target003), 'utf8'),
      /already exists/,
    );
    assert.equal(
      psql(
        'mma_partial',
        `SELECT to_regclass('public.users') IS NULL AND to_regnamespace('mma_private') IS NULL AND to_regtype('public.user_role') IS NULL;`,
      ),
      't',
    );
  });
  const fixture = join(api, 'test', 'migrations', 'domain.sql');
  check('domain integrity and RLS role matrix', () =>
    psql('mma_clean', readFileSync(fixture, 'utf8')),
  );
  prepare('mma_medical');
  check('fresh clinical schema through 011', () => {
    for (const name of migrationNames.filter((name) => {
      const version = Number(name.slice(0, 3));
      return version >= 3 && version <= 11;
    }))
      migration('mma_medical', name);
  });
  passed += await testMedicalMigration({
    connection: {
      host: '127.0.0.1',
      port,
      user: 'mma_test_owner',
      password: '',
    },
    migrationSql: readFileSync(
      join(api, 'migrations', '012_medical_clearance_issue_order.sql'),
      'utf8',
    ),
  });
  if (process.argv.includes('--export-catalog')) {
    const catalog = psql(
      'mma_medical_rollback',
      readFileSync(join(api, 'scripts', 'schema-catalog.sql'), 'utf8'),
    );
    writeFileSync(resolve(api, '../tmp/schema-catalog.json'), catalog);
  }
  console.log(
    `Migration checks passed: ${passed}. PostgreSQL stopped after tests. Scratch: ${scratch}`,
  );
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
}
