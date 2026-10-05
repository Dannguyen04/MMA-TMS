BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 20);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 19) THEN
    RAISE EXCEPTION '020 requires migration 019';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '020 already applied';
  END IF;
END
$preflight$;

ALTER TABLE public.analysis_jobs ADD COLUMN evidence_context jsonb;

-- Shared footage observations only; not a medical record or clearance decision.
CREATE TABLE public.movement_evidence_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.analysis_jobs(id) ON DELETE RESTRICT,
  window_id text NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewer_role text NOT NULL CHECK (reviewer_role IN ('COACH', 'DOCTOR')),
  revision integer NOT NULL CHECK (revision > 0),
  request_id uuid NOT NULL,
  request_hash text NOT NULL,
  evidence_hash text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirmed', 'corrected', 'rejected')),
  notes text NOT NULL CHECK (length(btrim(notes)) BETWEEN 1 AND 2000),
  start_ms double precision,
  end_ms double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_movement_review_request UNIQUE (reviewer_id, request_id),
  CONSTRAINT uq_movement_review_revision UNIQUE (job_id, window_id, reviewer_id, revision),
  CONSTRAINT ck_movement_review_interval CHECK (
    (decision = 'corrected' AND start_ms IS NOT NULL AND end_ms IS NOT NULL
      AND start_ms >= 0 AND end_ms > start_ms AND end_ms < 'Infinity'::double precision)
    OR (decision <> 'corrected' AND start_ms IS NULL AND end_ms IS NULL)
  )
);
ALTER TABLE public.movement_evidence_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.movement_evidence_reviews FROM anon, authenticated;

CREATE FUNCTION public.fn_movement_reviews_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $$
BEGIN
  RAISE EXCEPTION 'Movement reviews are append-only; submit a new revision';
END;
$$;
CREATE TRIGGER tr_movement_reviews_append_only BEFORE UPDATE OR DELETE
  ON public.movement_evidence_reviews FOR EACH ROW EXECUTE FUNCTION public.fn_movement_reviews_append_only();
CREATE TRIGGER tr_movement_reviews_no_truncate BEFORE TRUNCATE
  ON public.movement_evidence_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.fn_movement_reviews_append_only();

INSERT INTO public.permissions(code, name, resource, action, description) VALUES
  ('movement.evidence:read', 'Read movement evidence reviews', 'movement.evidence', 'read', 'Read shared non-clinical footage observations within effective fighter scope'),
  ('movement.evidence:review', 'Review movement evidence windows', 'movement.evidence', 'review', 'Assigned active coaches and doctors may append non-clinical footage observations');
INSERT INTO public.role_permissions(role, permission_id)
SELECT r.role::public.user_role, p.id FROM public.permissions p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('DOCTOR'), ('ADMIN')) AS r(role)
WHERE p.code = 'movement.evidence:read'
  OR (p.code = 'movement.evidence:review' AND r.role IN ('COACH', 'DOCTOR'))
ON CONFLICT DO NOTHING;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (20, '020_movement_evidence_reviews.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
