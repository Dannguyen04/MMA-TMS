-- MMA-TMS 021: lưu mục tiêu võ sĩ và lịch sử tiến độ theo phạm vi phân công.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260922, 21);

DO $preflight$
BEGIN
  IF to_regclass('public.fighters') IS NULL
     OR to_regclass('public.coaches') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '021 requires migration 003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '021 requires migration 020 history';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 21) THEN
    RAISE EXCEPTION '021 has already been applied';
  END IF;
  IF to_regclass('public.fighter_goals') IS NOT NULL
     OR to_regclass('public.goal_progress_events') IS NOT NULL
     OR EXISTS (SELECT 1 FROM pg_type WHERE typname IN ('goal_status', 'goal_technique'))
     OR EXISTS (SELECT 1 FROM public.permissions WHERE code = 'goals:write') THEN
    RAISE EXCEPTION '021 goal integration objects collide';
  END IF;
END
$preflight$;

CREATE TYPE public.goal_status AS ENUM ('ON_TRACK', 'AT_RISK', 'ACHIEVED', 'MISSED');
CREATE TYPE public.goal_technique AS ENUM (
  'JAB', 'CROSS', 'HOOK', 'KICK', 'COMBINATION', 'FOOTWORK', 'GUARD', 'HEAD_MOVEMENT'
);

CREATE TABLE public.fighter_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id UUID NOT NULL REFERENCES public.fighters(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  technique public.goal_technique,
  metric_label TEXT NOT NULL,
  unit TEXT NOT NULL,
  lower_is_better BOOLEAN NOT NULL,
  baseline DOUBLE PRECISION NOT NULL,
  target DOUBLE PRECISION NOT NULL,
  current DOUBLE PRECISION NOT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status public.goal_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT ck_fighter_goals_dates CHECK (due_date > start_date),
  CONSTRAINT ck_fighter_goals_title CHECK (length(btrim(title)) BETWEEN 3 AND 120),
  CONSTRAINT ck_fighter_goals_metric CHECK (length(btrim(metric_label)) BETWEEN 2 AND 80),
  CONSTRAINT ck_fighter_goals_unit CHECK (length(btrim(unit)) BETWEEN 1 AND 16),
  CONSTRAINT ck_fighter_goals_target_change CHECK (target <> baseline),
  CONSTRAINT ck_fighter_goals_direction CHECK (
    (lower_is_better AND target < baseline)
    OR (NOT lower_is_better AND target > baseline)
  )
);

CREATE TABLE public.goal_progress_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES public.fighter_goals(id) ON DELETE RESTRICT,
  value DOUBLE PRECISION NOT NULL,
  recorded_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fighter_goals_fighter_created
  ON public.fighter_goals(fighter_id, created_at DESC, id DESC);
CREATE INDEX idx_fighter_goals_coach_created
  ON public.fighter_goals(coach_id, created_at DESC, id DESC);
CREATE INDEX idx_goal_progress_goal_time
  ON public.goal_progress_events(goal_id, recorded_at, created_at);

CREATE TRIGGER trg_fighter_goals_updated_at
BEFORE UPDATE ON public.fighter_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fighter_goals_context_immutable
BEFORE UPDATE ON public.fighter_goals
FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id', 'coach_id');
CREATE TRIGGER trg_fighter_goals_audit
AFTER INSERT OR UPDATE OR DELETE ON public.fighter_goals
FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_goal_progress_audit
AFTER INSERT OR UPDATE OR DELETE ON public.goal_progress_events
FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_goal_progress_append_only
BEFORE UPDATE OR DELETE ON public.goal_progress_events
FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_goal_progress_no_truncate
BEFORE TRUNCATE ON public.goal_progress_events
FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

ALTER TABLE public.fighter_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_progress_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_goals, public.goal_progress_events FROM PUBLIC, anon, authenticated;

CREATE FUNCTION mma_private.can_read_goal(target_fighter_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.auth_user_id = (SELECT auth.uid())
      AND u.is_active AND u.deleted_at IS NULL
      AND (
        u.role = 'ADMIN'
        OR (u.role = 'FIGHTER' AND EXISTS (
          SELECT 1 FROM public.fighters f
          WHERE f.id = target_fighter_id AND f.user_id = u.id
            AND f.is_active AND f.deleted_at IS NULL
        ))
        OR (u.role = 'COACH' AND EXISTS (
          SELECT 1 FROM public.coaches c
          JOIN public.coach_fighters cf ON cf.coach_id = c.id
          WHERE c.user_id = u.id AND cf.fighter_id = target_fighter_id
            AND c.is_active AND c.deleted_at IS NULL
            AND cf.starts_at <= now() AND (cf.ends_at IS NULL OR cf.ends_at > now())
        ))
      )
  )
$$;

GRANT EXECUTE ON FUNCTION mma_private.can_read_goal(UUID) TO authenticated;
GRANT SELECT ON public.fighter_goals, public.goal_progress_events TO authenticated;
CREATE POLICY fighter_goals_read ON public.fighter_goals
FOR SELECT TO authenticated USING (mma_private.can_read_goal(fighter_id));
CREATE POLICY goal_progress_read ON public.goal_progress_events
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.fighter_goals goal
    WHERE goal.id = goal_id AND mma_private.can_read_goal(goal.fighter_id)
  )
);

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES ('goals:write', 'Manage fighter goals', 'goals', 'write',
        'Create, update and delete goals for actively assigned fighters.');

INSERT INTO public.role_permissions(role, permission_id)
SELECT 'COACH'::public.user_role, permission.id
FROM public.permissions AS permission
WHERE permission.code = 'goals:write';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  21,
  '021_goals_progress.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
