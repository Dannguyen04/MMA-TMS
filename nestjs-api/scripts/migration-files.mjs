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
  '005_training_management.sql',
  '006_training_permissions.sql',
  '007_grant_api_permissions_to_admin.sql',
  '008_grant_training_read_permissions_to_fighter.sql',
  '009_role_permission_baseline.sql',
  '010_restrict_clinical_rls.sql',
  '011_enable_assignment_scoped_fighter_access.sql',
  '012_local_auth_credentials_sessions.sql',
  '013_fix_local_password_hash_constraint.sql',
  '014_password_reset_outbox.sql',
  '015_account_directory_status.sql',
  '016_user_invitations.sql',
  '017_doctor_assignment_permissions.sql',
  '018_video_storage_contract.sql',
  '019_fighter_ui_profile_fields.sql',
  '020_coach_feedback.sql',
  '021_staff_directory.sql',
  '022_performance_permissions.sql',
  '023_goals_progress.sql',
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
