BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 15);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 14) THEN
    RAISE EXCEPTION '015 requires migration 014';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 15) THEN
    RAISE EXCEPTION '015 already applied';
  END IF;
END
$preflight$;

-- Missing model probability is unknown, never a synthetic zero.
ALTER TABLE public.action_assessments ALTER COLUMN confidence DROP NOT NULL;
ALTER TABLE public.action_assessments ALTER COLUMN confidence DROP DEFAULT;
-- Existing duplicates must be audited rather than silently discarded.
CREATE UNIQUE INDEX uq_action_assessment_delivery
  ON public.action_assessments (analysis_id, action_id);
ALTER TABLE public.action_finding_reviews ADD COLUMN corrected_label text;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (15, '015_ai_delivery_receipts.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
