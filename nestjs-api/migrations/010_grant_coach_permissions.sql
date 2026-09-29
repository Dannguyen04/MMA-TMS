-- MMA-TMS 010: grant the COACH role the existing concrete permissions needed
-- to operate the non-AI Coach Platform scope (assigned-Fighter roster and
-- read access, Training Plan/Session/Exercise management). No new permission
-- codes are introduced; every code below already exists from migration 004
-- or 006. Resource-level assignment scoping (coach_fighters currently
-- effective) is enforced in application code, not by this grant.
-- Medical permissions are intentionally absent: medical is a future feature.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 10);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '010 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 9
  ) THEN
    RAISE EXCEPTION '010 requires migration 009 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 10
  ) THEN
    RAISE EXCEPTION '010 has already been applied';
  END IF;

  IF (
    SELECT count(*)
    FROM public.permissions
    WHERE code = ANY (ARRAY[
      'fighter:get_all',
      'fighter:read',
      'fighter.measurement:read',
      'fighter.coach:read',
      'fighter.session:read',
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
      'training.exercise:read'
    ])
  ) <> 21 THEN
    RAISE EXCEPTION '010 requires the migration 004/006 permission catalogue';
  END IF;
END
$preflight$;

-- Idempotent: an operator may already have granted some of these rows manually.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'COACH'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
  'fighter:get_all',
  'fighter:read',
  'fighter.measurement:read',
  'fighter.coach:read',
  'fighter.session:read',
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
  'training.exercise:read'
])
ON CONFLICT (role, permission_id) DO NOTHING;

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  10,
  '010_grant_coach_permissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
