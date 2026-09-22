-- MMA-TMS 014: lưu yêu cầu đặt lại mật khẩu và outbox giao tiếp ngoài hệ thống.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 14);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '014 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 13
  ) THEN
    RAISE EXCEPTION '014 requires migration 013 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 14
  ) THEN
    RAISE EXCEPTION '014 has already been applied';
  END IF;

  IF to_regclass('public.password_reset_requests') IS NOT NULL
     OR to_regclass('public.auth_outbox') IS NOT NULL THEN
    RAISE EXCEPTION '014 auth outbox table collision';
  END IF;
END
$preflight$;

CREATE TABLE public.password_reset_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_password_reset_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_password_reset_expiry CHECK (expires_at > created_at),
  CONSTRAINT ck_password_reset_consumed CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);

CREATE TABLE public.auth_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_auth_outbox_event CHECK (event_type IN ('PASSWORD_RESET_REQUESTED')),
  CONSTRAINT ck_auth_outbox_status CHECK (status IN ('PENDING', 'PROCESSING', 'SENT', 'FAILED')),
  CONSTRAINT ck_auth_outbox_attempts CHECK (attempts >= 0),
  CONSTRAINT ck_auth_outbox_payload CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT ck_auth_outbox_processed CHECK (
    (status = 'SENT') = (processed_at IS NOT NULL)
  )
);

CREATE INDEX idx_password_reset_user_created
  ON public.password_reset_requests(user_id, created_at DESC);
CREATE INDEX idx_auth_outbox_pending
  ON public.auth_outbox(available_at, created_at)
  WHERE status IN ('PENDING', 'FAILED');

ALTER TABLE public.password_reset_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE public.auth_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_outbox FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.password_reset_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.auth_outbox FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.password_reset_requests IS
  'Yêu cầu đặt lại mật khẩu; chỉ lưu hash token, không lưu token gốc.';
COMMENT ON TABLE public.auth_outbox IS
  'Outbox bền vững cho giao tiếp auth; không chứa mật khẩu hoặc token gốc.';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  14,
  '014_password_reset_outbox.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
