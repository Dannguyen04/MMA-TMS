-- MMA-TMS 016: lưu metadata video riêng tư và góc quay chéo.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260921, 16);

DO $preflight$
BEGIN
  IF to_regclass('public.videos') IS NULL
     OR to_regclass('public.training_sessions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '016 requires migration 003';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 15
  ) THEN
    RAISE EXCEPTION '016 requires migration 015 history';
  END IF;

  IF EXISTS (
    SELECT 1 FROM mma_private.migration_history WHERE version = 16
  ) THEN
    RAISE EXCEPTION '016 has already been applied';
  END IF;
END
$preflight$;

ALTER TYPE public.camera_angle ADD VALUE IF NOT EXISTS 'DIAGONAL';

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS training_type public.session_type;

UPDATE public.videos AS video
SET training_type = CASE
  WHEN session.session_type IN ('SHADOW_BOXING', 'PAD_WORK', 'HEAVY_BAG', 'SPARRING')
    THEN session.session_type
  ELSE 'SHADOW_BOXING'::public.session_type
END
FROM public.training_sessions AS session
WHERE video.session_id = session.id
  AND video.training_type IS NULL;

UPDATE public.videos
SET training_type = 'SHADOW_BOXING'::public.session_type
WHERE training_type IS NULL;

ALTER TABLE public.videos
  ALTER COLUMN training_type SET DEFAULT 'SHADOW_BOXING'::public.session_type,
  ALTER COLUMN training_type SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_video_training_type'
      AND conrelid = 'public.videos'::regclass
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT ck_video_training_type
      CHECK (training_type IN ('SHADOW_BOXING', 'PAD_WORK', 'HEAVY_BAG', 'SPARRING'));
  END IF;
END
$$;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  16,
  '016_video_storage_contract.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
