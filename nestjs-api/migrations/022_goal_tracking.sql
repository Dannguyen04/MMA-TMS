-- MMA-TMS 022: goal tracking support on top of 021.
-- Adds the goal notification types, the same maintenance triggers other
-- domain tables use, and a check that the target is a real change in the
-- declared direction. Fails without changes if an existing goal violates it.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 22);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 21) THEN
    RAISE EXCEPTION '022 requires migration 021';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 22) THEN
    RAISE EXCEPTION '022 already applied';
  END IF;
  IF to_regclass('public.goals') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'goals' AND column_name = 'history'
     ) THEN
    RAISE EXCEPTION '022 requires the goals table from 021';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.goals'::regclass
      AND tgname IN ('trg_goals_updated_at', 'trg_goals_context_immutable', 'trg_goals_audit')
  ) OR EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.goals'::regclass AND conname = 'ck_goals_direction'
  ) THEN
    RAISE EXCEPTION '022 goals collision';
  END IF;
END
$preflight$;

-- New values are not used as literals in this transaction.
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'GOAL_SET';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'GOAL_ACHIEVED';

ALTER TABLE public.goals ADD CONSTRAINT ck_goals_direction CHECK (
  (lower_is_better AND target < baseline)
  OR (NOT lower_is_better AND target > baseline)
);

CREATE TRIGGER trg_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_goals_context_immutable BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id');
CREATE TRIGGER trg_goals_audit AFTER INSERT OR UPDATE OR DELETE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (22, '022_goal_tracking.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
