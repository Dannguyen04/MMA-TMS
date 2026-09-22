-- MMA-TMS 021: hoàn thiện hồ sơ danh bạ huấn luyện viên và bác sĩ.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260922, 21);

DO $preflight$
BEGIN
  IF to_regclass('public.coaches') IS NULL
     OR to_regclass('public.sports_doctors') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '021 requires migration 003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '021 requires migration 020 history';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 21) THEN
    RAISE EXCEPTION '021 has already been applied';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'coaches'
      AND column_name IN ('certifications', 'years_experience')
  ) THEN
    RAISE EXCEPTION '021 coach directory field collision';
  END IF;
END
$preflight$;

ALTER TABLE public.coaches
  ADD COLUMN certifications TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN years_experience INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT ck_coaches_years_experience CHECK (years_experience BETWEEN 0 AND 100);

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('staff.coach:get_all', 'List coaches', 'coach', 'get_all', 'List active coach directory profiles.'),
  ('staff.coach:read', 'Read coach', 'coach', 'read', 'Read an active coach directory profile.'),
  ('staff.doctor:get_all', 'List doctors', 'sports_doctor', 'get_all', 'List active sports-doctor directory profiles.'),
  ('staff.doctor:read', 'Read doctor', 'sports_doctor', 'read', 'Read an active sports-doctor directory profile.');

WITH baseline(role, code) AS (
  SELECT role, code
  FROM unnest(enum_range(NULL::public.user_role)) AS roles(role)
  CROSS JOIN unnest(ARRAY[
    'staff.coach:get_all',
    'staff.coach:read',
    'staff.doctor:get_all',
    'staff.doctor:read'
  ]::TEXT[]) AS codes(code)
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT baseline.role, permission.id
FROM baseline
JOIN public.permissions AS permission ON permission.code = baseline.code;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  21,
  '021_staff_directory.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
