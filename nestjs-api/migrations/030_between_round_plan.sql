BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 30);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 27) THEN
    RAISE EXCEPTION '030 requires migration 027';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 30) THEN
    RAISE EXCEPTION '030 already applied';
  END IF;
  IF to_regclass('public.bout_rounds') IS NULL THEN
    RAISE EXCEPTION '030 requires schema objects';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'bout_rounds' AND column_name = 'next_round_plan'
  ) THEN
    RAISE EXCEPTION '030 column collision';
  END IF;
END
$preflight$;

ALTER TABLE public.bout_rounds
  ADD COLUMN next_round_plan jsonb NOT NULL DEFAULT '{}',
  ADD CONSTRAINT ck_bout_rounds_next_round_plan CHECK (jsonb_typeof(next_round_plan) = 'object');

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (30, '030_between_round_plan.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
