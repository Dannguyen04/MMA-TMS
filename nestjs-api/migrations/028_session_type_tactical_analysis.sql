-- MMA-TMS 028: session type for tactical analysis (video study, no physical load).
-- Adds one session_type value; no table, RLS or grant changes. The value is
-- never used as a literal in this transaction (PostgreSQL rule for new enum
-- values), so the session template seed lives in 029.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-023.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 28);

DO $preflight$
BEGIN
  IF to_regtype('public.session_type') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '028 requires the migration 003 session_type enum';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 23) THEN
    RAISE EXCEPTION '028 requires migration 023 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 28) THEN
    RAISE EXCEPTION '028 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'session_type' AND e.enumlabel = 'TACTICAL_ANALYSIS'
  ) THEN
    RAISE EXCEPTION '028 session_type value collision';
  END IF;
END
$preflight$;

-- Only added, never used as a literal in this transaction.
ALTER TYPE public.session_type ADD VALUE 'TACTICAL_ANALYSIS';

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  28,
  '028_session_type_tactical_analysis.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
