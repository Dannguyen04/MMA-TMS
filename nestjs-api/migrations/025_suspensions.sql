BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 25);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 24) THEN
    RAISE EXCEPTION '025 requires migration 024';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 25) THEN
    RAISE EXCEPTION '025 already applied';
  END IF;
  IF to_regclass('public.fighters') IS NULL
     OR to_regclass('public.bouts') IS NULL
     OR to_regclass('public.users') IS NULL
     OR to_regtype('public.session_type') IS NULL
     OR to_regtype('public.notification_type') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL THEN
    RAISE EXCEPTION '025 requires schema objects';
  END IF;
  IF to_regtype('public.suspension_reason') IS NOT NULL
     OR to_regclass('public.suspensions') IS NOT NULL THEN
    RAISE EXCEPTION '025 type or table collision';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.permissions
     WHERE code = ANY (ARRAY['suspension:read', 'suspension:create', 'suspension:clear'])
  ) THEN
    RAISE EXCEPTION '025 permission collision';
  END IF;
END
$preflight$;

CREATE TYPE public.suspension_reason AS ENUM
  ('KO', 'TKO', 'DQ', 'MANDATORY_REST', 'MEDICAL', 'OTHER');

-- ---------------------------------------------------------------------------
-- suspensions
-- ---------------------------------------------------------------------------
CREATE TABLE public.suspensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id uuid NOT NULL REFERENCES public.fighters(id),
  bout_id uuid REFERENCES public.bouts(id),
  reason public.suspension_reason NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  loss_of_consciousness text,
  suggested_days smallint,
  override_reason text,
  blocked_session_types public.session_type[] NOT NULL,
  requires_clearance boolean NOT NULL,
  cleared_at timestamptz,
  cleared_by_id uuid REFERENCES public.users(id),
  clearance_note text,
  created_by_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ck_suspensions_loss_of_consciousness CHECK (
    loss_of_consciousness IS NULL
    OR loss_of_consciousness IN ('NONE', 'UNDER_1_MIN', 'OVER_1_MIN', 'UNKNOWN')
  ),
  CONSTRAINT ck_suspensions_dates CHECK (ends_on >= starts_on),
  CONSTRAINT ck_suspensions_cleared CHECK ((cleared_at IS NULL) = (cleared_by_id IS NULL))
);

CREATE INDEX idx_suspensions_fighter_active
  ON public.suspensions (fighter_id, ends_on)
  WHERE deleted_at IS NULL;

-- Triggers: updated_at, audit.
CREATE TRIGGER trg_suspensions_updated_at BEFORE UPDATE
  ON public.suspensions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_suspensions_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.suspensions FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- RLS on, no direct access for Supabase client roles (the backend is the only access path).
ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suspensions FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions(code, name, resource, action, description) VALUES
  ('suspension:read', 'Read suspensions', 'suspension', 'read', 'List and read fighter suspensions within the caller scope'),
  ('suspension:create', 'Create suspension', 'suspension', 'create', 'Create a manual suspension for an assigned fighter'),
  ('suspension:clear', 'Clear suspension', 'suspension', 'clear', 'Clear or end a suspension early for an assigned fighter');

INSERT INTO public.role_permissions(role, permission_id)
SELECT r.role::public.user_role, p.id FROM public.permissions p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('DOCTOR'), ('ADMIN')) AS r(role)
WHERE (p.code = 'suspension:read')
   OR (p.code = 'suspension:create' AND r.role IN ('COACH', 'DOCTOR', 'ADMIN'))
   OR (p.code = 'suspension:clear' AND r.role IN ('COACH', 'DOCTOR'))
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Notification types (only added, never used as literals in this transaction)
-- ---------------------------------------------------------------------------
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BOUT_CREATED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BOUT_WEIGHT_AT_RISK';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BOUT_REQUIREMENT_REJECTED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BOUT_REQUIREMENT_DUE';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'BOUT_WEIGHT_MISSING';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SUSPENSION_CREATED';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'SUSPENSION_AWAITING_CLEARANCE';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (25, '025_suspensions.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
