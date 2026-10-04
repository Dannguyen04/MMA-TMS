-- MMA-TMS 018: required Training Plan phase.
-- Adds enum public.training_plan_phase and public.training_plans.phase
-- (NOT NULL, no default). Existing plans, including soft-deleted rows, are
-- backfilled once to 'base' by explicit owner decision (2026-10-04); the
-- column keeps no default, so every new plan must supply its own phase.
-- No index: there is no phase filter yet.
-- Recovery: if rolled back nothing changes; after commit, phase values can be
-- corrected with a plain UPDATE through the plan API/SQL.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-017.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 18);

DO $preflight$
BEGIN
  IF to_regclass('public.training_plans') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '018 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 5
  ) THEN
    RAISE EXCEPTION '018 requires migration 005 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 18
  ) THEN
    RAISE EXCEPTION '018 has already been applied';
  END IF;

  IF to_regtype('public.training_plan_phase') IS NOT NULL THEN
    RAISE EXCEPTION '018 training_plan_phase enum collision';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'training_plans'
      AND column_name = 'phase'
  ) THEN
    RAISE EXCEPTION '018 training_plans phase collision';
  END IF;
END
$preflight$;

-- Block concurrent inserts/updates so the backfill covers every row until commit.
LOCK TABLE public.training_plans IN ACCESS EXCLUSIVE MODE;

CREATE TYPE public.training_plan_phase AS ENUM (
  'base',
  'build',
  'fight_camp',
  'taper',
  'rehab',
  'maintenance'
);

ALTER TABLE public.training_plans
  ADD COLUMN phase public.training_plan_phase;

-- Owner decision: every pre-existing plan becomes 'base'. No default remains.
UPDATE public.training_plans SET phase = 'base' WHERE phase IS NULL;

DO $verify$
BEGIN
  IF EXISTS (SELECT 1 FROM public.training_plans WHERE phase IS NULL) THEN
    RAISE EXCEPTION '018 backfill left training_plans rows without phase';
  END IF;
END
$verify$;

ALTER TABLE public.training_plans ALTER COLUMN phase SET NOT NULL;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  18,
  '018_training_plan_phase.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
