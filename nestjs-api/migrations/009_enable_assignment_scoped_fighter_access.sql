-- MMA-TMS 009: mở quyền Fighter API sau khi service đã giới hạn theo assignment.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 9);

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
      'fighter:get_all',
      'fighter:read',
      'fighter.measurement:read',
      'fighter.measurement:write',
      'fighter.coach:read',
      'fighter.session:read',
      'fighter.medical:read'
    ]::TEXT[]) AS code
  ) AS required
  LEFT JOIN public.permissions AS permission ON permission.code = required.code
  WHERE permission.id IS NULL;

  IF missing_codes IS NOT NULL THEN
    RAISE EXCEPTION '009 missing required permission catalogue entries: %', missing_codes;
  END IF;
END
$preflight$;

-- Coach chỉ đọc fighter đang được phân công; medical summary được service loại bỏ ghi chú lâm sàng tự do.
WITH baseline(role, code) AS (
  VALUES
    ('COACH'::public.user_role, 'fighter:get_all'),
    ('COACH'::public.user_role, 'fighter:read'),
    ('COACH'::public.user_role, 'fighter.coach:read'),
    ('COACH'::public.user_role, 'fighter.session:read'),
    ('COACH'::public.user_role, 'fighter.medical:read'),

    -- Doctor chỉ đọc/cập nhật dữ liệu của fighter đang được phân công.
    ('DOCTOR'::public.user_role, 'fighter:get_all'),
    ('DOCTOR'::public.user_role, 'fighter:read'),
    ('DOCTOR'::public.user_role, 'fighter.measurement:read'),
    ('DOCTOR'::public.user_role, 'fighter.measurement:write'),
    ('DOCTOR'::public.user_role, 'fighter.session:read'),
    ('DOCTOR'::public.user_role, 'fighter.medical:read')
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT baseline.role, permission.id
FROM baseline
JOIN public.permissions AS permission ON permission.code = baseline.code
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  9,
  '009_enable_assignment_scoped_fighter_access.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
