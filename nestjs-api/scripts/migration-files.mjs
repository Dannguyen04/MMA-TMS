import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const migrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../migrations',
);
export const migrationNames = [
  '001_create_analysis_jobs.sql',
  '002_add_health_alerts.sql',
  '003_mma_tms_complete_schema.sql',
  '004_seed_api_permissions.sql',
  '005_coaching_loop_and_constraints.sql',
];
export function readVerifiedMigrations() {
  const manifest = JSON.parse(
    readFileSync(resolve(migrationDirectory, 'manifest.json'), 'utf8'),
  );
  const result = new Map();
  for (const name of migrationNames) {
    const sql = readFileSync(resolve(migrationDirectory, name), 'utf8').replace(
      /\r\n/g,
      '\n',
    );
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (manifest.sha256_lf?.[name] !== checksum)
      throw new Error(
        `Migration checksum mismatch: ${name}. Review SQL and manifest together.`,
      );
    result.set(name, sql);
  }
  return result;
}
