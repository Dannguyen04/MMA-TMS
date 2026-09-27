-- MMA-TMS 011: manual clinical Medical module (Doctor-authored records).
-- Adds medical examinations (decision separate from clearance), manual medical
-- review requests, content revision history for mutable clinical records,
-- DB-level no-delete/append-only protection, the assignment-scoped clinical
-- RLS predicate, and the Medical permission catalogue with role baselines.
-- AI tables (health_alerts, joint states/history, baselines) and
-- fighter_measurements keep their 003 policies unchanged: AI is deferred and
-- anthropometric measurements are outside this module.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-010.
-- All DDL is transactional. Any drift/error rolls back this entire migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 11);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.fighters') IS NULL
     OR to_regclass('public.sports_doctors') IS NULL
     OR to_regclass('public.doctor_fighters') IS NULL
     OR to_regclass('public.medical_clearances') IS NULL
     OR to_regclass('public.injury_records') IS NULL
     OR to_regclass('public.treatments') IS NULL
     OR to_regclass('public.recovery_plans') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.reject_context_change()') IS NULL
     OR to_regprocedure('mma_private.reject_history_mutation()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL THEN
    RAISE EXCEPTION '011 requires the migration 003 baseline objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 10) THEN
    RAISE EXCEPTION '011 requires migration 010 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 11) THEN
    RAISE EXCEPTION '011 has already been applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = to_regtype('public.user_role') AND enumlabel = 'GUEST'
  ) THEN
    RAISE EXCEPTION '011 requires the GUEST role added by 009';
  END IF;

  IF to_regtype('public.medical_examination_scope') IS NOT NULL
     OR to_regtype('public.medical_examination_decision') IS NOT NULL
     OR to_regtype('public.medical_review_request_status') IS NOT NULL
     OR to_regtype('public.medical_revision_source') IS NOT NULL
     OR to_regclass('public.medical_examinations') IS NOT NULL
     OR to_regclass('public.medical_review_requests') IS NOT NULL
     OR to_regclass('public.injury_record_revisions') IS NOT NULL
     OR to_regclass('public.recovery_plan_revisions') IS NOT NULL
     OR to_regclass('public.medical_clearance_revisions') IS NOT NULL
     OR to_regclass('public.medical_review_request_revisions') IS NOT NULL
     OR to_regprocedure('mma_private.can_read_fighter_clinical(uuid)') IS NOT NULL
     OR to_regprocedure('mma_private.bump_clinical_revision()') IS NOT NULL
     OR to_regprocedure('mma_private.record_clinical_revision()') IS NOT NULL
     OR to_regprocedure('mma_private.guard_medical_examination()') IS NOT NULL
     OR to_regprocedure('mma_private.apply_negative_examination()') IS NOT NULL
     OR to_regprocedure('mma_private.guard_medical_clearance()') IS NOT NULL
     OR to_regprocedure('mma_private.guard_injury_record()') IS NOT NULL
     OR to_regprocedure('mma_private.guard_recovery_plan()') IS NOT NULL
     OR to_regprocedure('mma_private.guard_medical_review_request()') IS NOT NULL THEN
    RAISE EXCEPTION '011 medical type/table/function collision';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'medical_clearances' AND column_name IN ('examination_id', 'revision'))
        OR (table_name = 'injury_records' AND column_name = 'revision')
        OR (table_name = 'recovery_plans' AND column_name = 'revision'))
  ) THEN
    RAISE EXCEPTION '011 clinical column collision';
  END IF;

  IF (
    SELECT count(*) FROM pg_policies
    WHERE schemaname = 'public' AND policyname = 'medical_read'
      AND tablename = ANY (ARRAY['medical_clearances', 'injury_records', 'treatments', 'recovery_plans'])
  ) <> 4 THEN
    RAISE EXCEPTION '011 expects the migration 003 medical_read policies on the clinical tables';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.permissions WHERE code = 'fighter.medical:read') THEN
    RAISE EXCEPTION '011 requires fighter.medical:read from migration 004';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = ANY (ARRAY[
      'fighter.medical:write',
      'fighter.medical_examination:create',
      'fighter.medical_clearance:issue',
      'fighter.medical_clearance:revoke',
      'fighter.medical_review_request:create',
      'fighter.doctor:read',
      'fighter.doctor:assign',
      'fighter.doctor:end',
      'doctor.fighter:get_all'
    ])
  ) THEN
    RAISE EXCEPTION '011 API permission catalogue collision';
  END IF;
END
$preflight$;

-- ── Types ──────────────────────────────────────────────────────────────────
CREATE TYPE public.medical_examination_scope AS ENUM ('TRAINING', 'COMPETITION');

-- ELIGIBLE_WITH_RESTRICTIONS is a positive decision; a clearance issued from it
-- must keep every restriction. NOT_ELIGIBLE never produces a clearance.
CREATE TYPE public.medical_examination_decision AS ENUM (
    'ELIGIBLE', 'ELIGIBLE_WITH_RESTRICTIONS', 'NOT_ELIGIBLE'
);

-- RESOLVED means a Doctor examination processed the request; it does not mean
-- the Fighter is eligible. The resolving examination decides eligibility.
CREATE TYPE public.medical_review_request_status AS ENUM ('OPEN', 'RESOLVED');

-- MIGRATION_BASELINE is the state captured when 011 ran, not a reconstructed
-- historical version and not a new Doctor decision.
CREATE TYPE public.medical_revision_source AS ENUM ('APPLICATION', 'MIGRATION_BASELINE');

-- ── Medical examinations (append-only decisions) ───────────────────────────
-- sequence_no is the server-owned issuance order used to find the current
-- decision per Fighter and scope; examined_at is the clinical time entered by
-- the Doctor and never overrides that order.
CREATE TABLE public.medical_examinations (
    id                      UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_no             BIGINT                          GENERATED ALWAYS AS IDENTITY,
    fighter_id              UUID                            NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    doctor_id               UUID                            NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    recorded_by_id          UUID                            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    scope                   medical_examination_scope       NOT NULL,
    decision                medical_examination_decision    NOT NULL,
    examined_at             TIMESTAMPTZ                     NOT NULL,
    reason                  TEXT                            NOT NULL,
    allowed_session_types   session_type[],
    allowed_technique_types technique_type[],
    excluded_joints         body_joint[],
    restriction_notes       TEXT,
    valid_until             TIMESTAMPTZ,
    supersedes_id           UUID,
    created_at              TIMESTAMPTZ                     NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_medical_examination_sequence UNIQUE (sequence_no),
    CONSTRAINT uq_medical_examination_fighter UNIQUE (id, fighter_id),
    CONSTRAINT uq_medical_examination_scope UNIQUE (id, fighter_id, scope),
    CONSTRAINT uq_medical_examination_successor UNIQUE (supersedes_id),
    CONSTRAINT ck_medical_examination_reason CHECK (length(btrim(reason)) > 0),
    CONSTRAINT ck_medical_examination_correction CHECK (supersedes_id <> id),
    CONSTRAINT ck_medical_examination_restrictions CHECK (
        (decision = 'ELIGIBLE_WITH_RESTRICTIONS') = (
            allowed_session_types IS NOT NULL OR allowed_technique_types IS NOT NULL
            OR excluded_joints IS NOT NULL OR restriction_notes IS NOT NULL)
        AND (allowed_session_types IS NULL OR cardinality(allowed_session_types) > 0)
        AND (allowed_technique_types IS NULL OR cardinality(allowed_technique_types) > 0)
        AND (excluded_joints IS NULL OR cardinality(excluded_joints) > 0)
        AND (restriction_notes IS NULL OR length(btrim(restriction_notes)) > 0)),
    CONSTRAINT ck_medical_examination_validity CHECK (
        (valid_until IS NULL OR valid_until > examined_at)
        AND (decision <> 'NOT_ELIGIBLE' OR valid_until IS NULL)),
    CONSTRAINT fk_medical_examination_correction FOREIGN KEY (supersedes_id, fighter_id, scope)
        REFERENCES medical_examinations(id, fighter_id, scope) ON DELETE RESTRICT
);

CREATE INDEX idx_medical_examination_fighter_scope
    ON public.medical_examinations (fighter_id, scope, sequence_no DESC);

-- ── Medical review requests (manual triggers for an examination) ───────────
CREATE TABLE public.medical_review_requests (
    id                          UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id                  UUID                            NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    requested_by_id             UUID                            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requester_role              user_role                       NOT NULL,
    reason                      TEXT                            NOT NULL,
    status                      medical_review_request_status   NOT NULL DEFAULT 'OPEN',
    requested_at                TIMESTAMPTZ                     NOT NULL DEFAULT clock_timestamp(),
    resolved_by_examination_id  UUID,
    resolved_at                 TIMESTAMPTZ,
    revision                    INTEGER                         NOT NULL DEFAULT 1,
    created_at                  TIMESTAMPTZ                     NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ                     NOT NULL DEFAULT now(),
    CONSTRAINT uq_medical_review_request_fighter UNIQUE (id, fighter_id),
    CONSTRAINT ck_medical_review_request_reason CHECK (length(btrim(reason)) > 0),
    CONSTRAINT ck_medical_review_request_requester CHECK (requester_role IN ('FIGHTER', 'COACH', 'DOCTOR')),
    CONSTRAINT ck_medical_review_request_revision CHECK (revision > 0),
    CONSTRAINT ck_medical_review_request_resolution CHECK (
        ((status = 'RESOLVED') = (resolved_by_examination_id IS NOT NULL))
        AND ((status = 'RESOLVED') = (resolved_at IS NOT NULL))
        AND (resolved_at IS NULL OR resolved_at >= requested_at)),
    CONSTRAINT fk_medical_review_request_examination FOREIGN KEY (resolved_by_examination_id, fighter_id)
        REFERENCES medical_examinations(id, fighter_id) ON DELETE RESTRICT
);

CREATE INDEX idx_medical_review_request_fighter_status
    ON public.medical_review_requests (fighter_id, status, requested_at DESC);

-- ── Existing clinical tables: revision counters and examination link ───────
ALTER TABLE public.medical_clearances
    ADD COLUMN examination_id UUID,
    ADD COLUMN revision INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_medical_clearances_revision CHECK (revision > 0),
    ADD CONSTRAINT uq_medical_clearance_fighter UNIQUE (id, fighter_id),
    ADD CONSTRAINT fk_medical_clearance_examination FOREIGN KEY (examination_id, fighter_id)
        REFERENCES public.medical_examinations(id, fighter_id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.medical_clearances.examination_id IS
  'Positive examination this clearance derives from. NULL only for clearances that existed before 011; those are kept as legacy records and never count toward eligibility.';

-- Retrying an issue command cannot create a second active clearance of the same type.
CREATE UNIQUE INDEX uq_medical_clearance_examination_active
    ON public.medical_clearances (examination_id, clearance_type)
    WHERE status = 'ACTIVE' AND examination_id IS NOT NULL;

ALTER TABLE public.injury_records
    ADD COLUMN revision INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_injury_records_revision CHECK (revision > 0);

ALTER TABLE public.recovery_plans
    ADD COLUMN revision INTEGER NOT NULL DEFAULT 1,
    ADD CONSTRAINT ck_recovery_plans_revision CHECK (revision > 0),
    ADD CONSTRAINT uq_recovery_plan_fighter UNIQUE (id, fighter_id);

-- ── Revision history (one table per mutable clinical record) ───────────────
-- Snapshots hold clinical content, so they live in these protected tables and
-- never in the shared audit_logs.
CREATE TABLE public.injury_record_revisions (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    injury_id           UUID                        NOT NULL,
    fighter_id          UUID                        NOT NULL,
    revision            INTEGER                     NOT NULL,
    source              medical_revision_source     NOT NULL,
    recorded_by_user_id UUID                        REFERENCES users(id) ON DELETE RESTRICT,
    snapshot            JSONB                       NOT NULL,
    recorded_at         TIMESTAMPTZ                 NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_injury_record_revision UNIQUE (injury_id, revision),
    CONSTRAINT ck_injury_record_revision_number CHECK (revision > 0),
    CONSTRAINT ck_injury_record_revision_snapshot CHECK (jsonb_typeof(snapshot) = 'object'),
    CONSTRAINT ck_injury_record_revision_actor CHECK ((source = 'APPLICATION') = (recorded_by_user_id IS NOT NULL)),
    CONSTRAINT fk_injury_record_revision_source FOREIGN KEY (injury_id, fighter_id)
        REFERENCES injury_records(id, fighter_id) ON DELETE RESTRICT
);
CREATE INDEX idx_injury_record_revisions_fighter ON public.injury_record_revisions (fighter_id, recorded_at DESC);

CREATE TABLE public.recovery_plan_revisions (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    recovery_plan_id    UUID                        NOT NULL,
    fighter_id          UUID                        NOT NULL,
    revision            INTEGER                     NOT NULL,
    source              medical_revision_source     NOT NULL,
    recorded_by_user_id UUID                        REFERENCES users(id) ON DELETE RESTRICT,
    snapshot            JSONB                       NOT NULL,
    recorded_at         TIMESTAMPTZ                 NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_recovery_plan_revision UNIQUE (recovery_plan_id, revision),
    CONSTRAINT ck_recovery_plan_revision_number CHECK (revision > 0),
    CONSTRAINT ck_recovery_plan_revision_snapshot CHECK (jsonb_typeof(snapshot) = 'object'),
    CONSTRAINT ck_recovery_plan_revision_actor CHECK ((source = 'APPLICATION') = (recorded_by_user_id IS NOT NULL)),
    CONSTRAINT fk_recovery_plan_revision_source FOREIGN KEY (recovery_plan_id, fighter_id)
        REFERENCES recovery_plans(id, fighter_id) ON DELETE RESTRICT
);
CREATE INDEX idx_recovery_plan_revisions_fighter ON public.recovery_plan_revisions (fighter_id, recorded_at DESC);

CREATE TABLE public.medical_clearance_revisions (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    clearance_id        UUID                        NOT NULL,
    fighter_id          UUID                        NOT NULL,
    revision            INTEGER                     NOT NULL,
    source              medical_revision_source     NOT NULL,
    recorded_by_user_id UUID                        REFERENCES users(id) ON DELETE RESTRICT,
    snapshot            JSONB                       NOT NULL,
    recorded_at         TIMESTAMPTZ                 NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_medical_clearance_revision UNIQUE (clearance_id, revision),
    CONSTRAINT ck_medical_clearance_revision_number CHECK (revision > 0),
    CONSTRAINT ck_medical_clearance_revision_snapshot CHECK (jsonb_typeof(snapshot) = 'object'),
    CONSTRAINT ck_medical_clearance_revision_actor CHECK ((source = 'APPLICATION') = (recorded_by_user_id IS NOT NULL)),
    CONSTRAINT fk_medical_clearance_revision_source FOREIGN KEY (clearance_id, fighter_id)
        REFERENCES medical_clearances(id, fighter_id) ON DELETE RESTRICT
);
CREATE INDEX idx_medical_clearance_revisions_fighter ON public.medical_clearance_revisions (fighter_id, recorded_at DESC);

CREATE TABLE public.medical_review_request_revisions (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    review_request_id   UUID                        NOT NULL,
    fighter_id          UUID                        NOT NULL,
    revision            INTEGER                     NOT NULL,
    source              medical_revision_source     NOT NULL,
    recorded_by_user_id UUID                        REFERENCES users(id) ON DELETE RESTRICT,
    snapshot            JSONB                       NOT NULL,
    recorded_at         TIMESTAMPTZ                 NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_medical_review_request_revision UNIQUE (review_request_id, revision),
    CONSTRAINT ck_medical_review_request_revision_number CHECK (revision > 0),
    CONSTRAINT ck_medical_review_request_revision_snapshot CHECK (jsonb_typeof(snapshot) = 'object'),
    CONSTRAINT ck_medical_review_request_revision_actor CHECK ((source = 'APPLICATION') = (recorded_by_user_id IS NOT NULL)),
    CONSTRAINT fk_medical_review_request_revision_source FOREIGN KEY (review_request_id, fighter_id)
        REFERENCES medical_review_requests(id, fighter_id) ON DELETE RESTRICT
);
CREATE INDEX idx_medical_review_request_revisions_fighter ON public.medical_review_request_revisions (fighter_id, recorded_at DESC);

-- Baseline: capture the state existing at migration time before the revision
-- triggers exist. Authored dates stay inside the snapshot; recorded_at is the
-- capture time. No Doctor is attributed to a baseline row.
INSERT INTO public.injury_record_revisions (injury_id, fighter_id, revision, source, snapshot)
SELECT i.id, i.fighter_id, i.revision, 'MIGRATION_BASELINE', to_jsonb(i) FROM public.injury_records AS i;
INSERT INTO public.recovery_plan_revisions (recovery_plan_id, fighter_id, revision, source, snapshot)
SELECT r.id, r.fighter_id, r.revision, 'MIGRATION_BASELINE', to_jsonb(r) FROM public.recovery_plans AS r;
INSERT INTO public.medical_clearance_revisions (clearance_id, fighter_id, revision, source, snapshot)
SELECT c.id, c.fighter_id, c.revision, 'MIGRATION_BASELINE', to_jsonb(c) FROM public.medical_clearances AS c;

-- ── Functions ──────────────────────────────────────────────────────────────
-- The revision counter is server-owned: 1 on insert, +1 on every update. The
-- UPDATE row lock serializes concurrent writers, so no version is lost.
CREATE FUNCTION mma_private.bump_clinical_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.revision := 1;
  ELSE
    NEW.revision := OLD.revision + 1;
  END IF;
  RETURN NEW;
END $$;

-- TG_ARGV[0] = revision table, TG_ARGV[1] = its source-record column. The
-- verified actor comes from the transaction-local audit context; a clinical
-- mutation without it fails closed.
CREATE FUNCTION mma_private.record_clinical_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE actor UUID;
BEGIN
  SELECT u.id INTO actor FROM public.users u
   WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active AND u.deleted_at IS NULL;
  IF actor IS NULL THEN
    RAISE EXCEPTION 'Clinical mutation of % requires a verified actor context', TG_TABLE_NAME USING ERRCODE='42501';
  END IF;
  EXECUTE format(
    'INSERT INTO public.%I (%I, fighter_id, revision, source, recorded_by_user_id, snapshot) VALUES ($1, $2, $3, ''APPLICATION'', $4, $5)',
    TG_ARGV[0], TG_ARGV[1])
  USING NEW.id, NEW.fighter_id, NEW.revision, actor, to_jsonb(NEW);
  RETURN NULL;
END $$;

-- A correction must supersede the current examination of the same Fighter and scope.
CREATE FUNCTION mma_private.guard_medical_examination() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE target_sequence BIGINT;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT e.sequence_no INTO target_sequence FROM public.medical_examinations e
     WHERE e.id = NEW.supersedes_id AND e.fighter_id = NEW.fighter_id AND e.scope = NEW.scope
     FOR KEY SHARE;
    IF NOT FOUND OR EXISTS (
      SELECT 1 FROM public.medical_examinations later
       WHERE later.fighter_id = NEW.fighter_id AND later.scope = NEW.scope
         AND later.sequence_no > target_sequence
    ) THEN
      RAISE EXCEPTION 'An examination correction must supersede the current examination of the same fighter and scope' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A NOT_ELIGIBLE decision invalidates every active clearance of the same scope
-- in the same transaction; the revoker and reason are the examining Doctor's.
CREATE FUNCTION mma_private.apply_negative_examination() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.decision = 'NOT_ELIGIBLE' THEN
    UPDATE public.medical_clearances c
       SET status = 'REVOKED', revoked_at = clock_timestamp(),
           revoked_by_id = NEW.doctor_id, revoked_reason = NEW.reason
     WHERE c.fighter_id = NEW.fighter_id
       AND c.status = 'ACTIVE'
       AND c.deleted_at IS NULL
       AND c.clearance_type = ANY (
         CASE WHEN NEW.scope = 'TRAINING'
           THEN ARRAY['TRAINING', 'RETURN_FROM_INJURY']::public.clearance_type[]
           ELSE ARRAY['COMPETITION']::public.clearance_type[]
         END);
  END IF;
  RETURN NULL;
END $$;

-- New clearances derive from the current positive examination and never widen
-- it. Issued terms are immutable; only ACTIVE -> REVOKED/EXPIRED may change.
CREATE FUNCTION mma_private.guard_medical_clearance() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  exam public.medical_examinations;
  lifecycle_keys TEXT[] :=ARRAY['status', 'revoked_at', 'revoked_by_id', 'revoked_reason', 'updated_at', 'revision'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.examination_id IS NULL THEN
      RAISE EXCEPTION 'New clearances must reference a positive examination' USING ERRCODE='23514';
    END IF;
    SELECT * INTO exam FROM public.medical_examinations e
     WHERE e.id = NEW.examination_id AND e.fighter_id = NEW.fighter_id FOR KEY SHARE;
    IF NOT FOUND
       OR exam.decision = 'NOT_ELIGIBLE'
       OR NEW.status <> 'ACTIVE'
       OR (exam.scope = 'TRAINING' AND NEW.clearance_type NOT IN ('TRAINING', 'RETURN_FROM_INJURY'))
       OR (exam.scope = 'COMPETITION' AND NEW.clearance_type <> 'COMPETITION')
       OR EXISTS (SELECT 1 FROM public.medical_examinations later
                   WHERE later.fighter_id = exam.fighter_id AND later.scope = exam.scope
                     AND later.sequence_no > exam.sequence_no)
       OR NEW.valid_from < exam.examined_at
       OR (exam.valid_until IS NOT NULL AND (NEW.valid_until IS NULL OR NEW.valid_until > exam.valid_until))
       OR (exam.allowed_session_types IS NOT NULL AND (NEW.allowed_session_types IS NULL OR NOT NEW.allowed_session_types <@ exam.allowed_session_types))
       OR (exam.allowed_technique_types IS NOT NULL AND (NEW.allowed_technique_types IS NULL OR NOT NEW.allowed_technique_types <@ exam.allowed_technique_types))
       OR (exam.excluded_joints IS NOT NULL AND (NEW.excluded_joints IS NULL OR NOT NEW.excluded_joints @> exam.excluded_joints)) THEN
      RAISE EXCEPTION 'Clearance must derive from the current positive examination without widening it' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Revoked or expired clearances are immutable' USING ERRCODE='23514';
  END IF;
  IF (to_jsonb(OLD) - lifecycle_keys) IS DISTINCT FROM (to_jsonb(NEW) - lifecycle_keys) THEN
    RAISE EXCEPTION 'Issued clearance terms are immutable; issue a new clearance' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- Final statuses stay final; content corrections remain possible and are
-- versioned by the revision triggers.
CREATE FUNCTION mma_private.guard_injury_record() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status = 'RESOLVED' AND (NEW.status IS DISTINCT FROM OLD.status
                                  OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at) THEN
    RAISE EXCEPTION 'A resolved injury keeps its status; record a new injury for a recurrence' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION mma_private.guard_recovery_plan() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.status <> 'ACTIVE' AND (NEW.status IS DISTINCT FROM OLD.status
                                 OR NEW.actual_end_date IS DISTINCT FROM OLD.actual_end_date) THEN
    RAISE EXCEPTION 'A completed or cancelled recovery plan keeps its status and end date' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- OPEN -> RESOLVED only, by a TRAINING examination of the same Fighter that
-- took place no earlier than the request. Requests are never deleted.
CREATE FUNCTION mma_private.guard_medical_review_request() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Medical review requests are historical and cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF OLD.status = 'RESOLVED' THEN
    RAISE EXCEPTION 'Resolved medical review requests are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status = 'RESOLVED' THEN
    PERFORM 1 FROM public.medical_examinations e
     WHERE e.id = NEW.resolved_by_examination_id AND e.fighter_id = NEW.fighter_id
       AND e.scope = 'TRAINING' AND e.examined_at >= NEW.requested_at
     FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'A review request must be resolved by a later TRAINING examination of the same fighter' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Clinical read predicate for direct authenticated SELECT: the same matrix the
-- backend enforces. Effective permission follows the application precedence
-- (explicit user override wins, otherwise the role grant), then resource scope:
-- ADMIN all, FIGHTER self, COACH/DOCTOR through a currently effective assignment.
CREATE FUNCTION mma_private.can_read_fighter_clinical(target_fighter_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    JOIN public.permissions p ON p.code = 'fighter.medical:read'
    JOIN public.fighters f ON f.id = target_fighter_id AND f.deleted_at IS NULL
    WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active AND u.deleted_at IS NULL
      AND u.role <> 'GUEST'
      AND COALESCE(
        (SELECT up.is_granted FROM public.user_permissions up
          WHERE up.user_id = u.id AND up.permission_id = p.id),
        EXISTS (SELECT 1 FROM public.role_permissions rp
                 WHERE rp.role = u.role AND rp.permission_id = p.id))
      AND (
        u.role = 'ADMIN'
        OR (u.role = 'FIGHTER' AND f.user_id = u.id)
        OR (u.role = 'COACH' AND EXISTS (
          SELECT 1 FROM public.coaches c
          JOIN public.coach_fighters cf ON cf.coach_id = c.id
          WHERE c.user_id = u.id AND c.is_active AND c.deleted_at IS NULL
            AND cf.fighter_id = f.id AND cf.starts_at <= now()
            AND (cf.ends_at IS NULL OR cf.ends_at > now())))
        OR (u.role = 'DOCTOR' AND EXISTS (
          SELECT 1 FROM public.sports_doctors d
          JOIN public.doctor_fighters df ON df.doctor_id = d.id
          WHERE d.user_id = u.id AND d.is_active AND d.deleted_at IS NULL
            AND df.fighter_id = f.id AND df.starts_at <= now()
            AND (df.ends_at IS NULL OR df.ends_at > now())))
      )
  )
$$;

-- ── Triggers ───────────────────────────────────────────────────────────────
-- Examinations: append-only decisions with a guarded correction chain.
CREATE TRIGGER trg_medical_examinations_guard BEFORE INSERT ON public.medical_examinations
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_medical_examination();
CREATE TRIGGER trg_medical_examinations_negative AFTER INSERT ON public.medical_examinations
    FOR EACH ROW EXECUTE FUNCTION mma_private.apply_negative_examination();
CREATE TRIGGER trg_medical_examinations_append_only BEFORE UPDATE OR DELETE ON public.medical_examinations
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_examinations_no_truncate BEFORE TRUNCATE ON public.medical_examinations
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_examinations_audit AFTER INSERT OR UPDATE OR DELETE ON public.medical_examinations
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- Review requests: immutable submission, single OPEN -> RESOLVED transition.
CREATE TRIGGER trg_medical_review_requests_updated_at BEFORE UPDATE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_medical_review_requests_context_immutable BEFORE UPDATE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change(
        'fighter_id', 'requested_by_id', 'requester_role', 'reason', 'requested_at', 'created_at');
CREATE TRIGGER trg_medical_review_requests_guard BEFORE UPDATE OR DELETE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_medical_review_request();
CREATE TRIGGER trg_medical_review_requests_no_truncate BEFORE TRUNCATE ON public.medical_review_requests
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_review_requests_revision_bump BEFORE INSERT OR UPDATE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION mma_private.bump_clinical_revision();
CREATE TRIGGER trg_medical_review_requests_revision_record AFTER INSERT OR UPDATE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION mma_private.record_clinical_revision('medical_review_request_revisions', 'review_request_id');
CREATE TRIGGER trg_medical_review_requests_audit AFTER INSERT OR UPDATE OR DELETE ON public.medical_review_requests
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- Injury records: no delete/truncate/soft-delete, AI/context provenance frozen,
-- RESOLVED status final (content still correctable), every mutation versioned.
CREATE TRIGGER trg_injury_records_no_delete BEFORE DELETE ON public.injury_records
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_injury_records_no_truncate BEFORE TRUNCATE ON public.injury_records
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_injury_records_clinical_context BEFORE UPDATE ON public.injury_records
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change(
        'affected_joint', 'injury_type', 'occurred_at', 'trigger_video_id', 'trigger_time_ms',
        'source_alert_id', 'is_active', 'deleted_at', 'created_at');
CREATE TRIGGER trg_injury_records_guard BEFORE UPDATE ON public.injury_records
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_injury_record();
CREATE TRIGGER trg_injury_records_revision_bump BEFORE INSERT OR UPDATE ON public.injury_records
    FOR EACH ROW EXECUTE FUNCTION mma_private.bump_clinical_revision();
CREATE TRIGGER trg_injury_records_revision_record AFTER INSERT OR UPDATE ON public.injury_records
    FOR EACH ROW EXECUTE FUNCTION mma_private.record_clinical_revision('injury_record_revisions', 'injury_id');

-- Treatments: append-only at the database, not only by missing endpoints.
CREATE TRIGGER trg_treatments_append_only BEFORE UPDATE OR DELETE ON public.treatments
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_treatments_no_truncate BEFORE TRUNCATE ON public.treatments
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

-- Recovery plans: no delete/truncate/soft-delete, closed status/end date final, versioned.
CREATE TRIGGER trg_recovery_plans_no_delete BEFORE DELETE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_recovery_plans_no_truncate BEFORE TRUNCATE ON public.recovery_plans
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_recovery_plans_clinical_context BEFORE UPDATE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('start_date', 'deleted_at', 'created_at');
CREATE TRIGGER trg_recovery_plans_guard BEFORE UPDATE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_recovery_plan();
CREATE TRIGGER trg_recovery_plans_revision_bump BEFORE INSERT OR UPDATE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION mma_private.bump_clinical_revision();
CREATE TRIGGER trg_recovery_plans_revision_record AFTER INSERT OR UPDATE ON public.recovery_plans
    FOR EACH ROW EXECUTE FUNCTION mma_private.record_clinical_revision('recovery_plan_revisions', 'recovery_plan_id');

-- Clearances: no delete/truncate/soft-delete, examination-derived issuance,
-- immutable terms, versioned lifecycle.
CREATE TRIGGER trg_medical_clearances_no_delete BEFORE DELETE ON public.medical_clearances
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_clearances_no_truncate BEFORE TRUNCATE ON public.medical_clearances
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_clearances_guard BEFORE INSERT OR UPDATE ON public.medical_clearances
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_medical_clearance();
CREATE TRIGGER trg_medical_clearances_revision_bump BEFORE INSERT OR UPDATE ON public.medical_clearances
    FOR EACH ROW EXECUTE FUNCTION mma_private.bump_clinical_revision();
CREATE TRIGGER trg_medical_clearances_revision_record AFTER INSERT OR UPDATE ON public.medical_clearances
    FOR EACH ROW EXECUTE FUNCTION mma_private.record_clinical_revision('medical_clearance_revisions', 'clearance_id');

-- Revision history is append-only.
CREATE TRIGGER trg_injury_record_revisions_append_only BEFORE UPDATE OR DELETE ON public.injury_record_revisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_injury_record_revisions_no_truncate BEFORE TRUNCATE ON public.injury_record_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_recovery_plan_revisions_append_only BEFORE UPDATE OR DELETE ON public.recovery_plan_revisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_recovery_plan_revisions_no_truncate BEFORE TRUNCATE ON public.recovery_plan_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_clearance_revisions_append_only BEFORE UPDATE OR DELETE ON public.medical_clearance_revisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_clearance_revisions_no_truncate BEFORE TRUNCATE ON public.medical_clearance_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_review_request_revisions_append_only BEFORE UPDATE OR DELETE ON public.medical_review_request_revisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_review_request_revisions_no_truncate BEFORE TRUNCATE ON public.medical_review_request_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

-- ── RLS and grants ─────────────────────────────────────────────────────────
-- New tables are backend-only: no direct client access of any kind.
ALTER TABLE public.medical_examinations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_examinations FROM PUBLIC, anon, authenticated;
ALTER TABLE public.medical_review_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_review_requests FROM PUBLIC, anon, authenticated;
ALTER TABLE public.injury_record_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.injury_record_revisions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.recovery_plan_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recovery_plan_revisions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.medical_clearance_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_clearance_revisions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.medical_review_request_revisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_review_request_revisions FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION mma_private.bump_clinical_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.record_clinical_revision() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.guard_medical_examination() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.apply_negative_examination() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.guard_medical_clearance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.guard_injury_record() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.guard_recovery_plan() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.guard_medical_review_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION mma_private.can_read_fighter_clinical(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION mma_private.can_read_fighter_clinical(UUID) TO authenticated;

-- In-scope clinical tables move from the broad 003 predicate to the D1 matrix.
-- The 003 predicate and the AI/measurement policies that use it are untouched.
DROP POLICY medical_read ON public.medical_clearances;
DROP POLICY medical_read ON public.injury_records;
DROP POLICY medical_read ON public.treatments;
DROP POLICY medical_read ON public.recovery_plans;
CREATE POLICY clinical_read ON public.medical_clearances FOR SELECT TO authenticated
    USING (mma_private.can_read_fighter_clinical(fighter_id));
CREATE POLICY clinical_read ON public.injury_records FOR SELECT TO authenticated
    USING (mma_private.can_read_fighter_clinical(fighter_id));
CREATE POLICY clinical_read ON public.recovery_plans FOR SELECT TO authenticated
    USING (mma_private.can_read_fighter_clinical(fighter_id));
CREATE POLICY clinical_read ON public.treatments FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.injury_records i
             WHERE i.id = injury_id AND mma_private.can_read_fighter_clinical(i.fighter_id)));

-- ── Permission catalogue and role baselines ────────────────────────────────
INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('fighter.medical:write', 'Write fighter clinical records', 'fighter_medical_record', 'write',
   'Record injuries, treatments and recovery plans for a currently assigned Fighter. Does not cover examinations, clearances or assignments.'),
  ('fighter.medical_examination:create', 'Record medical examination decisions', 'fighter_medical_examination', 'create',
   'Record a TRAINING or COMPETITION examination decision for a currently assigned Fighter.'),
  ('fighter.medical_clearance:issue', 'Issue medical clearances', 'fighter_medical_clearance', 'issue',
   'Issue a clearance derived from the current positive examination of a currently assigned Fighter.'),
  ('fighter.medical_clearance:revoke', 'Revoke medical clearances', 'fighter_medical_clearance', 'revoke',
   'Revoke an active clearance of a currently assigned Fighter.'),
  ('fighter.medical_review_request:create', 'Request a medical review', 'fighter_medical_review_request', 'create',
   'Ask for a Doctor examination of a Fighter within the actor resource scope.'),
  ('fighter.doctor:read', 'Read fighter doctor assignments', 'fighter_doctor_assignment', 'read',
   'Read current and historical doctor assignments within the actor resource scope.'),
  ('fighter.doctor:assign', 'Assign fighter doctors', 'fighter_doctor_assignment', 'assign',
   'Create an immediately effective doctor assignment for a Fighter.'),
  ('fighter.doctor:end', 'End fighter doctor assignments', 'fighter_doctor_assignment', 'end',
   'End an active doctor assignment; a Doctor may end only their own assignment.'),
  ('doctor.fighter:get_all', 'List a doctor''s assigned fighters', 'doctor_fighter_roster', 'get_all',
   'List the Fighters currently assigned to a Doctor profile.');

-- Clinical writes are Doctor-only; ADMIN receives read and assignment
-- administration only. user_permissions is never touched.
INSERT INTO public.role_permissions (role, permission_id)
SELECT g.role::public.user_role, p.id
FROM (VALUES
  ('ADMIN',   'fighter.doctor:read'),
  ('ADMIN',   'fighter.doctor:assign'),
  ('ADMIN',   'fighter.doctor:end'),
  ('ADMIN',   'doctor.fighter:get_all'),
  ('DOCTOR',  'fighter.medical:read'),
  ('DOCTOR',  'fighter.medical:write'),
  ('DOCTOR',  'fighter.medical_examination:create'),
  ('DOCTOR',  'fighter.medical_clearance:issue'),
  ('DOCTOR',  'fighter.medical_clearance:revoke'),
  ('DOCTOR',  'fighter.medical_review_request:create'),
  ('DOCTOR',  'fighter.doctor:read'),
  ('DOCTOR',  'fighter.doctor:end'),
  ('DOCTOR',  'doctor.fighter:get_all'),
  ('COACH',   'fighter.medical:read'),
  ('COACH',   'fighter.medical_review_request:create'),
  ('COACH',   'fighter.doctor:read'),
  ('FIGHTER', 'fighter.medical:read'),
  ('FIGHTER', 'fighter.medical_review_request:create'),
  ('FIGHTER', 'fighter.doctor:read')
) AS g(role, code)
JOIN public.permissions AS p ON p.code = g.code
-- Idempotent for fighter.medical:read, which an operator may already have granted.
ON CONFLICT (role, permission_id) DO NOTHING;

COMMENT ON TABLE public.medical_examinations IS 'Append-only Doctor examination decisions. The highest sequence_no per fighter and scope is the current decision; corrections reference supersedes_id.';
COMMENT ON TABLE public.medical_review_requests IS 'Manual requests for a Doctor examination. An OPEN request blocks training until a TRAINING examination resolves it.';

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  11,
  '011_medical_clinical_records.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
