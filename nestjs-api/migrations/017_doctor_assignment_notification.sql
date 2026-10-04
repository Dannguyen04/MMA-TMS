-- MMA-TMS 017: notification type for the "assign a Doctor" task.
-- Sent after commit to Admins with effective `fighter.doctor:assign` when a new
-- Fighter (admission activation or Admin creation) has no effective Doctor
-- assignment, so the baseline examination required before training can start.
-- Only adds one notification_type value; no table, RLS or grant changes.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-016.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 17);

DO $preflight$
BEGIN
  IF to_regtype('public.notification_type') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '017 requires the migration 003 notification objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 15) THEN
    RAISE EXCEPTION '017 requires migration 015 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 17) THEN
    RAISE EXCEPTION '017 has already been applied';
  END IF;
END
$preflight$;

-- Only added, never used as a literal in this transaction.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  17,
  '017_doctor_assignment_notification.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
