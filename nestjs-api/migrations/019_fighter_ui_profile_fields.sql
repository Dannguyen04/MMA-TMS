-- MMA-TMS 019: bổ sung hồ sơ võ sĩ cần thiết cho giao diện thật.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 19);

DO $preflight$
BEGIN
  IF to_regclass('public.fighters') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '019 requires migration 003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 18) THEN
    RAISE EXCEPTION '019 requires migration 018 history';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 19) THEN
    RAISE EXCEPTION '019 has already been applied';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname IN ('fighter_sex', 'fighter_training_level'))
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'fighters'
         AND column_name IN ('nickname', 'sex', 'weight_kg', 'body_fat_pct', 'resting_heart_rate', 'training_level', 'primary_discipline', 'record_wins', 'record_losses', 'record_draws', 'upcoming_bout')
     ) THEN
    RAISE EXCEPTION '019 fighter UI profile field collision';
  END IF;
END
$preflight$;

CREATE TYPE public.fighter_sex AS ENUM ('MALE', 'FEMALE');
CREATE TYPE public.fighter_training_level AS ENUM ('AMATEUR', 'SEMI_PRO', 'PROFESSIONAL', 'ELITE');

ALTER TABLE public.fighters
  ADD COLUMN nickname text,
  ADD COLUMN sex public.fighter_sex NOT NULL DEFAULT 'MALE',
  ADD COLUMN weight_kg double precision NOT NULL DEFAULT 70,
  ADD COLUMN body_fat_pct double precision NOT NULL DEFAULT 15,
  ADD COLUMN resting_heart_rate integer NOT NULL DEFAULT 60,
  ADD COLUMN training_level public.fighter_training_level NOT NULL DEFAULT 'AMATEUR',
  ADD COLUMN primary_discipline text NOT NULL DEFAULT 'MMA',
  ADD COLUMN record_wins integer NOT NULL DEFAULT 0,
  ADD COLUMN record_losses integer NOT NULL DEFAULT 0,
  ADD COLUMN record_draws integer NOT NULL DEFAULT 0,
  ADD COLUMN upcoming_bout jsonb,
  ADD CONSTRAINT ck_fighters_weight_kg CHECK (weight_kg > 0 AND weight_kg < 400),
  ADD CONSTRAINT ck_fighters_body_fat_pct CHECK (body_fat_pct >= 0 AND body_fat_pct <= 100),
  ADD CONSTRAINT ck_fighters_resting_heart_rate CHECK (resting_heart_rate > 0 AND resting_heart_rate < 300),
  ADD CONSTRAINT ck_fighters_record_nonnegative CHECK (record_wins >= 0 AND record_losses >= 0 AND record_draws >= 0),
  ADD CONSTRAINT ck_fighters_upcoming_bout CHECK (upcoming_bout IS NULL OR jsonb_typeof(upcoming_bout) = 'object');

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  19,
  '019_fighter_ui_profile_fields.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
