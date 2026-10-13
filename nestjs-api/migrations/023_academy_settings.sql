BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 23);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 20) THEN
    RAISE EXCEPTION '023 requires migration 020';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 23) THEN
    RAISE EXCEPTION '023 already applied';
  END IF;
  IF to_regtype('public.medical_supervision') IS NOT NULL
     OR to_regclass('public.academy_settings') IS NOT NULL THEN
    RAISE EXCEPTION '023 type or table collision';
  END IF;
END
$preflight$;

CREATE TYPE public.medical_supervision AS ENUM ('DOCTOR', 'NONE');

CREATE TABLE public.academy_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  medical_supervision public.medical_supervision NOT NULL DEFAULT 'DOCTOR',
  change_reason text,
  updated_by_id uuid REFERENCES public.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.academy_settings (id, medical_supervision, change_reason)
VALUES (true, 'DOCTOR', 'Initial academy configuration');

CREATE TRIGGER trg_academy_settings_updated_at BEFORE UPDATE
  ON public.academy_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE FUNCTION mma_private.audit_academy_settings_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  actor UUID;
  changed_keys JSONB := '[]'::jsonb;
BEGIN
  SELECT id INTO actor FROM public.users
   WHERE auth_user_id = (SELECT auth.uid()) AND is_active AND deleted_at IS NULL;
  IF actor IS NULL AND TG_OP <> 'DELETE' AND NEW.updated_by_id IS NOT NULL THEN
    actor := NEW.updated_by_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT COALESCE(jsonb_agg(n.key ORDER BY n.key), '[]'::jsonb) INTO changed_keys
      FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM to_jsonb(OLD)->n.key;
  END IF;

  INSERT INTO public.audit_logs(
    actor_user_id,
    actor_type,
    action,
    resource_type,
    resource_id,
    request_id,
    details
  ) VALUES (
    actor,
    CASE WHEN actor IS NULL THEN 'SYSTEM' ELSE 'USER' END,
    TG_OP,
    TG_TABLE_NAME,
    NULL,
    nullif(current_setting('mma.request_id', true), ''),
    jsonb_build_object(
      'changed_columns', changed_keys,
      'change_reason', CASE WHEN TG_OP = 'DELETE' THEN OLD.change_reason ELSE NEW.change_reason END
    )
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;

CREATE TRIGGER trg_academy_settings_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.academy_settings FOR EACH ROW EXECUTE FUNCTION mma_private.audit_academy_settings_mutation();

ALTER TABLE public.academy_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.academy_settings FROM anon, authenticated;

INSERT INTO public.permissions(code, name, resource, action, description) VALUES
  ('academy_settings:read', 'Read academy settings', 'academy_settings', 'read', 'Read academy-wide operational settings'),
  ('academy_settings:manage', 'Manage academy settings', 'academy_settings', 'manage', 'Update academy-wide operational settings');

INSERT INTO public.role_permissions(role, permission_id)
SELECT r.role::public.user_role, p.id FROM public.permissions p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('DOCTOR'), ('ADMIN')) AS r(role)
WHERE (p.code = 'academy_settings:read')
   OR (p.code = 'academy_settings:manage' AND r.role = 'ADMIN')
ON CONFLICT DO NOTHING;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (23, '023_academy_settings.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
