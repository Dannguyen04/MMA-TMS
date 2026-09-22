-- MMA-TMS 008: grant read-only Training permissions to the FIGHTER role.
-- Role baseline only (FR-FIGHTER-002, FR-TRAIN-003). Write and transition
-- permissions stay off the FIGHTER baseline. user_permissions is never touched.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 8);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '008 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 7
  ) THEN
    RAISE EXCEPTION '008 requires migration 007 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 8
  ) THEN
    RAISE EXCEPTION '008 has already been applied';
  END IF;

  IF (
    SELECT count(*)
    FROM public.permissions
    WHERE code = ANY (ARRAY[
      'training.plan:get_all',
      'training.plan:read',
      'training.plan_exercise:read',
      'training.session:get_all',
      'training.session:read',
      'training.exercise:get_all',
      'training.exercise:read'
    ])
  ) <> 7 THEN
    RAISE EXCEPTION '008 requires the migration 006 training permission catalogue';
  END IF;
END
$preflight$;

-- Idempotent: an operator may already have granted some of these rows manually.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'FIGHTER'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
  'training.plan:get_all',
  'training.plan:read',
  'training.plan_exercise:read',
  'training.session:get_all',
  'training.session:read',
  'training.exercise:get_all',
  'training.exercise:read'
])
ON CONFLICT (role, permission_id) DO NOTHING;

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  8,
  '008_grant_training_read_permissions_to_fighter.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
