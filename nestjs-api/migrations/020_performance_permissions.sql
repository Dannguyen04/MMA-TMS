-- MMA-TMS 020: cấp quyền đọc tổng hợp hiệu suất theo phạm vi võ sĩ.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260922, 20);

DO $preflight$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '020 requires migration 003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 19) THEN
    RAISE EXCEPTION '020 requires migration 019 history';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '020 has already been applied';
  END IF;
  IF EXISTS (SELECT 1 FROM public.permissions WHERE code = 'performance:read') THEN
    RAISE EXCEPTION '020 performance permission collision';
  END IF;
END
$preflight$;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES ('performance:read', 'Read performance aggregates', 'performance', 'read',
        'Read persisted performance aggregates within the actor fighter-assignment scope.');

INSERT INTO public.role_permissions(role, permission_id)
SELECT role, permission.id
FROM unnest(enum_range(NULL::public.user_role)) AS roles(role)
CROSS JOIN public.permissions AS permission
WHERE permission.code = 'performance:read';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  20,
  '020_performance_permissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
