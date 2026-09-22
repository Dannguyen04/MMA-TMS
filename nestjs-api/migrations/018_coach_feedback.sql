-- MMA-TMS 018: lưu phản hồi huấn luyện viên và quyền truy cập theo phân công.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260922, 18);

DO $preflight$
BEGIN
  IF to_regclass('public.fighters') IS NULL
     OR to_regclass('public.coaches') IS NULL
     OR to_regclass('public.training_sessions') IS NULL
     OR to_regclass('public.videos') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL THEN
    RAISE EXCEPTION '018 requires migration 003';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 17) THEN
    RAISE EXCEPTION '018 requires migration 017 history';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 18) THEN
    RAISE EXCEPTION '018 has already been applied';
  END IF;
  IF to_regclass('public.coach_feedback') IS NOT NULL THEN
    RAISE EXCEPTION '018 coach feedback table collision';
  END IF;
END
$preflight$;

CREATE TABLE public.coach_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id UUID NOT NULL REFERENCES public.fighters(id) ON DELETE RESTRICT,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  session_id UUID,
  video_id UUID,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  techniques TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ck_coach_feedback_kind CHECK (kind IN ('PRAISE', 'CORRECTION', 'NOTE')),
  CONSTRAINT ck_coach_feedback_body CHECK (length(btrim(body)) BETWEEN 3 AND 1000),
  CONSTRAINT ck_coach_feedback_single_context CHECK (session_id IS NULL OR video_id IS NULL),
  CONSTRAINT fk_coach_feedback_session_fighter FOREIGN KEY (session_id, fighter_id)
    REFERENCES public.training_sessions(id, fighter_id) ON DELETE RESTRICT,
  CONSTRAINT fk_coach_feedback_video_fighter FOREIGN KEY (video_id, fighter_id)
    REFERENCES public.videos(id, subject_fighter_id) ON DELETE RESTRICT
);

CREATE INDEX idx_coach_feedback_fighter_created
  ON public.coach_feedback(fighter_id, created_at DESC);
CREATE INDEX idx_coach_feedback_coach_created
  ON public.coach_feedback(coach_id, created_at DESC);
CREATE INDEX idx_coach_feedback_session ON public.coach_feedback(session_id)
  WHERE session_id IS NOT NULL;
CREATE INDEX idx_coach_feedback_video ON public.coach_feedback(video_id)
  WHERE video_id IS NOT NULL;

CREATE TRIGGER trg_coach_feedback_audit
AFTER INSERT OR UPDATE OR DELETE ON public.coach_feedback
FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

ALTER TABLE public.coach_feedback ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_feedback FROM PUBLIC, anon, authenticated;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('training.feedback:get_all', 'List coach feedback', 'coach_feedback', 'get_all',
   'List coach feedback within the actor fighter-assignment scope.'),
  ('training.feedback:create', 'Create coach feedback', 'coach_feedback', 'create',
   'Create coach feedback for an actively assigned fighter.');

WITH baseline(role, code) AS (
  VALUES
    ('FIGHTER'::public.user_role, 'training.feedback:get_all'),
    ('COACH'::public.user_role, 'training.feedback:get_all'),
    ('COACH'::public.user_role, 'training.feedback:create'),
    ('ADMIN'::public.user_role, 'training.feedback:get_all')
)
INSERT INTO public.role_permissions (role, permission_id)
SELECT baseline.role, permission.id
FROM baseline
JOIN public.permissions AS permission ON permission.code = baseline.code;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  18,
  '018_coach_feedback.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
