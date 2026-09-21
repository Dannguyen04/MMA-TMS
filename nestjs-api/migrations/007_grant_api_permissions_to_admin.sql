-- MMA-TMS 007: grant the migration 004 API permissions to ADMIN.
-- 004 was catalogue-only; this restores the ADMIN baseline required by the
-- permission rules. user_permissions is never touched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 7);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '007 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 6
  ) THEN
    RAISE EXCEPTION '007 requires migration 006 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 7
  ) THEN
    RAISE EXCEPTION '007 has already been applied';
  END IF;

  IF (
    SELECT count(*)
    FROM public.permissions
    WHERE code = ANY (ARRAY[
      'users.create',
      'users.read',
      'users.profile.read',
      'users.update',
      'users.delete',
      'fighter:get_all',
      'fighter:read',
      'fighter:create',
      'fighter:update',
      'fighter:delete',
      'fighter.measurement:read',
      'fighter.measurement:write',
      'fighter.coach:read',
      'fighter.coach:assign',
      'fighter.coach:end',
      'fighter.session:read',
      'fighter.medical:read'
    ])
  ) <> 17 THEN
    RAISE EXCEPTION '007 requires the complete migration 004 permission catalogue';
  END IF;
END
$preflight$;

-- Idempotent: an operator may already have granted some of these rows manually.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'ADMIN'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
  'users.create',
  'users.read',
  'users.profile.read',
  'users.update',
  'users.delete',
  'fighter:get_all',
  'fighter:read',
  'fighter:create',
  'fighter:update',
  'fighter:delete',
  'fighter.measurement:read',
  'fighter.measurement:write',
  'fighter.coach:read',
  'fighter.coach:assign',
  'fighter.coach:end',
  'fighter.session:read',
  'fighter.medical:read'
])
ON CONFLICT (role, permission_id) DO NOTHING;

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  7,
  '007_grant_api_permissions_to_admin.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
