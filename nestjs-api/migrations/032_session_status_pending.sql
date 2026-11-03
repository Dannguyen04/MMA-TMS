-- =============================================================================
-- Migration 032: Add PENDING value to session_status enum (T-036 / R28)
-- =============================================================================
-- Why:
--   Rule R28 puts scheduled training sessions blocked by a fixed-duration
--   suspension (requires_clearance = false) into PENDING until the coach
--   reschedules or cancels them.
--
-- Preflight & safety:
--   1. Acquires transaction-scoped advisory lock (20260916, 32).
--   2. Requires mma_private.migration_history (003) and migration 024 in the
--      ledger, plus public.session_status (001). Does NOT require 025..031 so
--      parallel branches after 024 can apply 032 independently.
--   3. Rejects re-application if version 32 is already recorded.
--   4. Does not reference the newly added 'PENDING' enum literal in the same
--      transaction (PostgreSQL enum safety).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

SELECT pg_catalog.pg_advisory_xact_lock(20260916, 32);

DO $preflight$
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '032 requires mma_private.migration_history from migration 003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 32
  ) THEN
    RAISE EXCEPTION '032 already applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 24
  ) THEN
    RAISE EXCEPTION '032 requires migration 024';
  END IF;

  IF to_regtype('public.session_status') IS NULL THEN
    RAISE EXCEPTION '032 requires schema objects';
  END IF;
END
$preflight$;

ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'PENDING';

INSERT INTO mma_private.migration_history (version, name, source_sha256)
VALUES (
  32,
  '032_session_status_pending.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
