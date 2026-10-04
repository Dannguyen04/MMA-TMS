-- MMA-TMS 015: notification inbox delivery support.
-- One recipient = one row in the existing public.notifications table. This adds
-- a per-recipient dedupe identity so a retried or concurrent delivery job can
-- never create a second row for the same event, the list index used by the
-- inbox API, and the notification types of the approved Admission (A1-A6) and
-- Training (T1-T4) triggers.
-- Existing rows keep dedupe_key = NULL and stay readable; no value is renamed
-- or dropped, RLS/grants of 003 are untouched (backend-only table).
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-014.
-- Ledger version 15 (was 14 before the rename from 014_notifications_delivery.sql,
-- which collided with 014_video_ai_vertical_slice.sql).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 15);

DO $preflight$
BEGIN
  IF to_regclass('public.notifications') IS NULL
     OR to_regtype('public.notification_type') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '015 requires the migration 003 notification objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 13) THEN
    RAISE EXCEPTION '015 requires migration 013 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 15) THEN
    RAISE EXCEPTION '015 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications'
      AND column_name = 'dedupe_key'
  ) OR to_regclass('public.uq_notifications_user_dedupe') IS NOT NULL
    OR to_regclass('public.idx_notifications_user_created') IS NOT NULL THEN
    RAISE EXCEPTION '015 notification delivery collision';
  END IF;
END
$preflight$;

-- New enum values are only added, never used as literals in this transaction
-- (PostgreSQL forbids using a value added in the same transaction).
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_APPLICATION_SUBMITTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_ASSESSMENT_ASSIGNED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_ASSESSMENT_UNASSIGNED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_DECISION_REQUIRED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_ASSESSMENT_RESULT';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_DECISION_RECORDED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ADMISSION_ACTIVATION_COMPLETED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'COACH_ASSIGNMENT_STARTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'COACH_ASSIGNMENT_ENDED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TRAINING_PLAN_ACTIVATED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TRAINING_SESSION_SCHEDULED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TRAINING_SESSION_RESCHEDULED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'TRAINING_SESSION_CANCELLED';

-- Nullable for compatibility with rows written before 015. New rows written by
-- the notification service always carry the stable identity of one event.
ALTER TABLE public.notifications
    ADD COLUMN dedupe_key TEXT,
    ADD CONSTRAINT ck_notification_dedupe_key CHECK (
        dedupe_key IS NULL OR (length(dedupe_key) BETWEEN 1 AND 300)
    );

-- Last line of defence against duplicate delivery on retry/race: the worker
-- inserts with ON CONFLICT DO NOTHING on this index and re-reads the row, so a
-- conflict never resets is_read/read_at or overwrites content.
CREATE UNIQUE INDEX uq_notifications_user_dedupe
    ON public.notifications (user_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

-- Inbox list order (created_at DESC, id DESC). The unread partial index of 003
-- keeps serving the unread filter and the unread count.
CREATE INDEX idx_notifications_user_created
    ON public.notifications (user_id, created_at DESC, id DESC);

COMMENT ON COLUMN public.notifications.dedupe_key IS
  'Server-owned identity of the business event, namespaced by notification type. Unique per recipient when present; NULL only for rows written before 015.';

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  15,
  '015_notifications_delivery.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
