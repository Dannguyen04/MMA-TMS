-- MMA-TMS 016: examination details (type, vitals, per-area assessments,
-- recommendations/follow-up) and the baseline SCAT6 record.
-- One optional row per examination, written in the examination's transaction.
-- Examinations recorded before 016 keep no details row: they are NOT treated
-- as baseline and nothing is backfilled (no answers, no 0/normal values).
-- SCAT6 answers are stored as recorded and validated by the API against the
-- form version; scores are computed by the backend with a stored scoring
-- version so later algorithm changes never silently re-score old records.
-- Append-only like medical_examinations; the insert of the examination itself
-- is audited by 011. RLS/grants: backend-only, like every 011 clinical table.
-- Training now requires a BASELINE examination on file. Fighters who already
-- had a real TRAINING examination when 016 is applied are recorded once in
-- medical_baseline_exemptions so their existing records keep counting; a
-- Fighter never examined gets no exemption. No examination is fabricated.
-- Does not touch AI tables, fighter_measurements, or migrations 001-015.
-- PostgreSQL 15+ / Supabase. Forward-only.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260916, 16);

DO $preflight$
BEGIN
  IF to_regclass('mma_private.migration_history') IS NULL
     OR to_regclass('public.medical_examinations') IS NULL
     OR to_regprocedure('mma_private.reject_history_mutation()') IS NULL THEN
    RAISE EXCEPTION '016 requires the migration 003 and 011 medical objects';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 12) THEN
    RAISE EXCEPTION '016 requires migration 012 history';
  END IF;

  IF EXISTS (SELECT 1 FROM mma_private.migration_history WHERE version = 16) THEN
    RAISE EXCEPTION '016 has already been applied';
  END IF;

  IF to_regtype('public.medical_examination_type') IS NOT NULL
     OR to_regclass('public.medical_examination_details') IS NOT NULL
     OR to_regclass('public.medical_baseline_exemptions') IS NOT NULL THEN
    RAISE EXCEPTION '016 examination details collision';
  END IF;
END
$preflight$;

CREATE TYPE public.medical_examination_type AS ENUM (
  'BASELINE', 'ROUTINE', 'PRE_FIGHT', 'POST_INJURY', 'CONCUSSION_SCREEN', 'RETURN_TO_PLAY'
);

CREATE TABLE public.medical_examination_details (
    examination_id           UUID                        PRIMARY KEY,
    fighter_id               UUID                        NOT NULL,
    examination_type         medical_examination_type    NOT NULL,
    weight_kg                NUMERIC(5,2),
    resting_heart_rate       SMALLINT,
    blood_pressure_systolic  SMALLINT,
    blood_pressure_diastolic SMALLINT,
    temperature_c            NUMERIC(4,1),
    spo2_pct                 SMALLINT,
    hydration                TEXT,
    assessments              JSONB                       NOT NULL DEFAULT '[]'::jsonb,
    recommendations          TEXT,
    follow_up_date           DATE,
    scat6_form_version       TEXT,
    scat6_responses          JSONB,
    scat6_scoring_version    SMALLINT,
    scat6_scores             JSONB,
    created_at               TIMESTAMPTZ                 NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT fk_medical_examination_details_examination FOREIGN KEY (examination_id, fighter_id)
        REFERENCES public.medical_examinations(id, fighter_id) ON DELETE RESTRICT,
    -- Vitals are recorded together or not at all.
    CONSTRAINT ck_medical_examination_details_vitals CHECK (
        num_nulls(weight_kg, resting_heart_rate, blood_pressure_systolic,
                  blood_pressure_diastolic, temperature_c, spo2_pct, hydration) IN (0, 7)
        AND (weight_kg IS NULL OR weight_kg > 0)
        AND (resting_heart_rate IS NULL OR resting_heart_rate > 0)
        AND (blood_pressure_systolic IS NULL OR blood_pressure_systolic > 0)
        AND (blood_pressure_diastolic IS NULL OR blood_pressure_diastolic > 0)
        AND (temperature_c IS NULL OR temperature_c > 0)
        AND (spo2_pct IS NULL OR spo2_pct BETWEEN 0 AND 100)
        AND (hydration IS NULL OR hydration IN ('GOOD', 'FAIR', 'POOR'))),
    CONSTRAINT ck_medical_examination_details_text CHECK (
        jsonb_typeof(assessments) = 'array'
        AND (recommendations IS NULL OR length(btrim(recommendations)) > 0)),
    -- A baseline always carries its SCAT6 record (administered or recorded as
    -- not administered with a reason); other types never do. Scores exist
    -- only with responses and always with their scoring version.
    CONSTRAINT ck_medical_examination_details_scat6 CHECK (
        num_nulls(scat6_form_version, scat6_responses) IN (0, 2)
        AND num_nulls(scat6_scoring_version, scat6_scores) IN (0, 2)
        AND (scat6_scores IS NULL OR scat6_responses IS NOT NULL)
        AND ((examination_type = 'BASELINE') = (scat6_responses IS NOT NULL))
        AND (scat6_form_version IS NULL OR length(btrim(scat6_form_version)) > 0)
        AND (scat6_responses IS NULL OR jsonb_typeof(scat6_responses) = 'object')
        AND (scat6_scores IS NULL OR jsonb_typeof(scat6_scores) = 'object'))
);

CREATE INDEX idx_medical_examination_details_fighter
    ON public.medical_examination_details (fighter_id, examination_type);

CREATE TRIGGER trg_medical_examination_details_append_only BEFORE UPDATE OR DELETE ON public.medical_examination_details
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_examination_details_no_truncate BEFORE TRUNCATE ON public.medical_examination_details
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

ALTER TABLE public.medical_examination_details ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_examination_details FROM PUBLIC, anon, authenticated;

-- One-time snapshot of Fighters examined for TRAINING before 016.
CREATE TABLE public.medical_baseline_exemptions (
    fighter_id   UUID         PRIMARY KEY REFERENCES public.fighters(id) ON DELETE RESTRICT,
    recorded_at  TIMESTAMPTZ  NOT NULL DEFAULT clock_timestamp()
);

INSERT INTO public.medical_baseline_exemptions (fighter_id)
SELECT DISTINCT e.fighter_id
  FROM public.medical_examinations e
 WHERE e.scope = 'TRAINING';

CREATE TRIGGER trg_medical_baseline_exemptions_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.medical_baseline_exemptions
    FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_medical_baseline_exemptions_no_truncate BEFORE TRUNCATE ON public.medical_baseline_exemptions
    FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

ALTER TABLE public.medical_baseline_exemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_baseline_exemptions FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.medical_baseline_exemptions IS 'Fighters with a real TRAINING examination recorded before migration 016; their existing records satisfy the before-training baseline requirement. Written once by 016; later inserts are rejected.';

COMMENT ON TABLE public.medical_examination_details IS 'Append-only details of one examination: type, vitals, per-area assessments, recommendations, and for BASELINE the SCAT6 record with backend-computed, versioned scores. Absent for examinations recorded before 016.';

INSERT INTO mma_private.migration_history(version, name, source_sha256)
VALUES (
  16,
  '016_medical_examination_details.sql',
  nullif(current_setting('mma.migration_sha256', true), '')
);

COMMIT;
