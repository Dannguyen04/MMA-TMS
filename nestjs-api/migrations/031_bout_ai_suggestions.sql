BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 31);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 27)
     OR NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 30) THEN
    RAISE EXCEPTION '031 requires migrations 027 and 030';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 31) THEN
    RAISE EXCEPTION '031 already applied';
  END IF;
  IF to_regclass('public.bouts') IS NULL OR to_regclass('public.bout_rounds') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL THEN
    RAISE EXCEPTION '031 requires schema objects';
  END IF;
  IF to_regclass('public.bout_ai_suggestions') IS NOT NULL THEN
    RAISE EXCEPTION '031 table collision';
  END IF;
END
$preflight$;

CREATE TABLE public.bout_ai_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('PRE_BOUT_TACTICS','BETWEEN_ROUNDS','VIDEO_OBSERVATIONS')),
  round_no smallint CHECK (round_no BETWEEN 1 AND 12),
  status text NOT NULL CHECK (status IN ('OK','FAILED')),
  error_code text,
  model text NOT NULL,
  input_hash text NOT NULL,
  output jsonb NOT NULL DEFAULT '{}',
  latency_ms integer,
  requested_by_id uuid NOT NULL REFERENCES public.users(id),
  decision text CHECK (decision IN ('ACCEPTED','PARTIAL','REJECTED')),
  accepted_item_ids text[] NOT NULL DEFAULT '{}',
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ck_bout_ai_round CHECK ((kind = 'BETWEEN_ROUNDS') = (round_no IS NOT NULL)),
  CONSTRAINT ck_bout_ai_error CHECK (status <> 'FAILED' OR error_code IS NOT NULL),
  CONSTRAINT ck_bout_ai_output CHECK (jsonb_typeof(output) = 'object')
);
CREATE INDEX idx_bout_ai_suggestions_bout_kind_created
  ON public.bout_ai_suggestions (bout_id, kind, created_at DESC);
CREATE TRIGGER trg_bout_ai_suggestions_audit AFTER INSERT OR UPDATE OR DELETE ON public.bout_ai_suggestions
  FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
ALTER TABLE public.bout_ai_suggestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bout_ai_suggestions FROM PUBLIC, anon, authenticated;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (31, '031_bout_ai_suggestions.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
