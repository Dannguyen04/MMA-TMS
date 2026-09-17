-- MMA-TMS 006: register Training permissions and grant them to ADMIN.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 6);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.user_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '006 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 5
  ) THEN
    RAISE EXCEPTION '006 requires migration 005 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 6
  ) THEN
    RAISE EXCEPTION '006 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.permissions
    WHERE code = ANY (ARRAY[
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
      'training.exercise:update'
    ])
  ) THEN
    RAISE EXCEPTION '006 API permission catalogue collision';
  END IF;
END
$preflight$;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('training.plan:get_all', 'List training plans', 'training_plan', 'get_all',
   'List training plans within the actor resource scope.'),
  ('training.plan:read', 'Read training plan', 'training_plan', 'read',
   'Read one training plan within the actor resource scope.'),
  ('training.plan:create', 'Create training plan', 'training_plan', 'create',
   'Create a training plan within the actor resource scope.'),
  ('training.plan:update', 'Update training plan', 'training_plan', 'update',
   'Update a training plan within the actor resource scope.'),
  ('training.plan:transition', 'Transition training plan', 'training_plan', 'transition',
   'Change a training plan lifecycle status within the actor resource scope.'),
  ('training.plan_exercise:read', 'Read training plan exercises', 'training_plan_exercise', 'read',
   'Read exercise configurations for a training plan within the actor resource scope.'),
  ('training.plan_exercise:create', 'Create training plan exercise', 'training_plan_exercise', 'create',
   'Add an exercise configuration to a training plan within the actor resource scope.'),
  ('training.plan_exercise:update', 'Update training plan exercise', 'training_plan_exercise', 'update',
   'Update an exercise configuration within the actor resource scope.'),
  ('training.plan_exercise:delete', 'Delete training plan exercise', 'training_plan_exercise', 'delete',
   'Remove an exercise configuration from a training plan within the actor resource scope.'),
  ('training.session:get_all', 'List training sessions', 'training_session', 'get_all',
   'List training sessions within the actor resource scope.'),
  ('training.session:read', 'Read training session', 'training_session', 'read',
   'Read one training session within the actor resource scope.'),
  ('training.session:create', 'Create training session', 'training_session', 'create',
   'Create a training session within the actor resource scope.'),
  ('training.session:update', 'Update training session', 'training_session', 'update',
   'Update a training session within the actor resource scope.'),
  ('training.session:transition', 'Transition training session', 'training_session', 'transition',
   'Change a training session lifecycle status within the actor resource scope.'),
  ('training.exercise:get_all', 'List exercises', 'training_exercise', 'get_all',
   'List exercises in the global training library.'),
  ('training.exercise:read', 'Read exercise', 'training_exercise', 'read',
   'Read one exercise in the global training library.'),
  ('training.exercise:create', 'Create exercise', 'training_exercise', 'create',
   'Create an exercise in the global training library.'),
  ('training.exercise:update', 'Update exercise', 'training_exercise', 'update',
   'Update an exercise in the global training library.');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'ADMIN'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
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
  'training.exercise:update'
]);

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  6,
  '006_training_permissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
