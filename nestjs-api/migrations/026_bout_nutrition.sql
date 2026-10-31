BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 26);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 24) THEN
    RAISE EXCEPTION '026 requires migration 024';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 26) THEN
    RAISE EXCEPTION '026 already applied';
  END IF;
  IF to_regclass('public.bouts') IS NULL
     OR to_regclass('public.fighters') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL
     OR to_regprocedure('mma_private.reject_context_change()') IS NULL THEN
    RAISE EXCEPTION '026 requires schema objects';
  END IF;
  IF to_regtype('public.nutrition_adherence') IS NOT NULL
     OR to_regclass('public.bout_nutrition_checkins') IS NOT NULL
     OR to_regprocedure('mma_private.check_bout_nutrition_fighter()') IS NOT NULL
     OR EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'bouts' AND column_name = 'nutrition_plan'
     ) THEN
    RAISE EXCEPTION '026 type, column or table collision';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.permissions
     WHERE code = 'bout:nutrition_checkin'
  ) THEN
    RAISE EXCEPTION '026 permission collision';
  END IF;
END
$preflight$;

-- ---------------------------------------------------------------------------
-- 1. bouts.nutrition_plan
-- ---------------------------------------------------------------------------
ALTER TABLE public.bouts
  ADD COLUMN nutrition_plan jsonb NOT NULL DEFAULT '{}',
  ADD CONSTRAINT ck_bouts_nutrition_plan CHECK (jsonb_typeof(nutrition_plan) = 'object');

-- ---------------------------------------------------------------------------
-- 2. enum nutrition_adherence
-- ---------------------------------------------------------------------------
CREATE TYPE public.nutrition_adherence AS ENUM ('ON_PLAN', 'SLIGHTLY_OFF', 'WAY_OFF');

-- ---------------------------------------------------------------------------
-- 3. bout_nutrition_checkins
-- ---------------------------------------------------------------------------
CREATE TABLE public.bout_nutrition_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  fighter_id uuid NOT NULL REFERENCES public.fighters(id),
  academy_date date NOT NULL,
  adherence public.nutrition_adherence NOT NULL,
  note text,
  recorded_by_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bout_nutrition_checkins_date UNIQUE (bout_id, academy_date),
  CONSTRAINT ck_bout_nutrition_checkins_note CHECK (note IS NULL OR char_length(note) <= 200)
);

-- Trigger: fighter_id consistency with bouts
CREATE FUNCTION mma_private.check_bout_nutrition_fighter()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE bout_fighter_id uuid;
BEGIN
  SELECT fighter_id INTO STRICT bout_fighter_id FROM public.bouts WHERE id = NEW.bout_id FOR KEY SHARE;
  IF NEW.fighter_id IS DISTINCT FROM bout_fighter_id THEN
    RAISE EXCEPTION 'bout_nutrition_checkins fighter_id must match bouts.fighter_id'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bout_nutrition_checkins_fighter
  BEFORE INSERT OR UPDATE ON public.bout_nutrition_checkins
  FOR EACH ROW EXECUTE FUNCTION mma_private.check_bout_nutrition_fighter();

REVOKE ALL ON FUNCTION mma_private.check_bout_nutrition_fighter() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_bout_nutrition_checkins_updated_at BEFORE UPDATE
  ON public.bout_nutrition_checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_bout_nutrition_checkins_context_immutable BEFORE UPDATE
  ON public.bout_nutrition_checkins FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('bout_id', 'fighter_id', 'academy_date');

CREATE TRIGGER trg_bout_nutrition_checkins_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.bout_nutrition_checkins FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

ALTER TABLE public.bout_nutrition_checkins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bout_nutrition_checkins FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions(code, name, resource, action, description) VALUES
  ('bout:nutrition_checkin', 'Record bout nutrition check-in', 'bout', 'nutrition_checkin', 'Record daily nutrition adherence check-in for a bout');

INSERT INTO public.role_permissions(role, permission_id)
SELECT r.role::public.user_role, p.id FROM public.permissions p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('ADMIN')) AS r(role)
WHERE p.code = 'bout:nutrition_checkin'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. Migration history
-- ---------------------------------------------------------------------------
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (26, '026_bout_nutrition.sql', nullif(current_setting('mma.migration_sha256', true), ''));

COMMIT;
