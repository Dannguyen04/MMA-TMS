-- 014_video_ai_vertical_slice.sql
-- Persist upload training context and support the frontend's diagonal camera angle.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 14);

DO $preflight$
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL
     OR NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 13) THEN
    RAISE EXCEPTION '014 requires migrations 003 through 013';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 14) THEN
    RAISE EXCEPTION 'Migration 014 has already been applied';
  END IF;
END
$preflight$;

ALTER TYPE public.camera_angle ADD VALUE IF NOT EXISTS 'DIAGONAL' AFTER 'SIDE';

ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS training_type public.session_type NOT NULL DEFAULT 'SHADOW_BOXING';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  14,
  '014_video_ai_vertical_slice.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
