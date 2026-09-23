-- 005_coaching_loop_and_constraints.sql
-- Migration: Add Coaching Loop Tables, Check Constraints, Partial Unique Indexes, and Append-Only Triggers

BEGIN;

-- 1. Action Assessments (Immutable Worker Output)
CREATE TABLE IF NOT EXISTS public.action_assessments (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID                NOT NULL REFERENCES public.ai_analyses(id) ON DELETE CASCADE,
    action_id           TEXT                NOT NULL,
    technique           TEXT                NOT NULL,
    limb_side           TEXT                NOT NULL,
    assessment_status   TEXT                NOT NULL,
    overall_score       INTEGER,
    grade               TEXT,
    confidence          DOUBLE PRECISION    NOT NULL DEFAULT 0.0,
    rubric_id           TEXT,
    evidence            JSONB               NOT NULL DEFAULT '{}'::jsonb,
    phases              JSONB               NOT NULL DEFAULT '{}'::jsonb,
    kinematic_features  JSONB               NOT NULL DEFAULT '{}'::jsonb,
    criteria_scores     JSONB               NOT NULL DEFAULT '{}'::jsonb,
    findings            JSONB               NOT NULL DEFAULT '[]'::jsonb,
    provenance          JSONB               NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    CONSTRAINT ck_action_assessment_status CHECK (assessment_status IN ('EVALUATED', 'NOT_EVALUATED', 'INSUFFICIENT_EVIDENCE', 'REJECTED')),
    CONSTRAINT ck_action_overall_score CHECK (overall_score IS NULL OR (overall_score >= 0 AND overall_score <= 100)),
    CONSTRAINT ck_action_confidence CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

CREATE INDEX IF NOT EXISTS idx_action_assessments_analysis ON public.action_assessments(analysis_id);
CREATE INDEX IF NOT EXISTS idx_action_assessments_action ON public.action_assessments(analysis_id, action_id);

-- 2. Action Finding Reviews (Coach Finding Approval/Rejection)
CREATE TABLE IF NOT EXISTS public.action_finding_reviews (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id         UUID                NOT NULL REFERENCES public.ai_analyses(id) ON DELETE CASCADE,
    action_id           TEXT                NOT NULL,
    finding_id          TEXT                NOT NULL,
    coach_id            UUID                NOT NULL REFERENCES public.coaches(id) ON DELETE RESTRICT,
    status              TEXT                NOT NULL,
    notes               TEXT,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    CONSTRAINT ck_finding_review_status CHECK (status IN ('approved', 'rejected', 'corrected', 'APPROVED', 'REJECTED', 'CORRECTED'))
);

CREATE INDEX IF NOT EXISTS idx_finding_reviews_analysis ON public.action_finding_reviews(analysis_id, finding_id);

-- 3. Technique References (Single Active Reference per Fighter & Technique)
CREATE TABLE IF NOT EXISTS public.technique_references (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id          UUID                NOT NULL REFERENCES public.fighters(id) ON DELETE RESTRICT,
    technique           TEXT                NOT NULL,
    action_id           TEXT                NOT NULL,
    video_id            UUID                NOT NULL REFERENCES public.videos(id) ON DELETE RESTRICT,
    session_id          UUID                REFERENCES public.training_sessions(id) ON DELETE SET NULL,
    selected_by_id      UUID                NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    status              TEXT                NOT NULL DEFAULT 'active',
    revoked_by_id       UUID                REFERENCES public.users(id) ON DELETE SET NULL,
    revoked_at          TIMESTAMPTZ,
    revoked_reason      TEXT,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    CONSTRAINT ck_reference_status CHECK (status IN ('active', 'revoked')),
    CONSTRAINT ck_reference_revocation CHECK (
        (status = 'active' AND revoked_at IS NULL AND revoked_by_id IS NULL) OR
        (status = 'revoked' AND revoked_at IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_technique_references_single_active
    ON public.technique_references (fighter_id, technique)
    WHERE status = 'active';

-- 4. Progress Snapshots (Longitudinal Tracking)
CREATE TABLE IF NOT EXISTS public.progress_snapshots (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id          UUID                NOT NULL REFERENCES public.fighters(id) ON DELETE RESTRICT,
    technique           TEXT                NOT NULL,
    session_id          UUID                NOT NULL REFERENCES public.training_sessions(id) ON DELETE RESTRICT,
    baseline_id         UUID                REFERENCES public.fighter_baselines(id) ON DELETE SET NULL,
    moving_avg_score    DOUBLE PRECISION,
    trend               TEXT,
    sample_count        INTEGER             NOT NULL DEFAULT 0,
    metrics             JSONB               NOT NULL DEFAULT '{}'::jsonb,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
    CONSTRAINT ck_snapshot_moving_avg CHECK (moving_avg_score IS NULL OR (moving_avg_score >= 0.0 AND moving_avg_score <= 100.0)),
    CONSTRAINT ck_snapshot_samples CHECK (sample_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_fighter ON public.progress_snapshots(fighter_id, technique);

-- 5. Partial Unique Index on Fighter Baselines for Single Active Baseline
CREATE UNIQUE INDEX IF NOT EXISTS idx_fighter_baselines_single_active
    ON public.fighter_baselines (fighter_id, technique_type)
    WHERE is_active = TRUE;

-- 6. Immutability Triggers (Append-Only Enforcement)

-- Trigger for audit_logs
CREATE OR REPLACE FUNCTION public.fn_audit_logs_append_only()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are strictly append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_audit_logs_append_only ON public.audit_logs;
CREATE TRIGGER tr_audit_logs_append_only
    BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.fn_audit_logs_append_only();

-- Trigger for coach_reviews
CREATE OR REPLACE FUNCTION public.fn_coach_reviews_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Coach reviews are immutable; create a new revision with supersedes_id';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_coach_reviews_immutable ON public.coach_reviews;
CREATE TRIGGER tr_coach_reviews_immutable
    BEFORE UPDATE OR DELETE ON public.coach_reviews
    FOR EACH ROW EXECUTE FUNCTION public.fn_coach_reviews_immutable();

-- Trigger for action_assessments
CREATE OR REPLACE FUNCTION public.fn_action_assessments_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Action assessments are immutable worker artifacts';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_action_assessments_immutable ON public.action_assessments;
CREATE TRIGGER tr_action_assessments_immutable
    BEFORE UPDATE OR DELETE ON public.action_assessments
    FOR EACH ROW EXECUTE FUNCTION public.fn_action_assessments_immutable();

-- 7. Enable RLS on newly created tables
ALTER TABLE public.action_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_finding_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technique_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress_snapshots ENABLE ROW LEVEL SECURITY;

-- 8. Default Algorithm Config Seed
INSERT INTO public.algorithm_configs (
    id, version_tag, yolo_model_name, conf_threshold, ema_alpha, jerk_smooth_threshold,
    rom_low_threshold, rom_recovery_threshold, consecutive_low_rom_limit,
    window_sec_min, window_sec_max, disuse_sec_trigger, is_active, activated_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid, 'v1.0-default', 'yolov8x-pose',
    0.5, 0.5, 1.0, 0.5, 1.0, 1, 1, 2, 1, true, now()
) ON CONFLICT (id) DO NOTHING;

COMMIT;

