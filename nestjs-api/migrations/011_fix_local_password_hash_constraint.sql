-- MMA-TMS 011: sửa biểu thức kiểm tra định dạng scrypt của credential local.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 11);

DO $preflight$
BEGIN
  IF to_regclass('public.local_auth_credentials') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '011 requires migration 010';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 10
  ) THEN
    RAISE EXCEPTION '011 requires migration 010 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 11
  ) THEN
    RAISE EXCEPTION '011 has already been applied';
  END IF;
END
$preflight$;

ALTER TABLE public.local_auth_credentials
  DROP CONSTRAINT ck_local_password_hash_format;

ALTER TABLE public.local_auth_credentials
  ADD CONSTRAINT ck_local_password_hash_format CHECK (
    password_hash ~ $regex$^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{22}\$[A-Za-z0-9_-]{86}$$regex$
  );

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  11,
  '011_fix_local_password_hash_constraint.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
