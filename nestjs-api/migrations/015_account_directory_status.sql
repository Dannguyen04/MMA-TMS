-- MMA-TMS 015: bổ sung trạng thái và trường hiển thị cho danh bạ tài khoản.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 15);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
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
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name IN ('account_status', 'phone', 'title', 'last_active_at')
  ) THEN
    RAISE EXCEPTION '015 users account directory column collision';
  END IF;
END
$preflight$;

ALTER TABLE public.users
  ADD COLUMN account_status TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN phone TEXT,
  ADD COLUMN title TEXT NOT NULL DEFAULT '',
  ADD COLUMN last_active_at TIMESTAMPTZ,
  ADD CONSTRAINT ck_users_account_status
    CHECK (account_status IN ('ACTIVE', 'INVITED', 'SUSPENDED')),
  ADD CONSTRAINT ck_users_phone
    CHECK (phone IS NULL OR (phone = btrim(phone) AND length(phone) BETWEEN 3 AND 30)),
  ADD CONSTRAINT ck_users_title
    CHECK (title = btrim(title) AND length(title) <= 150);

UPDATE public.users
SET title = CASE role
  WHEN 'FIGHTER' THEN 'Fighter'
  WHEN 'COACH' THEN 'Coach'
  WHEN 'DOCTOR' THEN 'Sports Doctor'
  WHEN 'ADMIN' THEN 'Administrator'
END;

CREATE INDEX idx_users_directory
  ON public.users(account_status, role, id)
  WHERE deleted_at IS NULL AND is_active = true;

COMMENT ON COLUMN public.users.account_status IS
  'Trạng thái truy cập tài khoản tách biệt với cờ xóa mềm.';
COMMENT ON COLUMN public.users.last_active_at IS
  'Thời điểm hoạt động xác thực gần nhất của tài khoản.';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  15,
  '015_account_directory_status.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
