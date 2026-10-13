-- MMA-TMS 021: performance goals agreed between a Coach and a Fighter.
--
-- Reconstructed. The original file was applied to the shared database on
-- 2026-10-05 (ledger source_sha256 f57d069d047b7b234916c6614708b87bc6b28e16c2b1b4243ea01d702b2ab2a0)
-- and later lost from the working tree. This file recreates the objects read
-- back from that database's catalogue so fresh databases match it. It is not
-- byte-identical to the applied source; never re-run it where ledger 21 exists.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 21);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '021 requires migration 020';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 21) THEN
    RAISE EXCEPTION '021 already applied';
  END IF;
  IF to_regclass('public.goals') IS NOT NULL
     OR to_regtype('public.goal_technique') IS NOT NULL
     OR to_regtype('public.goal_status') IS NOT NULL THEN
    RAISE EXCEPTION '021 goals collision';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = ANY (ARRAY['goal:get_all', 'goal:read', 'goal:create', 'goal:update', 'goal:delete'])
  ) THEN
    RAISE EXCEPTION '021 API permission catalogue collision';
  END IF;
END
$preflight$;

CREATE TYPE public.goal_technique AS ENUM (
  'JAB', 'CROSS', 'HOOK', 'KICK', 'COMBINATION', 'FOOTWORK', 'GUARD', 'HEAD_MOVEMENT'
);
CREATE TYPE public.goal_status AS ENUM ('ON_TRACK', 'AT_RISK', 'ACHIEVED', 'MISSED');

CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id uuid NOT NULL REFERENCES public.fighters(id) ON DELETE RESTRICT,
  coach_id uuid NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (length(btrim(title)) >= 1 AND length(btrim(title)) <= 255),
  technique public.goal_technique,
  metric_label text NOT NULL CHECK (length(btrim(metric_label)) >= 1 AND length(btrim(metric_label)) <= 100),
  unit text NOT NULL CHECK (length(btrim(unit)) >= 1 AND length(btrim(unit)) <= 50),
  lower_is_better boolean NOT NULL DEFAULT false,
  baseline double precision NOT NULL CHECK (baseline >= 0 AND baseline < 'Infinity'::double precision),
  target double precision NOT NULL CHECK (target >= 0 AND target < 'Infinity'::double precision),
  current double precision NOT NULL CHECK (current >= 0 AND current < 'Infinity'::double precision),
  start_date date NOT NULL,
  due_date date NOT NULL,
  status public.goal_status NOT NULL DEFAULT 'ON_TRACK',
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ck_goals_date_range CHECK (due_date >= start_date),
  CONSTRAINT ck_goals_history_array CHECK (jsonb_typeof(history) = 'array')
);
CREATE INDEX idx_goals_fighter_id ON public.goals (fighter_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_goals_coach_id ON public.goals (coach_id) WHERE deleted_at IS NULL;

ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.goals FROM anon, authenticated;

INSERT INTO public.permissions (code, name, resource, action, description) VALUES
  ('goal:get_all', 'List goals', 'goal', 'get_all', 'List performance goals within effective scope'),
  ('goal:read', 'Read goal', 'goal', 'read', 'Read a goal within effective scope'),
  ('goal:create', 'Create goal', 'goal', 'create', 'Create a goal for an assigned fighter'),
  ('goal:update', 'Update goal', 'goal', 'update', 'Update a goal or record progress for an assigned fighter'),
  ('goal:delete', 'Delete goal', 'goal', 'delete', 'Delete a goal within effective scope');

INSERT INTO public.role_permissions (role, permission_id)
SELECT r.role::public.user_role, p.id
FROM public.permissions AS p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('ADMIN')) AS r(role)
WHERE p.code IN ('goal:get_all', 'goal:read')
  OR (p.code IN ('goal:create', 'goal:update', 'goal:delete') AND r.role IN ('COACH', 'ADMIN'))
ON CONFLICT DO NOTHING;

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (21, '021_goals_persistence.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
