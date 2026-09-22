-- MMA-TMS 009: thiết lập quyền nền tảng theo vai trò cho các API hiện có.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260920, 9);

DO $preflight$
DECLARE
  missing_codes TEXT[];
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '009 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 8
  ) THEN
    RAISE EXCEPTION '009 requires migration 008 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 9
  ) THEN
    RAISE EXCEPTION '009 has already been applied';
  END IF;

  SELECT array_agg(required.code ORDER BY required.code)
  INTO missing_codes
  FROM (
    SELECT unnest(ARRAY[
      'users.create',
      'users.read',
      'users.profile.read',
      'users.update',
      'users.delete',
      'fighter:get_all',
      'fighter:read',
      'fighter:update',
      'fighter.measurement:read',
      'fighter.measurement:write',
      'fighter.coach:read',
      'fighter.coach:assign',
      'fighter.coach:end',
      'fighter.session:read',
      'fighter.medical:read',
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
    ]::TEXT[]) AS code
  ) AS required
  LEFT JOIN public.permissions AS permission ON permission.code = required.code
  WHERE permission.id IS NULL;

  IF missing_codes IS NOT NULL THEN
    RAISE EXCEPTION '009 missing required permission catalogue entries: %', missing_codes;
  END IF;
END
$preflight$;

-- Fighter chỉ nhận quyền đọc và cập nhật tài nguyên của chính mình đã được service giới hạn scope.
WITH baseline(role, code) AS (
  VALUES
    ('FIGHTER'::public.user_role, 'users.profile.read'),
    ('FIGHTER'::public.user_role, 'fighter:get_all'),
    ('FIGHTER'::public.user_role, 'fighter:read'),
    ('FIGHTER'::public.user_role, 'fighter:update'),
    ('FIGHTER'::public.user_role, 'fighter.measurement:read'),
    ('FIGHTER'::public.user_role, 'fighter.measurement:write'),
    ('FIGHTER'::public.user_role, 'fighter.coach:read'),
    ('FIGHTER'::public.user_role, 'fighter.session:read'),
    ('FIGHTER'::public.user_role, 'fighter.medical:read'),
    ('FIGHTER'::public.user_role, 'training.plan:get_all'),
    ('FIGHTER'::public.user_role, 'training.plan:read'),
    ('FIGHTER'::public.user_role, 'training.plan_exercise:read'),
    ('FIGHTER'::public.user_role, 'training.session:get_all'),
    ('FIGHTER'::public.user_role, 'training.session:read'),
    ('FIGHTER'::public.user_role, 'training.session:update'),
    ('FIGHTER'::public.user_role, 'training.session:transition'),
    ('FIGHTER'::public.user_role, 'training.exercise:get_all'),
    ('FIGHTER'::public.user_role, 'training.exercise:read'),

    -- Coach chỉ nhận các thao tác training có kiểm tra assignment ở service.
    ('COACH'::public.user_role, 'users.profile.read'),
    ('COACH'::public.user_role, 'training.plan:get_all'),
    ('COACH'::public.user_role, 'training.plan:read'),
    ('COACH'::public.user_role, 'training.plan:create'),
    ('COACH'::public.user_role, 'training.plan:update'),
    ('COACH'::public.user_role, 'training.plan:transition'),
    ('COACH'::public.user_role, 'training.plan_exercise:read'),
    ('COACH'::public.user_role, 'training.plan_exercise:create'),
    ('COACH'::public.user_role, 'training.plan_exercise:update'),
    ('COACH'::public.user_role, 'training.plan_exercise:delete'),
    ('COACH'::public.user_role, 'training.session:get_all'),
    ('COACH'::public.user_role, 'training.session:read'),
    ('COACH'::public.user_role, 'training.session:create'),
    ('COACH'::public.user_role, 'training.session:update'),
    ('COACH'::public.user_role, 'training.session:transition'),
    ('COACH'::public.user_role, 'training.exercise:get_all'),
    ('COACH'::public.user_role, 'training.exercise:read'),
    ('COACH'::public.user_role, 'training.exercise:create'),
    ('COACH'::public.user_role, 'training.exercise:update'),

    -- Doctor chỉ nhận các quyền đọc training đã kiểm tra assignment.
    ('DOCTOR'::public.user_role, 'users.profile.read'),
    ('DOCTOR'::public.user_role, 'training.plan:get_all'),
    ('DOCTOR'::public.user_role, 'training.plan:read'),
    ('DOCTOR'::public.user_role, 'training.plan_exercise:read'),
    ('DOCTOR'::public.user_role, 'training.session:get_all'),
    ('DOCTOR'::public.user_role, 'training.session:read'),
    ('DOCTOR'::public.user_role, 'training.exercise:get_all'),
    ('DOCTOR'::public.user_role, 'training.exercise:read'),

    -- Admin nhận thao tác nền tảng hiện có nhưng không nhận quyền dữ liệu clinical.
    ('ADMIN'::public.user_role, 'users.create'),
    ('ADMIN'::public.user_role, 'users.read'),
    ('ADMIN'::public.user_role, 'users.profile.read'),
    ('ADMIN'::public.user_role, 'users.update'),
    ('ADMIN'::public.user_role, 'users.delete'),
    ('ADMIN'::public.user_role, 'fighter:get_all'),
    ('ADMIN'::public.user_role, 'fighter:read'),
    ('ADMIN'::public.user_role, 'fighter:update'),
    ('ADMIN'::public.user_role, 'fighter.coach:read'),
    ('ADMIN'::public.user_role, 'fighter.coach:assign'),
    ('ADMIN'::public.user_role, 'fighter.coach:end'),
    ('ADMIN'::public.user_role, 'fighter.session:read'),
    ('ADMIN'::public.user_role, 'training.plan:get_all'),
    ('ADMIN'::public.user_role, 'training.plan:read'),
    ('ADMIN'::public.user_role, 'training.plan:create'),
    ('ADMIN'::public.user_role, 'training.plan:update'),
    ('ADMIN'::public.user_role, 'training.plan:transition'),
    ('ADMIN'::public.user_role, 'training.plan_exercise:read'),
    ('ADMIN'::public.user_role, 'training.plan_exercise:create'),
    ('ADMIN'::public.user_role, 'training.plan_exercise:update'),
    ('ADMIN'::public.user_role, 'training.plan_exercise:delete'),
    ('ADMIN'::public.user_role, 'training.session:get_all'),
    ('ADMIN'::public.user_role, 'training.session:read'),
    ('ADMIN'::public.user_role, 'training.session:create'),
    ('ADMIN'::public.user_role, 'training.session:update'),
    ('ADMIN'::public.user_role, 'training.session:transition'),
    ('ADMIN'::public.user_role, 'training.exercise:get_all'),
    ('ADMIN'::public.user_role, 'training.exercise:read'),
    ('ADMIN'::public.user_role, 'training.exercise:create'),
    ('ADMIN'::public.user_role, 'training.exercise:update')
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT baseline.role, permission.id
FROM baseline
JOIN public.permissions AS permission ON permission.code = baseline.code
ON CONFLICT (role, permission_id) DO NOTHING;

-- Runner đã xác minh sẽ cung cấp checksum nguồn; chạy tay trong SQL Editor sẽ lưu NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  9,
  '009_role_permission_baseline.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
