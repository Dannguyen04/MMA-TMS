-- MMA-TMS 014: lưu lời mời tài khoản riêng tư và sự kiện outbox tương ứng.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 14);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.auth_outbox') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '014 requires migrations 003 and 012';
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

  IF to_regclass('public.user_invitation_requests') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'display_name'
     ) THEN
    RAISE EXCEPTION '014 invitation state collision';
  END IF;
END
$preflight$;

ALTER TABLE public.users
  ADD COLUMN display_name TEXT NOT NULL DEFAULT '',
  ADD CONSTRAINT ck_users_display_name
    CHECK (display_name = btrim(display_name) AND length(display_name) <= 200);

UPDATE public.users u
SET display_name = COALESCE(
  CASE u.role
    WHEN 'FIGHTER' THEN (
      SELECT concat_ws(' ', f.first_name, f.last_name)
      FROM public.fighters f WHERE f.user_id = u.id
    )
    WHEN 'COACH' THEN (
      SELECT concat_ws(' ', c.first_name, c.last_name)
      FROM public.coaches c WHERE c.user_id = u.id
    )
    WHEN 'DOCTOR' THEN (
      SELECT concat_ws(' ', d.first_name, d.last_name)
      FROM public.sports_doctors d WHERE d.user_id = u.id
    )
  END,
  split_part(u.email, '@', 1)
);

CREATE TABLE public.user_invitation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_user_invitation_hash CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ck_user_invitation_expiry CHECK (expires_at > created_at),
  CONSTRAINT ck_user_invitation_consumed CHECK (
    consumed_at IS NULL OR consumed_at >= created_at
  )
);

CREATE INDEX idx_user_invitation_user_created
  ON public.user_invitation_requests(user_id, created_at DESC);

ALTER TABLE public.auth_outbox DROP CONSTRAINT ck_auth_outbox_event;
ALTER TABLE public.auth_outbox ADD CONSTRAINT ck_auth_outbox_event
  CHECK (event_type IN ('PASSWORD_RESET_REQUESTED', 'USER_INVITED'));

ALTER TABLE public.user_invitation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitation_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_invitation_requests FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.user_invitation_requests IS
  'Lời mời tài khoản chỉ lưu hash token; gửi email được tách qua auth_outbox.';
COMMENT ON COLUMN public.users.display_name IS
  'Tên hiển thị dùng được trước khi hồ sơ theo vai trò được hoàn tất.';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  14,
  '014_user_invitations.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
