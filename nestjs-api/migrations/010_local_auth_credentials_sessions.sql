-- MMA-TMS 010: lưu credential và session cho adapter xác thực local.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 10);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
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

  IF to_regclass('public.local_auth_credentials') IS NOT NULL
     OR to_regclass('public.local_auth_sessions') IS NOT NULL THEN
    RAISE EXCEPTION '010 local auth table collision';
  END IF;
END
$preflight$;

CREATE TABLE public.local_auth_credentials (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_local_password_hash_format CHECK (
    password_hash ~ '^scrypt\\$16384\\$8\\$1\\$[A-Za-z0-9_-]{22}\\$[A-Za-z0-9_-]{86}$'
  )
);

CREATE TABLE public.local_auth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  access_token_hash TEXT NOT NULL UNIQUE,
  refresh_token_hash TEXT NOT NULL UNIQUE,
  access_expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  replaced_by_session_id UUID REFERENCES public.local_auth_sessions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_local_access_hash CHECK (access_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_local_refresh_hash CHECK (refresh_token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_local_session_expiry CHECK (
    access_expires_at > created_at AND refresh_expires_at > access_expires_at
  ),
  CONSTRAINT ck_local_session_rotation CHECK (
    replaced_by_session_id IS NULL OR revoked_at IS NOT NULL
  )
);

CREATE INDEX idx_local_sessions_user_active
  ON public.local_auth_sessions(user_id, refresh_expires_at DESC)
  WHERE revoked_at IS NULL;

ALTER TABLE public.local_auth_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_auth_credentials FORCE ROW LEVEL SECURITY;
ALTER TABLE public.local_auth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.local_auth_sessions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.local_auth_credentials FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.local_auth_sessions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.local_auth_credentials IS
  'Credential local; password chỉ được lưu dưới dạng scrypt đã thêm salt.';
COMMENT ON TABLE public.local_auth_sessions IS
  'Session local; chỉ lưu hash của access token và refresh token.';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  10,
  '010_local_auth_credentials_sessions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
