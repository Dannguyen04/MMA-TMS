-- MMA-TMS 012: server-owned issuance order for medical clearances.
-- created_at defaults to now(), the transaction start time. Clearance issue
-- commands are serialized per Fighter by an advisory lock, so a transaction
-- that started earlier can commit later with a smaller created_at. Eligibility
-- must pick the governing clearance by issuance order, so this adds an identity
-- column assigned at insert time (after the lock is held).
-- Clinical scope only: no AI table, policy, grant or function is touched.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-011.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 12);

DO $preflight$
BEGIN
  IF to_regclass('public.medical_clearances') IS NULL
     OR to_regclass('public.medical_examinations') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '012 requires the migration 011 clinical objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 11) THEN
    RAISE EXCEPTION '012 requires migration 011 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 12) THEN
    RAISE EXCEPTION '012 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'medical_clearances'
      AND column_name = 'issue_sequence'
  ) OR to_regclass('public.idx_clearance_examination_issue') IS NOT NULL THEN
    RAISE EXCEPTION '012 clearance issue order collision';
  END IF;

  -- Serialize the data preflight with application writes, not just other
  -- migrations. Acquire the ALTER TABLE lock before reading the rows so an
  -- in-flight issuer must commit/roll back before the check takes its snapshot.
  -- Hold it through COMMIT: no clearance can appear between check and rewrite.
  LOCK TABLE public.medical_clearances IN ACCESS EXCLUSIVE MODE;

  -- Existing rows receive identity values in storage order. That is harmless
  -- for pre-011 legacy clearances (never used for eligibility), but the true
  -- issuance order of examination-linked clearances cannot be reconstructed.
  -- Fail closed and let an operator decide instead of guessing.
  IF EXISTS (SELECT 1 FROM public.medical_clearances WHERE examination_id IS NOT NULL) THEN
    RAISE EXCEPTION '012 must run before examination-linked clearances exist; their issuance order cannot be reconstructed';
  END IF;
END
$preflight$;

-- ADD COLUMN rewrites the table without firing row triggers, so no clinical
-- revision or audit row is produced and no clearance term changes.
ALTER TABLE public.medical_clearances
    ADD COLUMN issue_sequence BIGINT GENERATED ALWAYS AS IDENTITY,
    ADD CONSTRAINT uq_medical_clearance_issue_sequence UNIQUE (issue_sequence);

CREATE INDEX idx_clearance_examination_issue
    ON public.medical_clearances (examination_id, issue_sequence DESC)
    WHERE examination_id IS NOT NULL;

COMMENT ON COLUMN public.medical_clearances.issue_sequence IS
  'Server-owned issuance order. The highest value among clearances of the current examination is the governing clearance, whatever its status.';

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  12,
  '012_medical_clearance_issue_order.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
