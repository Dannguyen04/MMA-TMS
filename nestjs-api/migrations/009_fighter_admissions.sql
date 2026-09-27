-- MMA-TMS 009: Fighter Admissions workflow.
-- Adds the GUEST application role, the admission application lifecycle
-- (submission -> coach assignment history -> entrance assessment -> admin
-- decision -> activation), and the admission permission catalogue.
-- PostgreSQL 15+ / Supabase. Forward-only. Does not modify migrations 001-008.
-- All DDL is transactional. Any drift/error rolls back this entire migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 9);

DO $preflight$
BEGIN
  IF to_regclass('public.users') IS NULL
     OR to_regclass('public.coaches') IS NULL
     OR to_regclass('public.fighters') IS NULL
     OR to_regclass('public.permissions') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('mma_private.migration_history') IS NULL
     OR to_regprocedure('public.update_updated_at()') IS NULL
     OR to_regprocedure('mma_private.reject_context_change()') IS NULL
     OR to_regprocedure('mma_private.reject_history_mutation()') IS NULL
     OR to_regprocedure('mma_private.guard_assignment_history()') IS NULL
     OR to_regprocedure('mma_private.audit_domain_mutation()') IS NULL THEN
    RAISE EXCEPTION '009 requires the migration 003 baseline objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 8) THEN
    RAISE EXCEPTION '009 requires migration 008 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 9) THEN
    RAISE EXCEPTION '009 has already been applied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = to_regtype('public.user_role') AND enumlabel = 'GUEST'
  ) THEN
    RAISE EXCEPTION '009 expects public.user_role without GUEST';
  END IF;

  IF to_regtype('public.fighter_application_status') IS NOT NULL
     OR to_regtype('public.fighter_assessment_conclusion') IS NOT NULL
     OR to_regtype('public.fighter_decision') IS NOT NULL
     OR to_regtype('public.fighter_activation_status') IS NOT NULL
     OR to_regclass('public.fighter_applications') IS NOT NULL
     OR to_regclass('public.fighter_application_coach_assignments') IS NOT NULL
     OR to_regclass('public.fighter_application_assessments') IS NOT NULL
     OR to_regclass('public.fighter_application_decisions') IS NOT NULL
     OR to_regclass('public.fighter_application_activations') IS NOT NULL THEN
    RAISE EXCEPTION '009 admission type/table collision';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.permissions
    WHERE code = ANY (ARRAY[
      'fighter_application:get_all',
      'fighter_application:read',
      'fighter_application:evaluate'
    ])
  ) THEN
    RAISE EXCEPTION '009 API permission catalogue collision';
  END IF;
END
$preflight$;

-- GUEST is the pre-admission application role. PostgreSQL forbids using an enum
-- label added inside the current transaction, so nothing below references the
-- 'GUEST' literal: no default, check, cast, grant, or seed row. Application code
-- and any future GUEST-aware constraint use it only after this commit.
ALTER TYPE public.user_role ADD VALUE 'GUEST';

CREATE TYPE public.fighter_application_status AS ENUM (
    'SUBMITTED', 'FAILED', 'PASSED', 'REJECTED', 'APPROVED', 'ACTIVATED'
);

CREATE TYPE public.fighter_assessment_conclusion AS ENUM ('PASS', 'FAIL');

CREATE TYPE public.fighter_decision AS ENUM ('APPROVED', 'REJECTED');

CREATE TYPE public.fighter_activation_status AS ENUM (
    'PENDING', 'IN_PROGRESS', 'PASSWORD_SET', 'COMPLETED'
);

-- One row per admission attempt. The applicant identity snapshot is immutable and
-- carries every field required to create a valid Fighter profile at activation.
CREATE TABLE public.fighter_applications (
    id                      UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_user_id           UUID                        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    email                   TEXT                        NOT NULL CHECK (email = lower(btrim(email)) AND length(email) > 3),
    first_name              TEXT                        NOT NULL CHECK (length(btrim(first_name)) > 0),
    last_name               TEXT                        NOT NULL CHECK (length(btrim(last_name)) > 0),
    date_of_birth           DATE                        NOT NULL,
    weight_class            weight_class                NOT NULL,
    nationality             TEXT,
    contact_phone           TEXT,
    training_background     TEXT,
    competition_background  TEXT,
    motivation              TEXT,
    status                  fighter_application_status  NOT NULL DEFAULT 'SUBMITTED',
    submitted_at            TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_fighter_application_guest UNIQUE (id, guest_user_id)
);

-- At most one open attempt per applicant; FAILED/REJECTED/ACTIVATED rows stay as history.
CREATE UNIQUE INDEX uq_fighter_application_open
    ON public.fighter_applications (guest_user_id)
    WHERE status IN ('SUBMITTED', 'PASSED', 'APPROVED');
CREATE INDEX idx_fighter_applications_status
    ON public.fighter_applications (status, submitted_at DESC);
CREATE INDEX idx_fighter_applications_guest
    ON public.fighter_applications (guest_user_id, submitted_at DESC);

-- Coach assignment is temporal history, mirroring public.coach_fighters: a
-- reassignment closes the open episode and inserts a new one.
CREATE TABLE public.fighter_application_coach_assignments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID        NOT NULL REFERENCES fighter_applications(id) ON DELETE RESTRICT,
    coach_id        UUID        NOT NULL REFERENCES coaches(id) ON DELETE RESTRICT,
    assigned_by_id  UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ends_at         TIMESTAMPTZ,
    ended_by_id     UUID        REFERENCES users(id) ON DELETE RESTRICT,
    end_reason      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_application_assignment_period CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT ck_application_assignment_closure CHECK (
        (ends_at IS NULL AND ended_by_id IS NULL AND end_reason IS NULL)
        OR (ends_at IS NOT NULL AND ended_by_id IS NOT NULL AND nullif(btrim(end_reason), '') IS NOT NULL)),
    CONSTRAINT uq_application_assignment_context UNIQUE (id, application_id),
    CONSTRAINT uq_application_assignment_coach UNIQUE (id, coach_id)
);

CREATE UNIQUE INDEX uq_application_assignment_open
    ON public.fighter_application_coach_assignments (application_id)
    WHERE ends_at IS NULL;
CREATE INDEX idx_application_assignment_coach_open
    ON public.fighter_application_coach_assignments (coach_id)
    WHERE ends_at IS NULL;

-- One submitted entrance assessment per application. Criteria are stored inside the
-- same append-only row, so no criterion can be added after the conclusion is recorded.
CREATE TABLE public.fighter_application_assessments (
    id              UUID                            PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID                            NOT NULL UNIQUE REFERENCES fighter_applications(id) ON DELETE RESTRICT,
    assignment_id   UUID                            NOT NULL REFERENCES fighter_application_coach_assignments(id) ON DELETE RESTRICT,
    coach_id        UUID                            NOT NULL REFERENCES coaches(id) ON DELETE RESTRICT,
    conclusion      fighter_assessment_conclusion   NOT NULL,
    summary         TEXT                            NOT NULL CHECK (length(btrim(summary)) > 0),
    criteria        JSONB                           NOT NULL CHECK (
                        jsonb_typeof(criteria) = 'array'
                        AND jsonb_array_length(criteria) BETWEEN 1 AND 30),
    assessed_at     TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ                     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_assessment_application UNIQUE (id, application_id),
    CONSTRAINT fk_assessment_assignment_application FOREIGN KEY (assignment_id, application_id)
        REFERENCES fighter_application_coach_assignments(id, application_id) ON DELETE RESTRICT,
    CONSTRAINT fk_assessment_assignment_coach FOREIGN KEY (assignment_id, coach_id)
        REFERENCES fighter_application_coach_assignments(id, coach_id) ON DELETE RESTRICT
);

CREATE INDEX idx_assessment_coach ON public.fighter_application_assessments (coach_id, assessed_at DESC);

-- One final admin decision per application; only a PASS assessment is eligible.
CREATE TABLE public.fighter_application_decisions (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id  UUID                NOT NULL UNIQUE REFERENCES fighter_applications(id) ON DELETE RESTRICT,
    assessment_id   UUID                NOT NULL REFERENCES fighter_application_assessments(id) ON DELETE RESTRICT,
    admin_id        UUID                NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision        fighter_decision    NOT NULL,
    reason          TEXT                NOT NULL CHECK (length(btrim(reason)) > 0),
    decided_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_decision_application UNIQUE (id, application_id),
    CONSTRAINT fk_decision_assessment_application FOREIGN KEY (assessment_id, application_id)
        REFERENCES fighter_application_assessments(id, application_id) ON DELETE RESTRICT
);

CREATE INDEX idx_decision_admin ON public.fighter_application_decisions (admin_id, decided_at DESC);

-- Activation tracks the approved applicant's password-recovery lifecycle. It never
-- stores a password, recovery token, or any other credential material.
-- attempted_at records that a send was tried; accepted_at records only that the
-- provider accepted the request, which is not proof of delivery.
CREATE TABLE public.fighter_application_activations (
    id                  UUID                        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id      UUID                        NOT NULL UNIQUE REFERENCES fighter_applications(id) ON DELETE RESTRICT,
    decision_id         UUID                        NOT NULL REFERENCES fighter_application_decisions(id) ON DELETE RESTRICT,
    guest_user_id       UUID                        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status              fighter_activation_status   NOT NULL DEFAULT 'PENDING',
    recovery_attempts   INTEGER                     NOT NULL DEFAULT 0 CHECK (recovery_attempts >= 0),
    attempted_at        TIMESTAMPTZ,
    accepted_at         TIMESTAMPTZ,
    password_set_at     TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ                 NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_activation_application_guest FOREIGN KEY (application_id, guest_user_id)
        REFERENCES fighter_applications(id, guest_user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_activation_decision_application FOREIGN KEY (decision_id, application_id)
        REFERENCES fighter_application_decisions(id, application_id) ON DELETE RESTRICT,
    CONSTRAINT ck_activation_lifecycle CHECK (
        (status = 'COMPLETED') = (completed_at IS NOT NULL)
        AND (status IN ('PASSWORD_SET', 'COMPLETED')) = (password_set_at IS NOT NULL)
        AND (accepted_at IS NULL OR attempted_at IS NOT NULL)
        AND (completed_at IS NULL OR password_set_at IS NULL OR completed_at >= password_set_at))
);

CREATE INDEX idx_activation_status ON public.fighter_application_activations (status, updated_at DESC);
CREATE INDEX idx_activation_guest ON public.fighter_application_activations (guest_user_id);

-- Applications are historical records; only the declared lifecycle transitions apply.
CREATE FUNCTION mma_private.guard_fighter_application_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Fighter applications are historical; close the attempt instead of deleting' USING ERRCODE='23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'SUBMITTED' AND NEW.status IN ('FAILED', 'PASSED'))
    OR (OLD.status = 'PASSED'    AND NEW.status IN ('REJECTED', 'APPROVED'))
    OR (OLD.status = 'APPROVED'  AND NEW.status = 'ACTIVATED')
  ) THEN
    RAISE EXCEPTION 'Illegal fighter application transition % -> %', OLD.status, NEW.status USING ERRCODE='23514';
  END IF;
  IF OLD.status IN ('FAILED', 'REJECTED', 'ACTIVATED') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Closed fighter applications are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- The assigned coach is frozen once the entrance assessment has been submitted.
CREATE FUNCTION mma_private.guard_application_assignment() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.fighter_application_assessments a
    WHERE a.application_id = NEW.application_id
  ) THEN
    RAISE EXCEPTION 'Coach assignment cannot change after the entrance assessment is submitted' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- Only a PASS entrance assessment may receive an admin decision.
CREATE FUNCTION mma_private.guard_fighter_decision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.fighter_application_assessments a
    WHERE a.id = NEW.assessment_id AND a.conclusion = 'PASS' FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only a PASS entrance assessment can receive an admin decision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- Activation exists only for an approved application.
CREATE FUNCTION mma_private.guard_fighter_activation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.fighter_application_decisions d
    WHERE d.id = NEW.decision_id AND d.decision = 'APPROVED' FOR KEY SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Activation requires an APPROVED admin decision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

-- Activation advances PENDING -> IN_PROGRESS -> PASSWORD_SET -> COMPLETED. The single
-- legal backward edge releases a claim when the identity provider call did not change
-- the password, so the applicant can retry.
CREATE FUNCTION mma_private.guard_fighter_activation_status() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Activation records are historical and cannot be deleted' USING ERRCODE='23514';
  END IF;
  IF OLD.status = 'COMPLETED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Completed activations are immutable' USING ERRCODE='23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
       (OLD.status = 'PENDING'      AND NEW.status = 'IN_PROGRESS')
    OR (OLD.status = 'IN_PROGRESS'  AND NEW.status IN ('PASSWORD_SET', 'PENDING'))
    OR (OLD.status = 'PASSWORD_SET' AND NEW.status = 'COMPLETED')
  ) THEN
    RAISE EXCEPTION 'Illegal activation transition % -> %', OLD.status, NEW.status USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_fighter_applications_updated_at BEFORE UPDATE ON public.fighter_applications
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fighter_activations_updated_at BEFORE UPDATE ON public.fighter_application_activations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_fighter_applications_snapshot_immutable BEFORE UPDATE ON public.fighter_applications
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change(
        'guest_user_id', 'email', 'first_name', 'last_name', 'date_of_birth', 'weight_class', 'submitted_at');
CREATE TRIGGER trg_fighter_applications_status BEFORE UPDATE OR DELETE ON public.fighter_applications
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_fighter_application_status();

CREATE TRIGGER trg_application_assignment_context_immutable BEFORE UPDATE ON public.fighter_application_coach_assignments
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change(
        'application_id', 'coach_id', 'assigned_by_id', 'starts_at');
CREATE TRIGGER trg_application_assignment_history BEFORE UPDATE OR DELETE ON public.fighter_application_coach_assignments
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_assignment_history();
CREATE TRIGGER trg_application_assignment_locked BEFORE INSERT OR UPDATE ON public.fighter_application_coach_assignments
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_application_assignment();

CREATE TRIGGER trg_assessments_append_only BEFORE UPDATE OR DELETE ON public.fighter_application_assessments
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_assessments_no_truncate BEFORE TRUNCATE ON public.fighter_application_assessments
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

CREATE TRIGGER trg_decisions_eligibility BEFORE INSERT ON public.fighter_application_decisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_fighter_decision();
CREATE TRIGGER trg_decisions_append_only BEFORE UPDATE OR DELETE ON public.fighter_application_decisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_decisions_no_truncate BEFORE TRUNCATE ON public.fighter_application_decisions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

CREATE TRIGGER trg_activations_eligibility BEFORE INSERT ON public.fighter_application_activations
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_fighter_activation();
CREATE TRIGGER trg_activations_context_immutable BEFORE UPDATE ON public.fighter_application_activations
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change(
        'application_id', 'decision_id', 'guest_user_id');
CREATE TRIGGER trg_activations_status BEFORE UPDATE OR DELETE ON public.fighter_application_activations
    FOR EACH ROW EXECUTE FUNCTION mma_private.guard_fighter_activation_status();

CREATE TRIGGER trg_fighter_applications_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_applications
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_application_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_application_coach_assignments
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_assessments_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_application_assessments
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_decisions_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_application_decisions
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_activations_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_application_activations
    FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- Defense in depth. The backend owns every admission read and write; no client role
-- may reach these tables directly.
ALTER TABLE public.fighter_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_applications FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_application_coach_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_application_coach_assignments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_application_assessments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_application_assessments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_application_decisions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_application_decisions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_application_activations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_application_activations FROM PUBLIC, anon, authenticated;

INSERT INTO public.permissions (code, name, resource, action, description)
VALUES
  ('fighter_application:get_all', 'List assigned fighter applications', 'fighter_application', 'get_all',
   'List fighter admission applications within the actor resource scope.'),
  ('fighter_application:read', 'Read fighter application', 'fighter_application', 'read',
   'Read one fighter admission application within the actor resource scope.'),
  ('fighter_application:evaluate', 'Submit entrance assessment', 'fighter_application', 'evaluate',
   'Submit the entrance assessment for an assigned fighter admission application.');

INSERT INTO public.role_permissions (role, permission_id)
SELECT 'ADMIN'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
  'fighter_application:get_all',
  'fighter_application:read',
  'fighter_application:evaluate'
]);

-- Coaches evaluate the applications they are assigned to; the owning use case still
-- verifies the open assignment for every request.
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'COACH'::public.user_role, p.id
FROM public.permissions AS p
WHERE p.code = ANY (ARRAY[
  'fighter_application:get_all',
  'fighter_application:read',
  'fighter_application:evaluate'
]);

-- The verified runner supplies the source checksum. Manual SQL execution keeps it NULL.
INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  9,
  '009_fighter_admissions.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
