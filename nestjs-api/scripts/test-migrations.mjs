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
        'fighters.coaches.assign',
        'fighters.coaches.end',
        'fighters.coaches.read',
        'fighters.measurements.read',
        'fighters.measurements.write',
        'fighters.medical.read',
        'fighters.read',
        'fighters.sessions.read',
        'fighters.update',
        'users.create',
        'users.delete',
        'users.profile.read',
        'users.read',
        'users.update',
      ].join(','),
    );
    assert.equal(
      psql(
        'mma_clean',
        `SELECT (SELECT count(*) FROM public.role_permissions) + (SELECT count(*) FROM public.user_permissions);`,
      ),
      '0',
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
      '14',
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
