BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 24);

DO $preflight$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 23) THEN
    RAISE EXCEPTION '024 requires migration 023';
  END IF;
  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 24) THEN
    RAISE EXCEPTION '024 already applied';
  END IF;
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.fighters') IS NULL
     OR to_regclass('public.coaches') IS NULL
     OR to_regclass('public.training_plans') IS NULL
     OR to_regtype('public.session_type') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL
     OR to_regprocedure('mma_private.reject_context_change()') IS NULL THEN
    RAISE EXCEPTION '024 requires the 003 schema objects';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'training_plans' AND column_name = 'phase'
  ) THEN
    RAISE EXCEPTION '024 requires migration 018 (training_plans.phase)';
  END IF;
  IF to_regtype('public.bout_status') IS NOT NULL
     OR to_regtype('public.bout_sport') IS NOT NULL
     OR to_regtype('public.bout_result') IS NOT NULL
     OR to_regtype('public.bout_method') IS NOT NULL
     OR to_regtype('public.bout_requirement_status') IS NOT NULL
     OR to_regclass('public.competition_rulesets') IS NOT NULL
     OR to_regclass('public.bouts') IS NOT NULL
     OR to_regclass('public.bout_requirements') IS NOT NULL THEN
    RAISE EXCEPTION '024 type or table collision';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.permissions
     WHERE code = ANY (ARRAY[
       'ruleset:read', 'bout:get_all', 'bout:read', 'bout:create',
       'bout:update', 'bout:result', 'bout:requirement'
     ])
  ) THEN
    RAISE EXCEPTION '024 permission collision';
  END IF;
  IF (SELECT count(*) FROM public.permissions WHERE code = 'fighter.measurement:write') <> 1 THEN
    RAISE EXCEPTION '024 requires the migration 004 permission catalogue (fighter.measurement:write)';
  END IF;
END
$preflight$;

CREATE TYPE public.bout_status AS ENUM
  ('SCHEDULED', 'CAMP', 'FIGHT_WEEK', 'WEIGHED_IN', 'COMPLETED', 'CANCELLED');
CREATE TYPE public.bout_sport AS ENUM ('BOXING', 'MUAY_THAI', 'KICKBOXING', 'MMA');
CREATE TYPE public.bout_result AS ENUM ('WIN', 'LOSS', 'DRAW', 'NO_CONTEST');
CREATE TYPE public.bout_method AS ENUM ('KO', 'TKO', 'DECISION', 'SUBMISSION', 'DQ', 'OTHER');
CREATE TYPE public.bout_requirement_status AS ENUM
  ('MISSING', 'PROVIDED', 'CONFIRMED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- competition_rulesets
-- created_by_id is NULL for the seeded system presets (no user exists at migration time).
-- ---------------------------------------------------------------------------
CREATE TABLE public.competition_rulesets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport public.bout_sport NOT NULL,
  organizer text,
  verified boolean NOT NULL DEFAULT false,
  source_note text,
  weight_classes jsonb NOT NULL,
  requirement_templates jsonb NOT NULL,
  fight_week_days smallint NOT NULL DEFAULT 7,
  requirements_due_days smallint NOT NULL DEFAULT 7,
  acute_window_days smallint NOT NULL DEFAULT 7,
  acute_loss_limit_pct_long numeric(4,1) NOT NULL DEFAULT 8.0,
  acute_loss_limit_pct_short numeric(4,1) NOT NULL DEFAULT 5.0,
  suspension_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_blocked_session_types public.session_type[] NOT NULL DEFAULT '{SPARRING}',
  rest_days_after_bout smallint NOT NULL DEFAULT 0,
  created_by_id uuid REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT ck_rulesets_name CHECK (btrim(name) <> ''),
  CONSTRAINT ck_rulesets_weight_classes CHECK (jsonb_typeof(weight_classes) = 'array'),
  CONSTRAINT ck_rulesets_requirement_templates CHECK (jsonb_typeof(requirement_templates) = 'array'),
  CONSTRAINT ck_rulesets_suspension_rules CHECK (jsonb_typeof(suspension_rules) = 'array'),
  CONSTRAINT ck_rulesets_days CHECK (
    fight_week_days >= 0 AND requirements_due_days >= 0
    AND acute_window_days >= 0 AND rest_days_after_bout >= 0
  ),
  CONSTRAINT ck_rulesets_acute_pct CHECK (
    acute_loss_limit_pct_long > 0 AND acute_loss_limit_pct_long <= 20
    AND acute_loss_limit_pct_short > 0 AND acute_loss_limit_pct_short <= 20
  )
);
CREATE UNIQUE INDEX uq_competition_rulesets_name
  ON public.competition_rulesets (lower(name)) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- bouts
-- ---------------------------------------------------------------------------
CREATE TABLE public.bouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fighter_id uuid NOT NULL REFERENCES public.fighters(id),
  coach_id uuid NOT NULL REFERENCES public.coaches(id),
  ruleset_id uuid NOT NULL REFERENCES public.competition_rulesets(id),
  event_name text NOT NULL,
  venue text,
  opponent_name text,
  weight_class_code text NOT NULL,
  weight_limit_kg numeric(5,2) NOT NULL,
  acute_loss_limit_pct numeric(4,1) NOT NULL,
  requirements_due_days smallint NOT NULL,
  weigh_in_at timestamptz NOT NULL,
  bout_at timestamptz NOT NULL,
  status public.bout_status NOT NULL DEFAULT 'SCHEDULED',
  training_plan_id uuid,
  official_weight_kg numeric(5,2),
  made_weight boolean,
  catchweight_kg numeric(5,2),
  hydration_check text,
  result public.bout_result,
  method public.bout_method,
  result_round smallint,
  knocked_down boolean,
  cancel_reason text,
  notes text,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_id uuid NOT NULL REFERENCES public.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  -- The plan must belong to the same fighter (training_plans has uq_plan_fighter(id, fighter_id)).
  CONSTRAINT fk_bout_plan_fighter FOREIGN KEY (training_plan_id, fighter_id)
    REFERENCES public.training_plans (id, fighter_id),
  CONSTRAINT ck_bouts_event_name CHECK (btrim(event_name) <> ''),
  CONSTRAINT ck_bouts_schedule CHECK (weigh_in_at < bout_at),
  CONSTRAINT ck_bouts_weight_limit CHECK (weight_limit_kg > 0),
  CONSTRAINT ck_bouts_acute_pct CHECK (acute_loss_limit_pct > 0 AND acute_loss_limit_pct <= 20),
  CONSTRAINT ck_bouts_requirements_due_days CHECK (requirements_due_days >= 0),
  CONSTRAINT ck_bouts_hydration CHECK (
    hydration_check IS NULL OR hydration_check IN ('NOT_APPLICABLE', 'PASSED', 'FAILED')
  ),
  CONSTRAINT ck_bouts_cancel_reason CHECK ((status = 'CANCELLED') = (cancel_reason IS NOT NULL)),
  CONSTRAINT ck_bouts_result CHECK ((status = 'COMPLETED') = (result IS NOT NULL)),
  CONSTRAINT ck_bouts_method CHECK ((status = 'COMPLETED') = (method IS NOT NULL)),
  CONSTRAINT ck_bouts_history CHECK (jsonb_typeof(history) = 'array')
);
CREATE UNIQUE INDEX uq_bouts_active_per_fighter
  ON public.bouts (fighter_id)
  WHERE status IN ('CAMP', 'FIGHT_WEEK', 'WEIGHED_IN') AND deleted_at IS NULL;
CREATE INDEX idx_bouts_fighter_weigh_in ON public.bouts (fighter_id, weigh_in_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_bouts_status_weigh_in ON public.bouts (status, weigh_in_at, id) WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- bout_requirements
-- validity_days is the template/coach validity used to derive valid_until (not in tech spec 2.4).
-- ---------------------------------------------------------------------------
CREATE TABLE public.bout_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text NOT NULL,
  required boolean NOT NULL,
  status public.bout_requirement_status NOT NULL DEFAULT 'MISSING',
  issued_on date,
  valid_until date,
  validity_days smallint,
  source text NOT NULL,
  status_reason text,
  updated_by_id uuid REFERENCES public.users(id),
  confirmed_by_id uuid REFERENCES public.users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_bout_requirements_code UNIQUE (bout_id, code),
  CONSTRAINT ck_bout_requirements_code CHECK (char_length(code) BETWEEN 1 AND 64),
  CONSTRAINT ck_bout_requirements_label CHECK (btrim(label) <> ''),
  CONSTRAINT ck_bout_requirements_source CHECK (source IN ('PRESET', 'COACH')),
  CONSTRAINT ck_bout_requirements_validity_days CHECK (validity_days IS NULL OR validity_days > 0),
  CONSTRAINT ck_bout_requirements_valid_until CHECK (
    status NOT IN ('PROVIDED', 'CONFIRMED') OR valid_until IS NOT NULL
  ),
  CONSTRAINT ck_bout_requirements_rejected_reason CHECK (
    status <> 'REJECTED' OR nullif(btrim(status_reason), '') IS NOT NULL
  ),
  CONSTRAINT ck_bout_requirements_period CHECK (
    issued_on IS NULL OR valid_until IS NULL OR valid_until >= issued_on
  )
);

-- Triggers: updated_at, audit, immutable fighter_id.
CREATE TRIGGER trg_competition_rulesets_updated_at BEFORE UPDATE
  ON public.competition_rulesets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bouts_updated_at BEFORE UPDATE
  ON public.bouts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_bout_requirements_updated_at BEFORE UPDATE
  ON public.bout_requirements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_bouts_context_immutable BEFORE UPDATE
  ON public.bouts FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id');

CREATE TRIGGER trg_competition_rulesets_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.competition_rulesets FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_bouts_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.bouts FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_bout_requirements_audit AFTER INSERT OR UPDATE OR DELETE
  ON public.bout_requirements FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- RLS on, no direct access for Supabase client roles (the backend is the only access path).
ALTER TABLE public.competition_rulesets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.competition_rulesets FROM PUBLIC, anon, authenticated;
ALTER TABLE public.bouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bouts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.bout_requirements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bout_requirements FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preset rulesets (sources: docs/FIGHT-CAMP-DOMAIN-RESEARCH.md sections 2 and 5)
-- ---------------------------------------------------------------------------
INSERT INTO public.competition_rulesets (
  name, sport, organizer, verified, source_note, weight_classes, requirement_templates,
  fight_week_days, requirements_due_days, acute_window_days,
  acute_loss_limit_pct_long, acute_loss_limit_pct_short,
  suspension_rules, default_blocked_session_types, rest_days_after_bout
) VALUES
(
  'MMA – VMMAF 2021', 'MMA', 'VMMAF', true,
  'Hạng cân theo Điều 7 và cân trước ngày thi 1 ngày theo Điều 9, Luật thi đấu Võ thuật tổng hợp VMMAF, QĐ 01/QĐ-LĐVTTHVN ngày 01/02/2021 (Nghiên cứu §2, §5). Hồ sơ và đình chỉ để trống vì luật giao cho điều lệ từng giải.',
  '[
    {"code":"44","label":"44 kg","limitKg":44},
    {"code":"48","label":"48 kg","limitKg":48},
    {"code":"52","label":"52 kg","limitKg":52},
    {"code":"56","label":"56 kg","limitKg":56},
    {"code":"60","label":"60 kg","limitKg":60},
    {"code":"65","label":"65 kg","limitKg":65},
    {"code":"70","label":"70 kg","limitKg":70},
    {"code":"77","label":"77 kg","limitKg":77},
    {"code":"84","label":"84 kg","limitKg":84},
    {"code":"93","label":"93 kg","limitKg":93},
    {"code":"120","label":"120 kg","limitKg":120},
    {"code":"120+","label":"Trên 120 kg","limitKg":null}
  ]'::jsonb,
  '[]'::jsonb,
  7, 7, 7, 8.0, 5.0,
  '[]'::jsonb,
  '{SPARRING,GRAPPLING}'::public.session_type[],
  0
),
(
  'Boxing nghiệp dư – AIBA (tham khảo)', 'BOXING', 'AIBA', false,
  'Hạng cân AIBA 2002 (suy ra từ QĐ 1502/QĐ-UBTDTT, cần đối chiếu điều khoản gốc) và quy tắc đình chỉ theo hướng dẫn y tế BSL áp dụng luật AIBA, mục 2.3 (Nghiên cứu §2, §5). Danh sách hồ sơ là mẫu tham khảo cho demo, chưa xác minh với ban tổ chức nào.',
  '[
    {"code":"48","label":"48 kg","limitKg":48},
    {"code":"51","label":"51 kg","limitKg":51},
    {"code":"54","label":"54 kg","limitKg":54},
    {"code":"57","label":"57 kg","limitKg":57},
    {"code":"60","label":"60 kg","limitKg":60},
    {"code":"63.5","label":"63,5 kg","limitKg":63.5},
    {"code":"67","label":"67 kg","limitKg":67},
    {"code":"71","label":"71 kg","limitKg":71},
    {"code":"75","label":"75 kg","limitKg":75},
    {"code":"81","label":"81 kg","limitKg":81},
    {"code":"91","label":"91 kg","limitKg":91},
    {"code":"91+","label":"Trên 91 kg","limitKg":null}
  ]'::jsonb,
  '[
    {"code":"HEALTH_CERT","label":"Giấy khám sức khỏe","required":true,"validityDays":180},
    {"code":"INSURANCE","label":"Bảo hiểm thi đấu","required":true,"validityDays":365},
    {"code":"FEDERATION_REG","label":"Đăng ký thi đấu với liên đoàn / ban tổ chức","required":true,"validityDays":365}
  ]'::jsonb,
  7, 7, 7, 8.0, 5.0,
  '[
    {"reason":["KO","TKO"],"minDays":30},
    {"reason":["KO","TKO"],"priorCount":1,"withinDays":90,"minDays":90},
    {"reason":["KO","TKO"],"priorCount":2,"withinDays":365,"minDays":365},
    {"loc":"UNDER_1_MIN","minDays":90},
    {"loc":"OVER_1_MIN","minDays":180}
  ]'::jsonb,
  '{SHADOW_BOXING,PAD_WORK,HEAVY_BAG,SPARRING,GRAPPLING,STRENGTH_CONDITIONING}'::public.session_type[],
  0
),
(
  'Tự nhập', 'MMA', NULL, false,
  'Không có dữ liệu sẵn: HLV nhập hạng cân, checklist hồ sơ và số ngày đình chỉ trên từng trận (Nghiên cứu §6).',
  '[]'::jsonb,
  '[]'::jsonb,
  7, 7, 7, 8.0, 5.0,
  '[]'::jsonb,
  '{}'::public.session_type[],
  0
);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
INSERT INTO public.permissions(code, name, resource, action, description) VALUES
  ('ruleset:read', 'Read competition rulesets', 'ruleset', 'read', 'List competition rulesets and presets'),
  ('bout:get_all', 'List bouts', 'bout', 'get_all', 'List bouts within the caller scope'),
  ('bout:read', 'Read bout', 'bout', 'read', 'Read one bout, its requirements and weight track'),
  ('bout:create', 'Create bout', 'bout', 'create', 'Create a bout for an assigned fighter'),
  ('bout:update', 'Update bout', 'bout', 'update', 'Edit a bout and move it through its lifecycle'),
  ('bout:result', 'Record bout result', 'bout', 'result', 'Record the result of a bout'),
  ('bout:requirement', 'Manage bout requirements', 'bout', 'requirement', 'Add, edit and remove bout paperwork checklist items');

INSERT INTO public.role_permissions(role, permission_id)
SELECT r.role::public.user_role, p.id FROM public.permissions p
CROSS JOIN (VALUES ('FIGHTER'), ('COACH'), ('DOCTOR'), ('ADMIN')) AS r(role)
WHERE (p.code = 'ruleset:read' AND r.role IN ('COACH', 'DOCTOR', 'ADMIN'))
   OR (p.code IN ('bout:get_all', 'bout:read'))
   OR (p.code IN ('bout:create', 'bout:update', 'bout:result', 'bout:requirement') AND r.role IN ('COACH', 'ADMIN'))
ON CONFLICT DO NOTHING;

-- Fighters log their own weight (the service limits FIGHTER to self + SELF_REPORTED).
-- Deliberately not granted to COACH: createMeasurement does not check coach assignment.
INSERT INTO public.role_permissions(role, permission_id)
SELECT 'FIGHTER'::public.user_role, p.id
FROM public.permissions p
WHERE p.code = 'fighter.measurement:write'
ON CONFLICT (role, permission_id) DO NOTHING;

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (24, '024_bouts.sql', nullif(current_setting('mma.migration_sha256', true), ''));
COMMIT;
