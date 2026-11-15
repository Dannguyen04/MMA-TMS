-- =============================================================================
-- Migration 034: Fighter sex (15/11/2026)
-- =============================================================================
-- Why:
--   The web draws a female or male 3D body for each fighter (coach profile,
--   roster cards, doctor body map). The API had no sex field, so every fighter
--   showed the male body in API mode.
--
-- Preflight & safety:
--   1. Acquires transaction-scoped advisory lock (20260916, 34).
--   2. Requires mma_private.migration_history and public.fighters (migration
--      003). Does NOT require 004..033.
--   3. Rejects re-application if version 34 is already recorded.
--   4. Adds one nullable column: existing rows get NULL (unknown), which the
--      web reads as the male body, as before. No permission, trigger, RLS or
--      table is added; the fighters audit and updated_at triggers cover it.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;

SELECT pg_catalog.pg_advisory_xact_lock(20260916, 34);

DO $preflight$
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '034 requires mma_private.migration_history from migration 003';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 34
  ) THEN
    RAISE EXCEPTION '034 already applied';
  END IF;

  IF to_regclass('public.fighters') IS NULL THEN
    RAISE EXCEPTION '034 requires public.fighters';
  END IF;

  IF to_regtype('public.fighter_sex') IS NOT NULL THEN
    RAISE EXCEPTION '034 found an existing public.fighter_sex type';
  END IF;
END
$preflight$;

CREATE TYPE public.fighter_sex AS ENUM ('MALE', 'FEMALE');

ALTER TABLE public.fighters
  ADD COLUMN sex public.fighter_sex;

INSERT INTO mma_private.migration_history (version, name, source_sha256)
VALUES (
  34,
  '034_fighter_sex.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
