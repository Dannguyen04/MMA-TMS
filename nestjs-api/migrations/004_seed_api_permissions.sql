-- MMA-TMS 004: register concrete permissions used by completed HTTP modules.
-- Catalogue only: role and per-user grants remain explicit operator decisions.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 4);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.user_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '004 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 3
  ) THEN
    RAISE EXCEPTION '004 requires migration 003 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 4
  ) THEN
    RAISE EXCEPTION '004 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1
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
  ) THEN
    RAISE EXCEPTION '004 API permission catalogue collision';
  END IF;
END
$preflight$;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('users.create', 'Create users', 'users', 'create',
   'Create an application user and the matching role profile.'),
  ('users.read', 'Read users', 'users', 'read',
   'Read an application user and role profile by identifier.'),
  ('users.profile.read', 'Read own user profile', 'user_profiles', 'read',
   'Read the authenticated user and their own role profile.'),
  ('users.update', 'Update users', 'users', 'update',
   'Update an application user role profile.'),
  ('users.delete', 'Delete users', 'users', 'delete',
   'Soft-delete an application user and role profile.'),
  ('fighter:get_all', 'List all fighters', 'fighter', 'read',
   'List all fighters'),
  ('fighter:read', 'Read a specific fighter profile', 'fighter', 'read',
   'Read a specific fighter profile'),
  ('fighter:create', 'Create a fighter profile', 'fighter', 'create',
   'Create a fighter profile'),
  ('fighter:update', 'Update a fighter profile', 'fighter', 'update',
   'Update a fighter profile'),
  ('fighter:delete', 'Delete a fighter profile', 'fighter', 'delete',
   'Delete a fighter profile'),
  ('fighter.measurement:read', 'Read fighter measurements', 'fighter_measurement', 'read',
   'Read append-only fighter measurement history within the actor resource scope.'),
  ('fighter.measurement:write', 'Write fighter measurements', 'fighter_measurement', 'write',
   'Record or supersede fighter measurements within the actor resource scope.'),
  ('fighter.coach:read', 'Read fighter coach assignments', 'fighter_coach_assignment', 'read',
   'Read current and historical coach assignments within the actor resource scope.'),
  ('fighter.coach:assign', 'Assign fighter coaches', 'fighter_coach_assignment', 'assign',
   'Create a temporal coach assignment for a fighter.'),
  ('fighter.coach:end', 'End fighter coach assignments', 'fighter_coach_assignment', 'end',
   'End an active temporal coach assignment for a fighter.'),
  ('fighter.session:read', 'Read fighter training sessions', 'fighter_training_session', 'read',
   'Read fighter training history within the actor resource scope.'),
  ('fighter.medical:read', 'Read fighter medical summaries', 'fighter_medical_summary', 'read',
   'Read fighter medical summaries within the approved medical access scope.');

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  4,
  '004_seed_api_permissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
