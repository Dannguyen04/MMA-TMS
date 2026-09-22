import {
  migrationNames,
  readVerifiedMigrations,
} from './scripts/migration-files.mjs';
import { createHash } from 'node:crypto';

// Default is local validation. No credentials in source; no automatic .env loading.
const mode = process.argv[2] ?? '--check';
const versionOf = (name) => name.slice(0, 3);
// 001 and 002 are bootstrap files; every later migration is applied one at a time.
const migrationByMode = new Map(
  migrationNames
    .filter((name) => versionOf(name) >= '003')
    .map((name) => [`--apply-${versionOf(name)}`, name]),
);
const modes = ['--check', ...migrationByMode.keys()];
if (!modes.includes(mode) || process.argv.length > 3) {
  console.error(`Usage: node run_sql.mjs [${modes.join(' | ')}]`);
  process.exitCode = 1;
} else {
  let client;
  try {
    const migrations = readVerifiedMigrations();
    if (mode === '--check') {
      console.log(
        `${versionOf(migrationNames[0])}-${versionOf(migrationNames.at(-1))} checksums OK. No database connection was opened.`,
      );
    } else {
      const migrationName = migrationByMode.get(mode);
      const migrationVersion = versionOf(migrationName);
      if (!process.env.DATABASE_URL)
        throw new Error(`DATABASE_URL is required for ${mode}.`);
      let url;
      try {
        url = new URL(process.env.DATABASE_URL);
      } catch {
        throw new Error('Invalid DATABASE_URL format.');
      }
      if (!['postgres:', 'postgresql:'].includes(url.protocol))
        throw new Error('DATABASE_URL must use postgres:// or postgresql://.');
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'])
        url.searchParams.delete(key);
      const { Client } = await import('pg');
      client = new Client({
        connectionString: url.toString(),
        ssl: local ? false : { rejectUnauthorized: true },
        connectionTimeoutMillis: 10_000,
        application_name: `mma-tms-migration-${migrationVersion}`,
      });
      await client.connect();
      // Each file owns BEGIN/COMMIT and its preflight; earlier files are not replayed.
      const sql = migrations.get(migrationName);
      await client.query(
        "SELECT set_config('mma.migration_sha256', $1, false)",
        [createHash('sha256').update(sql).digest('hex')],
      );
      await client.query(sql);
      console.log(
        `Applied ${migrationVersion} successfully. Earlier migrations were not executed.`,
      );
    }
  } catch (error) {
    console.error(
      client
        ? `${mode} failed (${error.code ?? 'connection/query error'}). No automatic retry.`
        : error.message,
    );
    process.exitCode = 1;
  } finally {
    if (client) await client.end().catch(() => {});
  }
}
