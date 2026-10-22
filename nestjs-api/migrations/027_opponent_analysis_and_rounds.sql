BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 27);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 24) THEN
    RAISE EXCEPTION '027 requires migration 024';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 27) THEN
    RAISE EXCEPTION '027 already applied';
  END IF;
  IF to_regclass('public.bouts') IS NULL
     OR to_regclass('public.training_sessions') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL
     OR to_regprocedure('mma_private.reject_context_change()') IS NULL THEN
    RAISE EXCEPTION '027 requires schema objects';
  END IF;
  IF to_regclass('public.bout_rounds') IS NOT NULL OR EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name = 'bouts' AND column_name IN ('opponent_analysis', 'scheduled_rounds')
  ) THEN
    RAISE EXCEPTION '027 column or table collision';
  END IF;
END
$preflight$;

ALTER TABLE public.bouts
  ADD COLUMN opponent_analysis jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN scheduled_rounds smallint,
  ADD CONSTRAINT ck_bouts_opponent_analysis CHECK (jsonb_typeof(opponent_analysis) = 'object'),
  ADD CONSTRAINT ck_bouts_scheduled_rounds CHECK (scheduled_rounds BETWEEN 1 AND 12);

CREATE TABLE public.bout_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  round_no smallint NOT NULL CHECK (round_no BETWEEN 1 AND 12),
  tactic_marks jsonb NOT NULL DEFAULT '{}',
  observation_marks jsonb NOT NULL DEFAULT '{}',
  self_score text CHECK (self_score IN ('WIN', 'LOSS', 'CLOSE')),
  knockdowns_against smallint NOT NULL DEFAULT 0 CHECK (knockdowns_against BETWEEN 0 AND 10),
  stunned boolean NOT NULL DEFAULT false,
  bleeding boolean NOT NULL DEFAULT false,
  fatigued boolean NOT NULL DEFAULT false,
  note text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bout_rounds_bout_round UNIQUE (bout_id, round_no),
  CONSTRAINT ck_bout_rounds_tactic_marks CHECK (jsonb_typeof(tactic_marks) = 'object'),
  CONSTRAINT ck_bout_rounds_observation_marks CHECK (jsonb_typeof(observation_marks) = 'object')
);
CREATE TRIGGER trg_bout_rounds_updated_at BEFORE UPDATE ON public.bout_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bout_rounds_audit AFTER INSERT OR UPDATE OR DELETE ON public.bout_rounds
  FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
ALTER TABLE public.bout_rounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bout_rounds FROM PUBLIC, anon, authenticated;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (27, '027_opponent_analysis_and_rounds.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
