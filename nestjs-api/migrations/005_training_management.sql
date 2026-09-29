-- MMA-TMS 005: Add milestones to training_plans
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 5);

DO $preflight$
BEGIN
  IF to_regclass('public.training_plans') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '005 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 4
  ) THEN
    RAISE EXCEPTION '005 requires migration 004 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 5
  ) THEN
    RAISE EXCEPTION '005 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
      AND table_name = 'training_plans'
      AND column_name = 'milestones'
  ) THEN
    RAISE EXCEPTION '005 training_plans milestones collision';
  END IF;
END
$preflight$;

ALTER TABLE public.training_plans
  ADD COLUMN milestones jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.training_plans
  ADD CONSTRAINT ck_training_plans_milestones CHECK (jsonb_typeof(milestones) = 'array'::text);

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  5,
  '005_training_management.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
