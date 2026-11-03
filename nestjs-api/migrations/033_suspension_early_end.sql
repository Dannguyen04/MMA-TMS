-- =============================================================================
-- Migration 033: Suspension issuer and early end with basis (T-050)
-- =============================================================================
-- Why:
--   A MEDICAL suspension may be issued by the club or by a competition
--   organizer, and may end early only with a basis: a TRAINING examination by
--   the assigned Doctor (club) or the organizer's lift document (organizer).
--
-- Preflight & safety:
--   1. Acquires transaction-scoped advisory lock (20260916, 33).
--   2. Requires mma_private.migration_history, migrations 011 and 025,
--      public.suspensions and uq_medical_examination_fighter. Does NOT require
--      026..032.
--   3. Rejects re-application if version 33 is already recorded.
--   4. Existing rows get issued_by = 'CLUB' and NULL for the other columns.
--      No permission, trigger, table or notification type is added.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

SELECT pg_catalog.pg_advisory_xact_lock(20260916, 33);

DO $preflight$
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '033 requires mma_private.migration_history from migration 003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 33
  ) THEN
    RAISE EXCEPTION '033 already applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 25
  ) THEN
    RAISE EXCEPTION '033 requires migration 025';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 11
  ) THEN
    RAISE EXCEPTION '033 requires migration 011';
  END IF;

  IF to_regclass('public.suspensions') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conname = 'uq_medical_examination_fighter'
          AND conrelid = 'public.medical_examinations'::regclass
     ) THEN
    RAISE EXCEPTION '033 requires schema objects';
  END IF;
END
$preflight$;

CREATE TYPE public.suspension_issuer AS ENUM ('CLUB', 'ORGANIZER');

ALTER TABLE public.suspensions
  ADD COLUMN issued_by public.suspension_issuer NOT NULL DEFAULT 'CLUB',
  ADD COLUMN issuer_reference text,
  ADD COLUMN early_end_examination_id uuid,
  ADD COLUMN lift_reference text,
  ADD CONSTRAINT ck_suspensions_issuer CHECK (
    (issued_by = 'ORGANIZER') = (issuer_reference IS NOT NULL)
    AND (issued_by = 'CLUB' OR reason = 'MEDICAL')
    AND (issuer_reference IS NULL OR length(btrim(issuer_reference)) BETWEEN 3 AND 200)
  ),
  ADD CONSTRAINT ck_suspensions_early_end CHECK (
    (early_end_examination_id IS NULL OR lift_reference IS NULL)
    AND (early_end_examination_id IS NULL AND lift_reference IS NULL OR cleared_at IS NOT NULL)
    AND (early_end_examination_id IS NULL OR issued_by = 'CLUB')
    AND (lift_reference IS NULL OR (issued_by = 'ORGANIZER'
         AND length(btrim(lift_reference)) BETWEEN 3 AND 200))
  ),
  ADD CONSTRAINT fk_suspensions_early_end_examination
    FOREIGN KEY (early_end_examination_id, fighter_id)
    REFERENCES public.medical_examinations (id, fighter_id);

INSERT INTO mma_private.migration_history (version, name, source_sha256)
VALUES (
  33,
  '033_suspension_early_end.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
