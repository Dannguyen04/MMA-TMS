import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import assert from 'node:assert/strict';
import { readVerifiedMigrations } from './migration-files.mjs';

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
const target007 = '007_role_permission_baseline.sql';
const target008 = '008_restrict_clinical_rls.sql';
const target009 = '009_enable_assignment_scoped_fighter_access.sql';
const target010 = '010_local_auth_credentials_sessions.sql';
const target011 = '011_fix_local_password_hash_constraint.sql';
const target012 = '012_password_reset_outbox.sql';
const target013 = '013_account_directory_status.sql';
const target014 = '014_user_invitations.sql';
const target015 = '015_doctor_assignment_permissions.sql';
const target016 = '016_video_storage_contract.sql';
const target017 = '017_fighter_ui_profile_fields.sql';
const target018 = '018_coach_feedback.sql';
const target019 = '019_staff_directory.sql';
const target020 = '020_performance_permissions.sql';
const target021 = '021_goals_progress.sql';
const reapplyTargets = [
  target007,
  target008,
  target009,
  target010,
  target011,
  target012,
  target013,
  target014,
  target015,
  target016,
  target017,
  target018,
  target019,
  target020,
  target021,
];
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
  check('007 installs a least-privilege role baseline', () => {
    migration('mma_clean', target007);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions WHERE role = 'FIGHTER';`,
      ),
      '18',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'COACH' AND p.code LIKE 'fighter:%';`,
      ),
      '0',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'DOCTOR' AND (p.code LIKE 'fighter:%' OR p.code = 'fighter.medical:read');`,
      ),
      '0',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'ADMIN' AND p.code IN ('fighter.medical:read','fighter.measurement:read','fighter.measurement:write');`,
      ),
      '0',
    );
  });
  check('008 narrows the shared clinical RLS helper', () => {
    migration('mma_clean', target008);
    const helper = psql(
      'mma_clean',
      `SELECT pg_get_functiondef('mma_private.can_read_fighter_medical(uuid)'::regprocedure);`,
    );
    assert.match(helper, /actor\.role = 'FIGHTER'/);
    assert.match(helper, /actor\.role = 'DOCTOR'/);
    assert.doesNotMatch(helper, /IN \('COACH','DOCTOR','ADMIN'\)/);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version IN (7,8);`,
      ),
      '2',
    );
  });
  check('009 enables only assignment-scoped Fighter API permissions', () => {
    migration('mma_clean', target009);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(p.code, ',' ORDER BY p.code) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'COACH' AND p.code LIKE 'fighter%';`,
      ),
      [
        'fighter:get_all',
        'fighter.coach:read',
        'fighter.medical:read',
        'fighter.session:read',
        'fighter:read',
      ]
        .sort()
        .join(','),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(p.code, ',' ORDER BY p.code) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'DOCTOR' AND p.code LIKE 'fighter%';`,
      ),
      [
        'fighter:get_all',
        'fighter.measurement:read',
        'fighter.measurement:write',
        'fighter.medical:read',
        'fighter.session:read',
        'fighter:read',
      ]
        .sort()
        .join(','),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'ADMIN' AND p.code IN ('fighter.medical:read','fighter.measurement:read','fighter.measurement:write');`,
      ),
      '0',
    );
  });
  check('010 creates private local credential and session storage', () => {
    migration('mma_clean', target010);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT to_regclass('public.local_auth_credentials') IS NOT NULL AND to_regclass('public.local_auth_sessions') IS NOT NULL;`,
      ),
      't',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT has_table_privilege('authenticated', 'public.local_auth_credentials', 'SELECT') OR has_table_privilege('authenticated', 'public.local_auth_sessions', 'SELECT');`,
      ),
      'f',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 10;`,
      ),
      '1',
    );
  });
  check('011 accepts the canonical scrypt credential format', () => {
    migration('mma_clean', target011);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' ~ $regex$^scrypt\\$16384\\$8\\$1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{86}$$regex$;`,
      ),
      't',
    );
  });
  check('012 creates private reset requests and auth outbox', () => {
    migration('mma_clean', target012);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT to_regclass('public.password_reset_requests') IS NOT NULL AND to_regclass('public.auth_outbox') IS NOT NULL;`,
      ),
      't',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT has_table_privilege('authenticated', 'public.password_reset_requests', 'SELECT') OR has_table_privilege('authenticated', 'public.auth_outbox', 'SELECT');`,
      ),
      'f',
    );
  });
  check('013 adds account directory fields and enforced statuses', () => {
    migration('mma_clean', target013);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(column_name, ',' ORDER BY column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('account_status','phone','title','last_active_at');`,
      ),
      'account_status,last_active_at,phone,title',
    );
    psql(
      'mma_clean',
      `INSERT INTO auth.users(id) VALUES ('10000000-0000-4000-8000-000000000013');
       INSERT INTO public.users(email, auth_user_id, role)
       VALUES ('status-check@example.test', '10000000-0000-4000-8000-000000000013', 'ADMIN');`,
    );
    rejects(
      'mma_clean',
      `UPDATE public.users SET account_status = 'DELETED';`,
      /ck_users_account_status/,
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 13;`,
      ),
      '1',
    );
  });
  check(
    '014 creates private invitation state and expands the auth outbox',
    () => {
      migration('mma_clean', target014);
      assert.equal(
        psql(
          'mma_clean',
          `SELECT to_regclass('public.user_invitation_requests') IS NOT NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'display_name');`,
        ),
        't',
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT has_table_privilege('authenticated', 'public.user_invitation_requests', 'SELECT');`,
        ),
        'f',
      );
      psql(
        'mma_clean',
        `INSERT INTO public.auth_outbox(user_id, event_type, recipient_email, request_id)
       SELECT id, 'USER_INVITED', email, '14000000-0000-4000-8000-000000000014'
       FROM public.users WHERE email = 'status-check@example.test';`,
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT count(*) FROM mma_private.migration_history WHERE version = 14;`,
        ),
        '1',
      );
    },
  );
  check('015 grants scoped doctor-assignment permissions', () => {
    migration('mma_clean', target015);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT string_agg(code, ',' ORDER BY code) FROM public.permissions WHERE code LIKE 'fighter.doctor:%';`,
      ),
      'fighter.doctor:assign,fighter.doctor:end,fighter.doctor:read',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.code = 'fighter.doctor:read';`,
      ),
      '4',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.code IN ('fighter.doctor:assign','fighter.doctor:end') AND rp.role = 'ADMIN';`,
      ),
      '2',
    );
  });
  check(
    '016 adds persisted video training type and diagonal camera angle',
    () => {
      migration('mma_clean', target016);
      assert.equal(
        psql(
          'mma_clean',
          `SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'training_type' AND is_nullable = 'NO');`,
        ),
        't',
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT EXISTS (SELECT 1 FROM pg_enum enum JOIN pg_type type ON type.oid = enum.enumtypid WHERE type.typname = 'camera_angle' AND enum.enumlabel = 'DIAGONAL');`,
        ),
        't',
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT pg_get_constraintdef(oid) LIKE '%SPARRING%' AND pg_get_constraintdef(oid) NOT LIKE '%RECOVERY%' FROM pg_constraint WHERE conname = 'ck_video_training_type' AND conrelid = 'public.videos'::regclass;`,
        ),
        't',
      );
    },
  );
  check('017 adds persisted fighter fields required by the UI', () => {
    migration('mma_clean', target017);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'fighters' AND column_name IN ('nickname','sex','weight_kg','body_fat_pct','resting_heart_rate','training_level','primary_discipline','record_wins','record_losses','record_draws','upcoming_bout');`,
      ),
      '11',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version = 17;`,
      ),
      '1',
    );
  });
  check(
    '018 adds assignment-scoped coach feedback storage and permissions',
    () => {
      migration('mma_clean', target018);
      assert.equal(
        psql(
          'mma_clean',
          `SELECT to_regclass('public.coach_feedback') IS NOT NULL;`,
        ),
        't',
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT count(*) FROM public.permissions WHERE code IN ('training.feedback:get_all','training.feedback:create');`,
        ),
        '2',
      );
      assert.equal(
        psql(
          'mma_clean',
          `SELECT count(*) FROM mma_private.migration_history WHERE version = 18;`,
        ),
        '1',
      );
    },
  );
  check('019 adds complete staff directory fields and permissions', () => {
    migration('mma_clean', target019);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'coaches' AND column_name IN ('certifications','years_experience');`,
      ),
      '2',
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.permissions WHERE code LIKE 'staff.%';`,
      ),
      '4',
    );
  });
  check('020 grants scoped performance aggregate reads', () => {
    migration('mma_clean', target020);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE p.code = 'performance:read';`,
      ),
      '4',
    );
  });
  check('021 adds scoped goals and append-only progress', () => {
    migration('mma_clean', target021);
    assert.equal(
      psql(
        'mma_clean',
        `SELECT (to_regclass('public.fighter_goals') IS NOT NULL AND to_regclass('public.goal_progress_events') IS NOT NULL AND EXISTS (SELECT 1 FROM public.role_permissions rp JOIN public.permissions p ON p.id = rp.permission_id WHERE rp.role = 'COACH' AND p.code = 'goals:write'))::text;`,
      ),
      'true',
    );
  });
  check('reapplying 007 through 021 fails without duplicating history', () => {
    for (const name of reapplyTargets) {
      rejects(
        'mma_clean',
        readFileSync(join(api, 'migrations', name), 'utf8'),
        new RegExp(`${name.slice(0, 3)} has already been applied`),
      );
    }
    const versions = reapplyTargets.map((name) => Number(name.slice(0, 3)));
    assert.equal(
      psql(
        'mma_clean',
        `SELECT count(*) FROM mma_private.migration_history WHERE version IN (${versions.join(',')});`,
      ),
      String(versions.length),
    );
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
  console.log(
    `Migration checks passed: ${passed}. PostgreSQL stopped after tests. Scratch: ${scratch}`,
  );
} finally {
  if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
}
