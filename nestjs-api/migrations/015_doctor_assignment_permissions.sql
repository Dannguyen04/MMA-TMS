-- MMA-TMS 015: bổ sung quyền riêng cho vòng đời phân công bác sĩ và võ sĩ.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 15);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.doctor_fighters') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '015 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 14
  ) THEN
    RAISE EXCEPTION '015 requires migration 014 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 15
  ) THEN
    RAISE EXCEPTION '015 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = ANY (ARRAY[
      'fighter.doctor:read',
      'fighter.doctor:assign',
      'fighter.doctor:end'
    ])
  ) THEN
    RAISE EXCEPTION '015 doctor assignment permission collision';
  END IF;
END
$preflight$;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('fighter.doctor:read', 'Read fighter doctor assignments', 'fighter_doctor', 'read',
   'Read doctor assignment history within the actor fighter scope.'),
  ('fighter.doctor:assign', 'Assign fighter doctor', 'fighter_doctor', 'assign',
   'Create an active doctor assignment for a fighter.'),
  ('fighter.doctor:end', 'End fighter doctor assignment', 'fighter_doctor', 'end',
   'End an active doctor assignment for a fighter.');

WITH baseline(role, code) AS (
  VALUES
    ('FIGHTER'::public.user_role, 'fighter.doctor:read'),
    ('COACH'::public.user_role, 'fighter.doctor:read'),
    ('DOCTOR'::public.user_role, 'fighter.doctor:read'),
    ('ADMIN'::public.user_role, 'fighter.doctor:read'),
    ('ADMIN'::public.user_role, 'fighter.doctor:assign'),
    ('ADMIN'::public.user_role, 'fighter.doctor:end')
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT baseline.role, permission.id
FROM baseline
JOIN public.permissions AS permission ON permission.code = baseline.code;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  15,
  '015_doctor_assignment_permissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
