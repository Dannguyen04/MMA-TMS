-- MMA-TMS 003: incremental domain schema after 001 + 002.
-- PostgreSQL 15+ / Supabase. Apply ONCE with the migration owner, not an application role.
-- Does not run 001/002, seed data, backfill legacy payloads, or modify processing code.
-- All DDL is transactional. Any drift/error rolls back this entire migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SET LOCAL search_path = public, pg_catalog;
SELECT pg_catalog.pg_advisory_xact_lock(20260915, 3);

DO $preflight$
DECLARE expected RECORD; actual RECORD; labels TEXT[];
BEGIN
  IF to_regclass('public.analysis_jobs') IS NULL OR to_regprocedure('public.update_updated_at()') IS NULL THEN
    RAISE EXCEPTION '003 requires the unmodified 001 + 002 baseline';
  END IF;
  IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    RAISE EXCEPTION '003 requires Supabase auth.users, auth.uid(), anon and authenticated';
  END IF;
  SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder) INTO labels
  FROM pg_enum e WHERE e.enumtypid = to_regtype('public.job_status');
  IF labels IS DISTINCT FROM ARRAY['PENDING','PROCESSING','DONE','FAILED'] THEN
    RAISE EXCEPTION 'Baseline drift: public.job_status';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('id','uuid',true,'gen_random_uuid()'),
    ('user_id','text',true,'''anonymous''::text'),
    ('video_url','text',true,NULL),
    ('status','job_status',true,'''PENDING''::job_status'),
    ('result_url','text',false,NULL),
    ('score','integer',false,NULL),
    ('created_at','timestamp with time zone',true,'now()'),
    ('updated_at','timestamp with time zone',true,'now()'),
    ('health_alerts','jsonb',true,'''[]''::jsonb'),
    ('joint_states','jsonb',true,'''{}''::jsonb'),
    ('alert_count','integer',true,'0'),
    ('has_impairment','boolean',true,'false')
  ) AS x(name,type_name,required,default_expr) LOOP
    SELECT format_type(a.atttypid,a.atttypmod) AS type_name, a.attnotnull AS required,
      pg_get_expr(d.adbin,d.adrelid) AS default_expr INTO actual
    FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid='public.analysis_jobs'::regclass AND a.attname=expected.name AND NOT a.attisdropped;
    IF NOT FOUND OR actual.type_name IS DISTINCT FROM expected.type_name OR actual.required IS DISTINCT FROM expected.required
       OR actual.default_expr IS DISTINCT FROM expected.default_expr THEN
      RAISE EXCEPTION 'Baseline column drift: analysis_jobs.%', expected.name;
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.analysis_jobs'::regclass AND attnum>0 AND NOT attisdropped) <> 12 THEN
    RAISE EXCEPTION 'Baseline drift: unexpected analysis_jobs columns (003 may already have run)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.analysis_jobs'::regclass AND contype='p' AND pg_get_constraintdef(oid)='PRIMARY KEY (id)') THEN
    RAISE EXCEPTION 'Baseline drift: analysis_jobs primary key';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.analysis_jobs'::regclass AND tgname='set_updated_at'
    AND tgfoid='public.update_updated_at()'::regprocedure AND tgtype=19 AND tgenabled='O') THEN
    RAISE EXCEPTION 'Baseline drift: set_updated_at trigger';
  END IF;
  FOR expected IN SELECT * FROM (VALUES
    ('idx_analysis_jobs_user_id','btree (user_id)'),
    ('idx_analysis_jobs_status','btree (status)'),
    ('idx_analysis_jobs_health_alerts','gin (health_alerts)'),
    ('idx_analysis_jobs_has_impairment','btree (has_impairment) WHERE (has_impairment = true)')
  ) AS x(name,definition) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_indexes p JOIN pg_index i ON i.indexrelid=to_regclass('public.'||p.indexname)
      WHERE p.schemaname='public' AND p.tablename='analysis_jobs' AND p.indexname=expected.name
      AND p.indexdef LIKE '%USING '||expected.definition AND i.indisvalid AND i.indisready) THEN
      RAISE EXCEPTION 'Baseline index drift: %', expected.name;
    END IF;
  END LOOP;
END
$preflight$;

-- Namespace owned by this migration; a collision is drift and aborts the transaction.
CREATE SCHEMA mma_private;
REVOKE ALL ON SCHEMA mma_private FROM PUBLIC, anon, authenticated;
CREATE TABLE mma_private.migration_history (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  source_sha256 TEXT CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by TEXT NOT NULL DEFAULT current_user
);
REVOKE ALL ON mma_private.migration_history FROM PUBLIC, anon, authenticated;

-- Domain enums (job_status remains owned by 001).
CREATE TYPE user_role AS ENUM (
    'FIGHTER', 'COACH', 'DOCTOR', 'ADMIN'
);

CREATE TYPE weight_class AS ENUM (
    'STRAWWEIGHT', 'FLYWEIGHT', 'BANTAMWEIGHT', 'FEATHERWEIGHT', 'LIGHTWEIGHT',
    'WELTERWEIGHT', 'MIDDLEWEIGHT', 'LIGHT_HEAVYWEIGHT', 'HEAVYWEIGHT'
);

CREATE TYPE fighter_stance AS ENUM ('ORTHODOX', 'SOUTHPAW', 'SWITCH');

CREATE TYPE medical_status AS ENUM (
    'HEALTHY', 'MONITORING', 'RECOVERY', 'INJURED', 'NOT_CLEARED'
);

CREATE TYPE training_plan_status AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TYPE session_status AS ENUM (
    'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'CANCELLED', 'ABANDONED'
);

CREATE TYPE session_type AS ENUM (
    'SHADOW_BOXING', 'PAD_WORK', 'HEAVY_BAG', 'SPARRING', 'GRAPPLING',
    'STRENGTH_CONDITIONING', 'RECOVERY', 'PHYSICAL_THERAPY'
);

CREATE TYPE exercise_category AS ENUM (
    'STRIKING', 'GRAPPLING', 'STRENGTH_CONDITIONING', 'RECOVERY'
);

CREATE TYPE video_status AS ENUM (
    'PENDING_UPLOAD', 'UPLOAD_COMPLETE', 'PROCESSING', 'PROCESSED', 'REJECTED', 'FAILED'
);

CREATE TYPE camera_angle AS ENUM ('FRONT', 'SIDE', 'CORNER', 'OVERHEAD', 'UNKNOWN');

CREATE TYPE ai_analysis_status AS ENUM (
    'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'
);

CREATE TYPE anomaly_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');

CREATE TYPE body_joint AS ENUM (
    'LEFT_SHOULDER',  'RIGHT_SHOULDER',
    'LEFT_ELBOW',     'RIGHT_ELBOW',
    'LEFT_WRIST',     'RIGHT_WRIST',
    'LEFT_HIP',       'RIGHT_HIP',
    'LEFT_KNEE',      'RIGHT_KNEE',
    'LEFT_ANKLE',     'RIGHT_ANKLE',
    'SPINE_CORE'
);

CREATE TYPE joint_health_state AS ENUM (
    'HEALTHY', 'SUSPECTED', 'SUSPECTED_AVOIDANCE', 'CONFIRMED_IMPAIRMENT'
);

CREATE TYPE technique_type AS ENUM (
    'JAB', 'CROSS', 'LEAD_HOOK', 'REAR_HOOK',
    'LEAD_UPPERCUT', 'REAR_UPPERCUT',
    'LEAD_LOW_KICK', 'REAR_LOW_KICK',
    'LEAD_MIDDLE_KICK', 'REAR_MIDDLE_KICK',
    'LEAD_HIGH_KICK', 'REAR_HIGH_KICK',
    'FRONT_TEEP', 'SPINNING_BACK_FIST'
);

CREATE TYPE limb_side AS ENUM (
    'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'BILATERAL'
);

CREATE TYPE motion_class AS ENUM (
    'TACTICAL_FEINT', 'POWER_STRIKE', 'PARTIAL_STRIKE', 'UNKNOWN'
);

CREATE TYPE alert_severity AS ENUM ('MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE alert_review_decision AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED', 'ESCALATED');

CREATE TYPE clearance_type AS ENUM ('TRAINING', 'COMPETITION', 'RETURN_FROM_INJURY');

CREATE TYPE clearance_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TYPE injury_severity AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');

CREATE TYPE injury_status AS ENUM ('ACTIVE', 'RECOVERING', 'RESOLVED');

CREATE TYPE recovery_plan_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

CREATE TYPE notification_type AS ENUM (
    'ANOMALY_HIGH', 'ANOMALY_MEDIUM', 'SESSION_REMINDER',
    'MEDICAL_CLEARANCE_EXPIRY', 'VIDEO_PROCESSED', 'SYSTEM',
    'JOINT_IMPAIRMENT_CONFIRMED'
);

CREATE TABLE public.users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL CHECK (email = lower(btrim(email)) AND length(email) > 3),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    role            user_role       NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT uq_users_email UNIQUE (email),
    CONSTRAINT uq_users_id_role UNIQUE (id, role)
);

CREATE TABLE public.permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT            NOT NULL UNIQUE,
    name            TEXT            NOT NULL,
    resource        TEXT            NOT NULL,
    action          TEXT            NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    role            user_role       NOT NULL,
    permission_id   UUID            NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role, permission_id)
);

CREATE TABLE public.user_permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    permission_id   UUID            NOT NULL REFERENCES permissions(id) ON DELETE RESTRICT,
    is_granted      BOOLEAN         NOT NULL DEFAULT TRUE,
    granted_by      UUID            REFERENCES users(id) ON DELETE RESTRICT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_permission UNIQUE (user_id, permission_id)
);

CREATE TABLE public.fighters (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    first_name              TEXT            NOT NULL,
    last_name               TEXT            NOT NULL,
    date_of_birth           DATE            NOT NULL,
    nationality             TEXT,
    weight_class            weight_class    NOT NULL,
    height_cm               FLOAT           CHECK (height_cm > 0 AND height_cm < 300),
    reach_cm                FLOAT           CHECK (reach_cm > 0 AND reach_cm < 300),
    dominant_stance         fighter_stance,
    left_arm_cm             FLOAT           CHECK (left_arm_cm  > 0 AND left_arm_cm  < 150),
    right_arm_cm            FLOAT           CHECK (right_arm_cm > 0 AND right_arm_cm < 150),
    left_leg_cm             FLOAT           CHECK (left_leg_cm  > 0 AND left_leg_cm  < 150),
    right_leg_cm            FLOAT           CHECK (right_leg_cm > 0 AND right_leg_cm < 150),
    gym                     TEXT,
    current_medical_status  medical_status  NOT NULL DEFAULT 'NOT_CLEARED',
    bio                     TEXT,
    profile_image_url       TEXT,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    profile_role user_role NOT NULL DEFAULT 'FIGHTER' CHECK (profile_role = 'FIGHTER'),
    CONSTRAINT fk_fighters_role FOREIGN KEY (user_id, profile_role) REFERENCES users(id, role) ON DELETE RESTRICT
);

CREATE TABLE public.coaches (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    first_name          TEXT        NOT NULL,
    last_name           TEXT        NOT NULL,
    is_head_coach       BOOLEAN     NOT NULL DEFAULT FALSE,
    specialization      TEXT,
    profile_image_url   TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    profile_role user_role NOT NULL DEFAULT 'COACH' CHECK (profile_role = 'COACH'),
    CONSTRAINT fk_coaches_role FOREIGN KEY (user_id, profile_role) REFERENCES users(id, role) ON DELETE RESTRICT
);

CREATE TABLE public.sports_doctors (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    first_name          TEXT        NOT NULL,
    last_name           TEXT        NOT NULL,
    license_number      TEXT        NOT NULL UNIQUE,
    specialization      TEXT,
    profile_image_url   TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    profile_role user_role NOT NULL DEFAULT 'DOCTOR' CHECK (profile_role = 'DOCTOR'),
    CONSTRAINT fk_sports_doctors_role FOREIGN KEY (user_id, profile_role) REFERENCES users(id, role) ON DELETE RESTRICT
);

CREATE TABLE public.coach_fighters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE RESTRICT,
    fighter_id UUID NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    ended_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    end_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_coach_fighters_period CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT ck_coach_fighters_closure CHECK ((ends_at IS NULL AND ended_by_id IS NULL AND end_reason IS NULL) OR (ends_at IS NOT NULL AND ended_by_id IS NOT NULL AND nullif(btrim(end_reason), '') IS NOT NULL))
);

CREATE TABLE public.training_plans (
    id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id  UUID                    NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    coach_id    UUID                    NOT NULL REFERENCES coaches(id)  ON DELETE RESTRICT,
    title       TEXT                    NOT NULL,
    description TEXT,
    start_date  DATE                    NOT NULL,
    end_date    DATE,
    status      training_plan_status    NOT NULL DEFAULT 'DRAFT',
    goals       TEXT,
    is_active   BOOLEAN                 NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ,
    CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT uq_plan_fighter UNIQUE (id, fighter_id)
);

CREATE TABLE public.training_sessions (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)      ON DELETE RESTRICT,
    coach_id                UUID            REFERENCES coaches(id)                ON DELETE RESTRICT,
    plan_id                 UUID            REFERENCES training_plans(id)         ON DELETE RESTRICT,
    title                   TEXT            NOT NULL,
    scheduled_at            TIMESTAMPTZ     NOT NULL,
    planned_duration_sec    INTEGER         CHECK (planned_duration_sec > 0),
    actual_duration_sec     INTEGER         CHECK (actual_duration_sec > 0),
    round_count             SMALLINT        NOT NULL DEFAULT 0 CHECK (round_count >= 0),
    location                TEXT,
    session_type            session_type    NOT NULL,
    status                  session_status  NOT NULL DEFAULT 'SCHEDULED',
    coach_notes             TEXT,
    cancellation_reason     TEXT,
    checked_in_at           TIMESTAMPTZ,
    completed_at            TIMESTAMPTZ,
    abandoned_at            TIMESTAMPTZ,
    skipped_at              TIMESTAMPTZ,
    reported_rpe            SMALLINT        CHECK (reported_rpe BETWEEN 1 AND 10),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    CONSTRAINT uq_session_fighter UNIQUE (id, fighter_id),
    CONSTRAINT fk_session_plan_fighter FOREIGN KEY (plan_id, fighter_id) REFERENCES training_plans(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT ck_session_lifecycle CHECK (
      (status = 'COMPLETED') = (completed_at IS NOT NULL) AND
      (status = 'ABANDONED') = (abandoned_at IS NOT NULL) AND
      (status = 'SKIPPED') = (skipped_at IS NOT NULL) AND
      (status = 'CANCELLED') = (cancelled_at IS NOT NULL) AND
      (status <> 'IN_PROGRESS' OR checked_in_at IS NOT NULL)),
    CONSTRAINT ck_session_time_order CHECK (COALESCE(completed_at, abandoned_at, cancelled_at, skipped_at) >= checked_in_at)
);

CREATE TABLE public.session_rounds (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    round_number        SMALLINT    NOT NULL CHECK (round_number BETWEEN 1 AND 30),
    planned_duration_sec INTEGER    CHECK (planned_duration_sec > 0),
    target_rpe          SMALLINT    CHECK (target_rpe BETWEEN 1 AND 10),
    actual_rpe          SMALLINT    CHECK (actual_rpe BETWEEN 1 AND 10),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_round_number UNIQUE (session_id, round_number),
    CONSTRAINT uq_round_session UNIQUE (id, session_id)
);

CREATE TABLE public.exercises (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    name                TEXT                NOT NULL,
    description         TEXT,
    category            exercise_category   NOT NULL,
    target_muscle_groups TEXT[]             NOT NULL DEFAULT '{}',
    video_url           TEXT,
    thumbnail_url       TEXT,
    is_active           BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE TABLE public.session_exercises (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT ,
    exercise_id      UUID        NOT NULL REFERENCES exercises(id)          ON DELETE RESTRICT,
    order_index      INTEGER     NOT NULL CHECK (order_index >= 0),
    sets             INTEGER     CHECK (sets > 0),
    reps             INTEGER     CHECK (reps > 0),
    duration_seconds INTEGER     CHECK (duration_seconds > 0),
    target_rpe       SMALLINT    CHECK (target_rpe BETWEEN 1 AND 10),
    coach_notes      TEXT,
    CONSTRAINT uq_session_exercise_order UNIQUE (session_id, order_index),
    exercise_name_snapshot TEXT NOT NULL,
    exercise_instructions_snapshot TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.algorithm_configs (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag                 TEXT        NOT NULL UNIQUE,
    yolo_model_name             TEXT        NOT NULL,
    conf_threshold              FLOAT       NOT NULL CHECK (conf_threshold BETWEEN 0.0 AND 1.0),
    ema_alpha                   FLOAT       NOT NULL CHECK (ema_alpha BETWEEN 0.0 AND 1.0),
    jerk_smooth_threshold       FLOAT       NOT NULL CHECK (jerk_smooth_threshold > 0),
    jerk_smooth_window          INTEGER     NOT NULL DEFAULT 3 CHECK (jerk_smooth_window > 0),
    min_feint_velocity_ratio    FLOAT       NOT NULL DEFAULT 0.20,
    rom_low_threshold           FLOAT       NOT NULL CHECK (rom_low_threshold > 0),
    rom_recovery_threshold      FLOAT       NOT NULL CHECK (rom_recovery_threshold > rom_low_threshold),
    consecutive_low_rom_limit   INTEGER     NOT NULL CHECK (consecutive_low_rom_limit > 0),
    window_sec_min              FLOAT       NOT NULL CHECK (window_sec_min > 0),
    window_sec_max              FLOAT       NOT NULL CHECK (window_sec_max > window_sec_min),
    disuse_sec_trigger          FLOAT       NOT NULL CHECK (disuse_sec_trigger > 0),
    tau_mahalanobis             FLOAT       DEFAULT 3.0 CHECK (tau_mahalanobis > 0),
    notes                       TEXT,
    is_active                   BOOLEAN     NOT NULL DEFAULT FALSE,
    activated_at                TIMESTAMPTZ,
    deprecated_at               TIMESTAMPTZ,
    created_by                  UUID        REFERENCES users(id) ON DELETE RESTRICT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_config_lifecycle CHECK ((NOT is_active OR (activated_at IS NOT NULL AND deprecated_at IS NULL)) AND (deprecated_at IS NULL OR (activated_at IS NOT NULL AND deprecated_at >= activated_at))),
    CONSTRAINT ck_config_feint_ratio CHECK (min_feint_velocity_ratio >= 0)
);

CREATE TABLE public.fighter_baselines (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)          ON DELETE RESTRICT,
    algorithm_config_id     UUID            NOT NULL REFERENCES algorithm_configs(id) ON DELETE RESTRICT,
    technique_type          technique_type  NOT NULL,
    limb_side               limb_side       NOT NULL,
    rom_baseline_deg        FLOAT           NOT NULL CHECK (rom_baseline_deg BETWEEN 0 AND 180),
    velocity_baseline       FLOAT           NOT NULL CHECK (velocity_baseline > 0),
    jerk_threshold          FLOAT           NOT NULL CHECK (jerk_threshold > 0),
    covariance_matrix       JSONB           NOT NULL DEFAULT '[]',
    sample_count            INTEGER         NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
    sample_sessions         INTEGER         NOT NULL DEFAULT 0,
    std_dev_rom             FLOAT,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    is_locked               BOOLEAN         NOT NULL DEFAULT FALSE,
    calculated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    source_description TEXT NOT NULL,
    approved_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ,
    CONSTRAINT uq_baseline_context UNIQUE (id, fighter_id, algorithm_config_id),
    CONSTRAINT ck_baseline_approval CHECK (is_locked = (approved_at IS NOT NULL) AND (approved_at IS NULL) = (approved_by_id IS NULL)),
    CONSTRAINT ck_baseline_expiry CHECK (expires_at IS NULL OR expires_at > calculated_at),
    CONSTRAINT ck_baseline_samples CHECK (sample_sessions >= 0 AND std_dev_rom >= 0),
    CONSTRAINT ck_baseline_covariance CHECK (jsonb_typeof(covariance_matrix) = 'array')
);

CREATE TABLE public.videos (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_fighter_id  UUID            NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    uploaded_by_id      UUID            NOT NULL REFERENCES users(id)    ON DELETE RESTRICT,
    session_id          UUID            REFERENCES training_sessions(id)  ON DELETE RESTRICT,
    title               TEXT            NOT NULL,
    description         TEXT,
    storage_key TEXT NOT NULL,
    storage_bucket TEXT NOT NULL,
    storage_provider TEXT NOT NULL,
    original_filename TEXT,
    codec TEXT,
    file_size_bytes     BIGINT          NOT NULL CHECK (file_size_bytes > 0),
    mime_type           TEXT            NOT NULL CHECK (mime_type LIKE 'video/%'),
    duration_ms         INTEGER         CHECK (duration_ms > 0),
    fps                 FLOAT           CHECK (fps > 0 AND fps <= 240),
    resolution_width    INTEGER         CHECK (resolution_width > 0),
    resolution_height   INTEGER         CHECK (resolution_height > 0),
    camera_angle        camera_angle    NOT NULL DEFAULT 'UNKNOWN',
    status              video_status    NOT NULL DEFAULT 'PENDING_UPLOAD',
    rejection_reason    TEXT,
    thumbnail_url       TEXT,
    recorded_at         TIMESTAMPTZ,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT uq_video_storage UNIQUE (storage_provider, storage_bucket, storage_key),
    CONSTRAINT ck_video_storage CHECK (length(btrim(storage_provider)) > 0 AND length(btrim(storage_bucket)) > 0 AND length(btrim(storage_key)) > 0),
    CONSTRAINT uq_video_fighter UNIQUE (id, subject_fighter_id),
    CONSTRAINT uq_video_session UNIQUE (id, session_id),
    CONSTRAINT fk_video_session_fighter FOREIGN KEY (session_id, subject_fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT
);

CREATE TABLE public.ai_analyses (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id                UUID                NOT NULL REFERENCES videos(id)             ON DELETE RESTRICT ,
    algorithm_config_id     UUID                NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    status                  ai_analysis_status  NOT NULL DEFAULT 'QUEUED',
    confidence_score        FLOAT               CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    requires_review         BOOLEAN             NOT NULL DEFAULT FALSE,
    anomaly_level           anomaly_level,
    footwork_score          FLOAT               CHECK (footwork_score BETWEEN 0 AND 100),
    guard_score             FLOAT               CHECK (guard_score BETWEEN 0 AND 100),
    head_movement_score     FLOAT               CHECK (head_movement_score BETWEEN 0 AND 100),
    style_profile           JSONB,
    clip_urls               TEXT[]              NOT NULL DEFAULT '{}',
    processing_started_at   TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    job_id UUID NOT NULL UNIQUE REFERENCES analysis_jobs(id) ON DELETE RESTRICT,
    fighter_id UUID NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    session_id UUID REFERENCES training_sessions(id) ON DELETE RESTRICT,
    result_schema_version TEXT,
    result_storage_key TEXT,
    CONSTRAINT uq_analysis_video UNIQUE (video_id),
    CONSTRAINT uq_analysis_fighter UNIQUE (id, fighter_id),
    CONSTRAINT uq_analysis_context UNIQUE (id, fighter_id, algorithm_config_id),
    CONSTRAINT uq_analysis_session UNIQUE (id, session_id),
    CONSTRAINT uq_analysis_video_context UNIQUE (id, video_id),
    CONSTRAINT fk_analysis_video_fighter FOREIGN KEY (video_id, fighter_id) REFERENCES videos(id, subject_fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_analysis_video_session FOREIGN KEY (video_id, session_id) REFERENCES videos(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT ck_analysis_processing_time CHECK (processing_completed_at IS NULL OR (processing_started_at IS NOT NULL AND processing_completed_at >= processing_started_at))
);

CREATE TABLE public.coach_reviews (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id             UUID        NOT NULL REFERENCES ai_analyses(id) ON DELETE RESTRICT,
    coach_id                UUID        NOT NULL REFERENCES coaches(id)     ON DELETE RESTRICT,
    review_text             TEXT        NOT NULL,
    technique_rating        SMALLINT    CHECK (technique_rating BETWEEN 1 AND 10),
    corrected_strike_counts JSONB,
    overrides_ai            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    supersedes_id UUID REFERENCES coach_reviews(id) ON DELETE RESTRICT,
    CONSTRAINT uq_review_revision UNIQUE (analysis_id, coach_id, revision),
    CONSTRAINT uq_review_chain UNIQUE (id, analysis_id, coach_id),
    CONSTRAINT uq_review_successor UNIQUE (supersedes_id),
    CONSTRAINT fk_review_predecessor FOREIGN KEY (supersedes_id, analysis_id, coach_id) REFERENCES coach_reviews(id, analysis_id, coach_id) ON DELETE RESTRICT,
    CONSTRAINT ck_review_revision CHECK ((revision = 1) = (supersedes_id IS NULL) AND supersedes_id IS DISTINCT FROM id),
    CONSTRAINT ck_review_counts CHECK (corrected_strike_counts IS NULL OR jsonb_typeof(corrected_strike_counts) = 'object')
);

CREATE TABLE public.technique_events (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id             UUID            NOT NULL REFERENCES ai_analyses(id)        ON DELETE RESTRICT ,
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT,
    session_id              UUID            REFERENCES training_sessions(id)            ON DELETE RESTRICT,
    round_id                UUID            REFERENCES session_rounds(id)               ON DELETE RESTRICT,
    video_id                UUID            REFERENCES videos(id)                       ON DELETE RESTRICT,
    algorithm_config_id     UUID            NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    technique_type          technique_type  NOT NULL,
    limb_side               limb_side       NOT NULL,
    start_time_ms           FLOAT           NOT NULL CHECK (start_time_ms >= 0),
    impact_time_ms          FLOAT           NOT NULL CHECK (impact_time_ms >= start_time_ms),
    end_time_ms             FLOAT           NOT NULL CHECK (end_time_ms >= impact_time_ms),
    start_frame             INTEGER         CHECK (start_frame >= 0),
    impact_frame            INTEGER         CHECK (impact_frame >= start_frame),
    end_frame               INTEGER         CHECK (end_frame >= impact_frame),
    score                   SMALLINT        CHECK (score BETWEEN 0 AND 100),
    grade                   TEXT            CHECK (grade IN ('PERFECT','GOOD','FAIR','NEEDS_WORK')),
    max_elbow_angle_deg     FLOAT           CHECK (max_elbow_angle_deg BETWEEN 0 AND 180),
    min_chamber_angle_deg   FLOAT           CHECK (min_chamber_angle_deg BETWEEN 0 AND 180),
    max_extension_angle_deg FLOAT           CHECK (max_extension_angle_deg BETWEEN 0 AND 180),
    peak_speed_norm         FLOAT           CHECK (peak_speed_norm >= 0),
    guard_preserved         BOOLEAN         NOT NULL DEFAULT TRUE,
    is_feint                BOOLEAN         NOT NULL DEFAULT FALSE,
    motion_class            motion_class    NOT NULL DEFAULT 'UNKNOWN',
    mahalanobis_dist        FLOAT           CHECK (mahalanobis_dist >= 0),
    reconstruction_error    FLOAT           CHECK (reconstruction_error >= 0),
    rom_ratio               FLOAT           CHECK (rom_ratio >= 0),
    baseline_id             UUID            REFERENCES fighter_baselines(id) ON DELETE RESTRICT,
    event_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    speed_unit TEXT,
    CONSTRAINT uq_event_context UNIQUE (id, analysis_id, fighter_id),
    CONSTRAINT uq_event_fighter UNIQUE (id, fighter_id),
    CONSTRAINT ck_event_frames CHECK ((start_frame IS NULL AND impact_frame IS NULL AND end_frame IS NULL) OR (start_frame IS NOT NULL AND impact_frame IS NOT NULL AND end_frame IS NOT NULL)),
    CONSTRAINT ck_event_speed_unit CHECK ((peak_speed_norm IS NULL) = (speed_unit IS NULL)),
    CONSTRAINT fk_technique_events_analysis FOREIGN KEY (analysis_id, fighter_id, algorithm_config_id) REFERENCES ai_analyses(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT fk_technique_events_session FOREIGN KEY (session_id, fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_technique_events_analysis_session FOREIGN KEY (analysis_id, session_id) REFERENCES ai_analyses(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT fk_technique_events_baseline FOREIGN KEY (baseline_id, fighter_id, algorithm_config_id) REFERENCES fighter_baselines(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT ck_technique_events_round_context CHECK (round_id IS NULL OR session_id IS NOT NULL),
    CONSTRAINT fk_technique_events_round FOREIGN KEY (round_id, session_id) REFERENCES session_rounds(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT fk_event_video FOREIGN KEY (analysis_id, video_id) REFERENCES ai_analyses(id, video_id) ON DELETE RESTRICT
);

CREATE TABLE public.fighter_joint_states (
    id                          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id                  UUID                NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    joint                       body_joint          NOT NULL,
    current_state               joint_health_state  NOT NULL DEFAULT 'HEALTHY',
    state_updated_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    consecutive_suspected_count INTEGER             NOT NULL DEFAULT 0 CHECK (consecutive_suspected_count >= 0),
    last_trigger_event_id       UUID                REFERENCES technique_events(id) ON DELETE RESTRICT,
    last_trigger_alert_id       UUID,
    window_started_at           TIMESTAMPTZ,
    notes                       TEXT,
    CONSTRAINT uq_fighter_joint UNIQUE (fighter_id, joint),
    source_analysis_id UUID REFERENCES ai_analyses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_state_event_fighter FOREIGN KEY (last_trigger_event_id, fighter_id) REFERENCES technique_events(id, fighter_id) ON DELETE RESTRICT
);

CREATE TABLE public.joint_health_history (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id          UUID                NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT,
    session_id          UUID                REFERENCES training_sessions(id)            ON DELETE RESTRICT,
    analysis_id         UUID                REFERENCES ai_analyses(id)                 ON DELETE RESTRICT,
    joint               body_joint          NOT NULL,
    state               joint_health_state  NOT NULL,
    rom_ratio           FLOAT               CHECK (rom_ratio >= 0),
    algorithm_config_id UUID                NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    recorded_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_joint_health_history_analysis FOREIGN KEY (analysis_id, fighter_id, algorithm_config_id) REFERENCES ai_analyses(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT fk_joint_health_history_session FOREIGN KEY (session_id, fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_joint_health_history_analysis_session FOREIGN KEY (analysis_id, session_id) REFERENCES ai_analyses(id, session_id) ON DELETE RESTRICT
);

CREATE TABLE public.health_alerts (
    id                          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id                 UUID                    NOT NULL REFERENCES ai_analyses(id)        ON DELETE RESTRICT ,
    fighter_id                  UUID                    NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT,
    session_id                  UUID                    REFERENCES training_sessions(id)            ON DELETE RESTRICT,
    round_id                    UUID                    REFERENCES session_rounds(id)               ON DELETE RESTRICT,
    joint                       body_joint              NOT NULL,
    state                       joint_health_state      NOT NULL DEFAULT 'CONFIRMED_IMPAIRMENT',
    severity                    alert_severity          NOT NULL,
    trigger_time_ms             FLOAT                   NOT NULL CHECK (trigger_time_ms >= 0),
    window_start_ms             FLOAT                   NOT NULL CHECK (window_start_ms >= 0),
    consecutive_low_rom         INTEGER                 NOT NULL CHECK (consecutive_low_rom > 0),
    avg_rom_ratio               FLOAT                   NOT NULL CHECK (avg_rom_ratio BETWEEN 0.0 AND 2.0),
    motion_class                motion_class            NOT NULL,
    recommendation              TEXT                    NOT NULL,
    technique_type              technique_type,
    technique_event_id          UUID                    REFERENCES technique_events(id)             ON DELETE RESTRICT,
    compensatory_pattern_detected TEXT,
    affected_adjacent_joints    body_joint[],
    algorithm_config_id         UUID                    NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    baseline_id                 UUID                    REFERENCES fighter_baselines(id)            ON DELETE RESTRICT,
    review_decision             alert_review_decision   NOT NULL DEFAULT 'PENDING',
    reviewed_by                 UUID                    REFERENCES users(id)                        ON DELETE RESTRICT,
    reviewed_at                 TIMESTAMPTZ,
    review_notes                TEXT,
    created_at                  TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_alert_fighter UNIQUE (id, fighter_id),
    CONSTRAINT ck_alert_time CHECK (trigger_time_ms >= window_start_ms),
    CONSTRAINT ck_alert_review CHECK ((review_decision = 'PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (review_decision <> 'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)),
    CONSTRAINT fk_alert_event FOREIGN KEY (technique_event_id, analysis_id, fighter_id) REFERENCES technique_events(id, analysis_id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_alerts_analysis FOREIGN KEY (analysis_id, fighter_id, algorithm_config_id) REFERENCES ai_analyses(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_alerts_session FOREIGN KEY (session_id, fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_alerts_analysis_session FOREIGN KEY (analysis_id, session_id) REFERENCES ai_analyses(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT fk_health_alerts_baseline FOREIGN KEY (baseline_id, fighter_id, algorithm_config_id) REFERENCES fighter_baselines(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT ck_health_alerts_round_context CHECK (round_id IS NULL OR session_id IS NOT NULL),
    CONSTRAINT fk_health_alerts_round FOREIGN KEY (round_id, session_id) REFERENCES session_rounds(id, session_id) ON DELETE RESTRICT
);

CREATE TABLE public.medical_clearances (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id      UUID                NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT,
    issued_by_id    UUID                NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    clearance_type  clearance_type      NOT NULL,
    status          clearance_status    NOT NULL DEFAULT 'ACTIVE',
    valid_from      TIMESTAMPTZ         NOT NULL,
    valid_until     TIMESTAMPTZ,
    notes           TEXT,
    allowed_session_types   session_type[],
    allowed_technique_types technique_type[],
    excluded_joints         body_joint[],
    revoked_at      TIMESTAMPTZ,
    revoked_by_id   UUID                REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    revoked_reason  TEXT,
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CHECK (valid_until IS NULL OR valid_until > valid_from),
    CONSTRAINT ck_clearance_revocation CHECK ((status = 'REVOKED' AND revoked_at IS NOT NULL AND revoked_by_id IS NOT NULL AND nullif(btrim(revoked_reason), '') IS NOT NULL) OR (status <> 'REVOKED' AND revoked_at IS NULL AND revoked_by_id IS NULL AND revoked_reason IS NULL))
);

CREATE TABLE public.injury_records (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID                NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT,
    reported_by_id          UUID                NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    affected_joint          body_joint          NOT NULL,
    injury_type             TEXT                NOT NULL,
    severity                injury_severity     NOT NULL,
    occurred_at             TIMESTAMPTZ         NOT NULL,
    description             TEXT,
    trigger_video_id        UUID                REFERENCES videos(id) ON DELETE RESTRICT,
    trigger_time_ms         FLOAT               CHECK (trigger_time_ms >= 0),
    source_alert_id         UUID                REFERENCES health_alerts(id) ON DELETE RESTRICT,
    status                  injury_status       NOT NULL DEFAULT 'ACTIVE',
    resolved_at             TIMESTAMPTZ,
    is_active               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT uq_injury_fighter UNIQUE (id, fighter_id),
    CONSTRAINT ck_injury_resolved CHECK ((status = 'RESOLVED') = (resolved_at IS NOT NULL) AND (resolved_at IS NULL OR resolved_at >= occurred_at)),
    CONSTRAINT ck_injury_video_time CHECK (trigger_time_ms IS NULL OR trigger_video_id IS NOT NULL),
    CONSTRAINT fk_injury_video_fighter FOREIGN KEY (trigger_video_id, fighter_id) REFERENCES videos(id, subject_fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_injury_alert_fighter FOREIGN KEY (source_alert_id, fighter_id) REFERENCES health_alerts(id, fighter_id) ON DELETE RESTRICT
);

CREATE TABLE public.treatments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    injury_id       UUID        NOT NULL REFERENCES injury_records(id)  ON DELETE RESTRICT,
    doctor_id       UUID        NOT NULL REFERENCES sports_doctors(id)  ON DELETE RESTRICT,
    treatment_date  TIMESTAMPTZ NOT NULL,
    treatment_type  TEXT        NOT NULL,
    description     TEXT,
    outcome_notes   TEXT,
    next_review_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_treatment_followup CHECK (next_review_at IS NULL OR next_review_at >= treatment_date)
);

CREATE TABLE public.recovery_plans (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id      UUID                    NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT,
    injury_id       UUID                    NOT NULL REFERENCES injury_records(id) ON DELETE RESTRICT,
    doctor_id       UUID                    NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    title           TEXT                    NOT NULL,
    description     TEXT,
    start_date      DATE                    NOT NULL,
    estimated_end_date DATE,
    actual_end_date DATE,
    status          recovery_plan_status    NOT NULL DEFAULT 'ACTIVE',
    milestones      JSONB                   NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CONSTRAINT fk_recovery_injury_fighter FOREIGN KEY (injury_id, fighter_id) REFERENCES injury_records(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT ck_recovery_dates CHECK ((estimated_end_date IS NULL OR estimated_end_date >= start_date) AND (actual_end_date IS NULL OR actual_end_date >= start_date)),
    CONSTRAINT ck_recovery_completion CHECK ((status = 'COMPLETED') = (actual_end_date IS NOT NULL)),
    CONSTRAINT ck_recovery_milestones CHECK (jsonb_typeof(milestones) = 'array')
);

CREATE TABLE public.round_summaries (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id                UUID            NOT NULL REFERENCES session_rounds(id)  ON DELETE RESTRICT,
    session_id              UUID            NOT NULL REFERENCES training_sessions(id)      ON DELETE RESTRICT,
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)               ON DELETE RESTRICT,
    analysis_id UUID NOT NULL REFERENCES ai_analyses(id)                    ON DELETE RESTRICT,
    total_strikes INTEGER NOT NULL DEFAULT 0 CHECK (total_strikes >= 0),
    total_punches INTEGER NOT NULL DEFAULT 0 CHECK (total_punches >= 0),
    total_kicks INTEGER NOT NULL DEFAULT 0 CHECK (total_kicks >= 0),
    total_feints INTEGER NOT NULL DEFAULT 0 CHECK (total_feints >= 0),
    avg_strike_score        FLOAT           CHECK (avg_strike_score BETWEEN 0 AND 100),
    best_strike_score       SMALLINT        CHECK (best_strike_score BETWEEN 0 AND 100),
    perfect_count INTEGER NOT NULL DEFAULT 0 CHECK (perfect_count >= 0),
    good_count INTEGER NOT NULL DEFAULT 0 CHECK (good_count >= 0),
    fair_count INTEGER NOT NULL DEFAULT 0 CHECK (fair_count >= 0),
    needs_work_count INTEGER NOT NULL DEFAULT 0 CHECK (needs_work_count >= 0),
    avg_rom_ratio           FLOAT           CHECK (avg_rom_ratio >= 0),
    avg_peak_speed_norm     FLOAT           CHECK (avg_peak_speed_norm >= 0),
    avg_elbow_angle_deg     FLOAT           CHECK (avg_elbow_angle_deg BETWEEN 0 AND 180),
    guard_drop_count INTEGER NOT NULL DEFAULT 0 CHECK (guard_drop_count >= 0),
    guard_retention_rate    FLOAT           CHECK (guard_retention_rate BETWEEN 0 AND 100),
    health_alert_count INTEGER NOT NULL DEFAULT 0 CHECK (health_alert_count >= 0),
    suspected_joint_count INTEGER NOT NULL DEFAULT 0 CHECK (suspected_joint_count >= 0),
    dominant_motion_class   motion_class,
    power_strike_ratio      FLOAT           CHECK (power_strike_ratio BETWEEN 0.0 AND 1.0),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    algorithm_config_id UUID NOT NULL REFERENCES algorithm_configs(id) ON DELETE RESTRICT,
    CONSTRAINT fk_round_summaries_analysis FOREIGN KEY (analysis_id, fighter_id, algorithm_config_id) REFERENCES ai_analyses(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT fk_round_summaries_session FOREIGN KEY (session_id, fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_round_summaries_analysis_session FOREIGN KEY (analysis_id, session_id) REFERENCES ai_analyses(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT uq_summary_analysis_round UNIQUE (analysis_id, round_id),
    CONSTRAINT fk_summary_round_session FOREIGN KEY (round_id, session_id) REFERENCES session_rounds(id, session_id) ON DELETE RESTRICT
);

CREATE TABLE public.session_summaries (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    fighter_id              UUID        NOT NULL REFERENCES fighters(id)                  ON DELETE RESTRICT,
    analysis_id UUID NOT NULL REFERENCES ai_analyses(id)                ON DELETE RESTRICT,
    algorithm_config_id     UUID        NOT NULL REFERENCES algorithm_configs(id)        ON DELETE RESTRICT,
    total_rounds SMALLINT NOT NULL DEFAULT 0 CHECK (total_rounds >= 0),
    total_strikes INTEGER NOT NULL DEFAULT 0 CHECK (total_strikes >= 0),
    total_punches INTEGER NOT NULL DEFAULT 0 CHECK (total_punches >= 0),
    total_kicks INTEGER NOT NULL DEFAULT 0 CHECK (total_kicks >= 0),
    avg_session_score       FLOAT       CHECK (avg_session_score BETWEEN 0 AND 100),
    best_strike_score       SMALLINT    CHECK (best_strike_score BETWEEN 0 AND 100),
    avg_rom_ratio           FLOAT       CHECK (avg_rom_ratio >= 0),
    avg_peak_speed_norm     FLOAT,
    impairment_detected     BOOLEAN     NOT NULL DEFAULT FALSE,
    confirmed_alert_count INTEGER NOT NULL DEFAULT 0 CHECK (confirmed_alert_count >= 0),
    joint_states            JSONB       NOT NULL DEFAULT '{}',
    score_delta             FLOAT,
    rom_delta               FLOAT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_session_summaries_analysis FOREIGN KEY (analysis_id, fighter_id, algorithm_config_id) REFERENCES ai_analyses(id, fighter_id, algorithm_config_id) ON DELETE RESTRICT,
    CONSTRAINT fk_session_summaries_session FOREIGN KEY (session_id, fighter_id) REFERENCES training_sessions(id, fighter_id) ON DELETE RESTRICT,
    CONSTRAINT fk_session_summaries_analysis_session FOREIGN KEY (analysis_id, session_id) REFERENCES ai_analyses(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT uq_summary_analysis UNIQUE (analysis_id),
    CONSTRAINT ck_summary_states CHECK (jsonb_typeof(joint_states) = 'object')
);

CREATE TABLE public.notifications (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID                    NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type            notification_type       NOT NULL,
    title           TEXT                    NOT NULL,
    message         TEXT                    NOT NULL,
    payload         JSONB                   NOT NULL DEFAULT '{}',
    is_read         BOOLEAN                 NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_notification_read CHECK (is_read = (read_at IS NOT NULL) AND (read_at IS NULL OR read_at >= created_at)),
    CONSTRAINT ck_notification_payload CHECK (jsonb_typeof(payload) = 'object')
);

CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('USER', 'SYSTEM')),
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id UUID,
    request_id TEXT,
    details JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object'),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_audit_actor CHECK ((actor_type = 'USER') = (actor_user_id IS NOT NULL))
);

CREATE TABLE public.doctor_fighters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id UUID NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    fighter_id UUID NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    assigned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at TIMESTAMPTZ,
    ended_by_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    end_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_doctor_fighters_period CHECK (ends_at IS NULL OR ends_at > starts_at),
    CONSTRAINT ck_doctor_fighters_closure CHECK ((ends_at IS NULL AND ended_by_id IS NULL AND end_reason IS NULL) OR (ends_at IS NOT NULL AND ended_by_id IS NOT NULL AND nullif(btrim(end_reason), '') IS NOT NULL))
);

CREATE TABLE public.training_plan_exercises (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id       UUID        NOT NULL REFERENCES training_plans(id) ON DELETE RESTRICT ,
    exercise_id      UUID        NOT NULL REFERENCES exercises(id)          ON DELETE RESTRICT,
    order_index      INTEGER     NOT NULL CHECK (order_index >= 0),
    sets             INTEGER     CHECK (sets > 0),
    reps             INTEGER     CHECK (reps > 0),
    duration_seconds INTEGER     CHECK (duration_seconds > 0),
    target_rpe       SMALLINT    CHECK (target_rpe BETWEEN 1 AND 10),
    coach_notes      TEXT,
    CONSTRAINT uq_plan_exercise_order UNIQUE (plan_id, order_index),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.video_round_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE RESTRICT,
    round_id UUID NOT NULL REFERENCES session_rounds(id) ON DELETE RESTRICT,
    session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE RESTRICT,
    start_time_ms INTEGER NOT NULL CHECK (start_time_ms >= 0),
    end_time_ms INTEGER NOT NULL CHECK (end_time_ms > start_time_ms),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_video_round UNIQUE (video_id, round_id),
    CONSTRAINT fk_segment_video_session FOREIGN KEY (video_id, session_id) REFERENCES videos(id, session_id) ON DELETE RESTRICT,
    CONSTRAINT fk_segment_round_session FOREIGN KEY (round_id, session_id) REFERENCES session_rounds(id, session_id) ON DELETE RESTRICT
);

CREATE TABLE public.fighter_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id UUID NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT,
    recorded_by_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    measured_at TIMESTAMPTZ NOT NULL,
    measurement_context TEXT NOT NULL CHECK (measurement_context IN ('TRAINING', 'CHECKUP', 'WEIGH_IN', 'SELF_REPORTED')),
    weight_kg NUMERIC(6,2) NOT NULL CHECK (weight_kg > 0 AND weight_kg <> 'NaN'::numeric),
    height_cm NUMERIC(5,2) CHECK (height_cm > 0 AND height_cm <> 'NaN'::numeric),
    reach_cm NUMERIC(5,2) CHECK (reach_cm > 0 AND reach_cm <> 'NaN'::numeric),
    notes TEXT,
    supersedes_id UUID REFERENCES fighter_measurements(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_measurement_fighter UNIQUE (id, fighter_id),
    CONSTRAINT uq_measurement_successor UNIQUE (supersedes_id),
    CONSTRAINT ck_measurement_correction CHECK (supersedes_id IS DISTINCT FROM id),
    CONSTRAINT fk_measurement_correction FOREIGN KEY (supersedes_id, fighter_id) REFERENCES fighter_measurements(id, fighter_id) ON DELETE RESTRICT
);

ALTER TABLE public.analysis_jobs
    ADD COLUMN fighter_id UUID REFERENCES public.fighters(id) ON DELETE RESTRICT,
    ADD COLUMN session_id UUID REFERENCES public.training_sessions(id) ON DELETE RESTRICT,
    ADD COLUMN video_id UUID REFERENCES public.videos(id) ON DELETE RESTRICT,
    ADD COLUMN algorithm_config_id UUID REFERENCES public.algorithm_configs(id) ON DELETE RESTRICT,
    ADD COLUMN created_by_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT uq_job_video UNIQUE (video_id),
    ADD CONSTRAINT uq_job_id_video UNIQUE (id, video_id),
    ADD CONSTRAINT fk_job_session_fighter FOREIGN KEY (session_id, fighter_id) REFERENCES public.training_sessions(id, fighter_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_job_video_fighter FOREIGN KEY (video_id, fighter_id) REFERENCES public.videos(id, subject_fighter_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_job_video_session FOREIGN KEY (video_id, session_id) REFERENCES public.videos(id, session_id) ON DELETE RESTRICT;
COMMENT ON COLUMN public.analysis_jobs.user_id IS 'Legacy external text identifier; never cast to UUID or use as the application identity FK.';
COMMENT ON COLUMN public.analysis_jobs.video_id IS 'Nullable compatibility bridge. Each linked upload has at most one job; legacy writers may leave this NULL.';

ALTER TABLE public.ai_analyses ADD CONSTRAINT fk_analysis_job_video FOREIGN KEY (job_id, video_id) REFERENCES public.analysis_jobs(id, video_id) ON DELETE RESTRICT;
ALTER TABLE public.fighter_joint_states ADD CONSTRAINT fk_state_alert_fighter FOREIGN KEY (last_trigger_alert_id, fighter_id) REFERENCES public.health_alerts(id, fighter_id) ON DELETE RESTRICT;
ALTER TABLE public.fighter_joint_states ADD CONSTRAINT fk_state_analysis_fighter FOREIGN KEY (source_analysis_id, fighter_id) REFERENCES public.ai_analyses(id, fighter_id) ON DELETE RESTRICT;

-- Query indexes; baseline indexes are preserved.
CREATE UNIQUE INDEX uidx_algorithm_configs_single_active ON public.algorithm_configs (is_active) WHERE is_active = true;
CREATE UNIQUE INDEX uidx_fighter_baselines_active ON public.fighter_baselines (fighter_id, technique_type, limb_side, algorithm_config_id) WHERE is_active = true;
CREATE UNIQUE INDEX uq_coach_fighter_open ON public.coach_fighters (coach_id, fighter_id) WHERE ends_at IS NULL;
CREATE UNIQUE INDEX uq_doctor_fighter_open ON public.doctor_fighters (doctor_id, fighter_id) WHERE ends_at IS NULL;
CREATE INDEX idx_coach_fighter_history ON public.coach_fighters (fighter_id, starts_at DESC);
CREATE INDEX idx_doctor_fighter_history ON public.doctor_fighters (fighter_id, starts_at DESC);
CREATE INDEX idx_plan_fighter ON public.training_plans (fighter_id, start_date DESC);
CREATE INDEX idx_session_fighter_schedule ON public.training_sessions (fighter_id, scheduled_at DESC);
CREATE INDEX idx_session_coach_schedule ON public.training_sessions (coach_id, scheduled_at);
CREATE INDEX idx_video_fighter_created ON public.videos (subject_fighter_id, created_at DESC);
CREATE INDEX idx_video_session ON public.videos (session_id);
CREATE INDEX idx_analysis_fighter_created ON public.ai_analyses (fighter_id, created_at DESC);
CREATE INDEX idx_job_fighter_created ON public.analysis_jobs (fighter_id, created_at DESC) WHERE fighter_id IS NOT NULL;
CREATE INDEX idx_events_analysis_time ON public.technique_events (analysis_id, start_time_ms);
CREATE INDEX idx_history_fighter_joint_time ON public.joint_health_history (fighter_id, joint, recorded_at DESC);
CREATE INDEX idx_alert_fighter_review ON public.health_alerts (fighter_id, review_decision, created_at DESC);
CREATE INDEX idx_clearance_fighter_valid ON public.medical_clearances (fighter_id, valid_from DESC);
CREATE INDEX idx_injury_fighter_status ON public.injury_records (fighter_id, status, occurred_at DESC);
CREATE INDEX idx_injury_source_alert ON public.injury_records (source_alert_id) WHERE source_alert_id IS NOT NULL;
CREATE INDEX idx_treatment_injury_date ON public.treatments (injury_id, treatment_date DESC);
CREATE INDEX idx_recovery_fighter ON public.recovery_plans (fighter_id, start_date DESC);
CREATE INDEX idx_measurement_fighter_time ON public.fighter_measurements (fighter_id, measured_at DESC, created_at DESC);
CREATE INDEX idx_summary_fighter_session ON public.session_summaries (fighter_id, session_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_audit_resource_time ON public.audit_logs (resource_type, resource_id, created_at DESC);
CREATE INDEX idx_audit_actor_time ON public.audit_logs (actor_user_id, created_at DESC);

-- Reuse the trigger function installed by 001.
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_permissions_updated_at BEFORE UPDATE ON public.permissions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fighters_updated_at BEFORE UPDATE ON public.fighters FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_sports_doctors_updated_at BEFORE UPDATE ON public.sports_doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_training_plans_updated_at BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_training_sessions_updated_at BEFORE UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_exercises_updated_at BEFORE UPDATE ON public.exercises FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_fighter_baselines_updated_at BEFORE UPDATE ON public.fighter_baselines FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_videos_updated_at BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ai_analyses_updated_at BEFORE UPDATE ON public.ai_analyses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_medical_clearances_updated_at BEFORE UPDATE ON public.medical_clearances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_injury_records_updated_at BEFORE UPDATE ON public.injury_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_treatments_updated_at BEFORE UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_recovery_plans_updated_at BEFORE UPDATE ON public.recovery_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_round_summaries_updated_at BEFORE UPDATE ON public.round_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_session_summaries_updated_at BEFORE UPDATE ON public.session_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.fighters ADD CONSTRAINT ck_fighters_finite CHECK ((height_cm IS NULL OR (height_cm > '-Infinity'::float8 AND height_cm < 'Infinity'::float8)) AND (reach_cm IS NULL OR (reach_cm > '-Infinity'::float8 AND reach_cm < 'Infinity'::float8)) AND (left_arm_cm IS NULL OR (left_arm_cm > '-Infinity'::float8 AND left_arm_cm < 'Infinity'::float8)) AND (right_arm_cm IS NULL OR (right_arm_cm > '-Infinity'::float8 AND right_arm_cm < 'Infinity'::float8)) AND (left_leg_cm IS NULL OR (left_leg_cm > '-Infinity'::float8 AND left_leg_cm < 'Infinity'::float8)) AND (right_leg_cm IS NULL OR (right_leg_cm > '-Infinity'::float8 AND right_leg_cm < 'Infinity'::float8)));

ALTER TABLE public.algorithm_configs ADD CONSTRAINT ck_algorithm_configs_finite CHECK ((conf_threshold IS NULL OR (conf_threshold > '-Infinity'::float8 AND conf_threshold < 'Infinity'::float8)) AND (ema_alpha IS NULL OR (ema_alpha > '-Infinity'::float8 AND ema_alpha < 'Infinity'::float8)) AND (jerk_smooth_threshold IS NULL OR (jerk_smooth_threshold > '-Infinity'::float8 AND jerk_smooth_threshold < 'Infinity'::float8)) AND (min_feint_velocity_ratio IS NULL OR (min_feint_velocity_ratio > '-Infinity'::float8 AND min_feint_velocity_ratio < 'Infinity'::float8)) AND (rom_low_threshold IS NULL OR (rom_low_threshold > '-Infinity'::float8 AND rom_low_threshold < 'Infinity'::float8)) AND (rom_recovery_threshold IS NULL OR (rom_recovery_threshold > '-Infinity'::float8 AND rom_recovery_threshold < 'Infinity'::float8)) AND (window_sec_min IS NULL OR (window_sec_min > '-Infinity'::float8 AND window_sec_min < 'Infinity'::float8)) AND (window_sec_max IS NULL OR (window_sec_max > '-Infinity'::float8 AND window_sec_max < 'Infinity'::float8)) AND (disuse_sec_trigger IS NULL OR (disuse_sec_trigger > '-Infinity'::float8 AND disuse_sec_trigger < 'Infinity'::float8)) AND (tau_mahalanobis IS NULL OR (tau_mahalanobis > '-Infinity'::float8 AND tau_mahalanobis < 'Infinity'::float8)));

ALTER TABLE public.fighter_baselines ADD CONSTRAINT ck_fighter_baselines_finite CHECK ((rom_baseline_deg IS NULL OR (rom_baseline_deg > '-Infinity'::float8 AND rom_baseline_deg < 'Infinity'::float8)) AND (velocity_baseline IS NULL OR (velocity_baseline > '-Infinity'::float8 AND velocity_baseline < 'Infinity'::float8)) AND (jerk_threshold IS NULL OR (jerk_threshold > '-Infinity'::float8 AND jerk_threshold < 'Infinity'::float8)) AND (std_dev_rom IS NULL OR (std_dev_rom > '-Infinity'::float8 AND std_dev_rom < 'Infinity'::float8)));

ALTER TABLE public.videos ADD CONSTRAINT ck_videos_finite CHECK ((fps IS NULL OR (fps > '-Infinity'::float8 AND fps < 'Infinity'::float8)));

ALTER TABLE public.ai_analyses ADD CONSTRAINT ck_ai_analyses_finite CHECK ((confidence_score IS NULL OR (confidence_score > '-Infinity'::float8 AND confidence_score < 'Infinity'::float8)) AND (footwork_score IS NULL OR (footwork_score > '-Infinity'::float8 AND footwork_score < 'Infinity'::float8)) AND (guard_score IS NULL OR (guard_score > '-Infinity'::float8 AND guard_score < 'Infinity'::float8)) AND (head_movement_score IS NULL OR (head_movement_score > '-Infinity'::float8 AND head_movement_score < 'Infinity'::float8)));

ALTER TABLE public.technique_events ADD CONSTRAINT ck_technique_events_finite CHECK ((start_time_ms IS NULL OR (start_time_ms > '-Infinity'::float8 AND start_time_ms < 'Infinity'::float8)) AND (impact_time_ms IS NULL OR (impact_time_ms > '-Infinity'::float8 AND impact_time_ms < 'Infinity'::float8)) AND (end_time_ms IS NULL OR (end_time_ms > '-Infinity'::float8 AND end_time_ms < 'Infinity'::float8)) AND (max_elbow_angle_deg IS NULL OR (max_elbow_angle_deg > '-Infinity'::float8 AND max_elbow_angle_deg < 'Infinity'::float8)) AND (min_chamber_angle_deg IS NULL OR (min_chamber_angle_deg > '-Infinity'::float8 AND min_chamber_angle_deg < 'Infinity'::float8)) AND (max_extension_angle_deg IS NULL OR (max_extension_angle_deg > '-Infinity'::float8 AND max_extension_angle_deg < 'Infinity'::float8)) AND (peak_speed_norm IS NULL OR (peak_speed_norm > '-Infinity'::float8 AND peak_speed_norm < 'Infinity'::float8)) AND (mahalanobis_dist IS NULL OR (mahalanobis_dist > '-Infinity'::float8 AND mahalanobis_dist < 'Infinity'::float8)) AND (reconstruction_error IS NULL OR (reconstruction_error > '-Infinity'::float8 AND reconstruction_error < 'Infinity'::float8)) AND (rom_ratio IS NULL OR (rom_ratio > '-Infinity'::float8 AND rom_ratio < 'Infinity'::float8)));

ALTER TABLE public.joint_health_history ADD CONSTRAINT ck_joint_health_history_finite CHECK ((rom_ratio IS NULL OR (rom_ratio > '-Infinity'::float8 AND rom_ratio < 'Infinity'::float8)));

ALTER TABLE public.health_alerts ADD CONSTRAINT ck_health_alerts_finite CHECK ((trigger_time_ms IS NULL OR (trigger_time_ms > '-Infinity'::float8 AND trigger_time_ms < 'Infinity'::float8)) AND (window_start_ms IS NULL OR (window_start_ms > '-Infinity'::float8 AND window_start_ms < 'Infinity'::float8)) AND (avg_rom_ratio IS NULL OR (avg_rom_ratio > '-Infinity'::float8 AND avg_rom_ratio < 'Infinity'::float8)));

ALTER TABLE public.injury_records ADD CONSTRAINT ck_injury_records_finite CHECK ((trigger_time_ms IS NULL OR (trigger_time_ms > '-Infinity'::float8 AND trigger_time_ms < 'Infinity'::float8)));

ALTER TABLE public.round_summaries ADD CONSTRAINT ck_round_summaries_finite CHECK ((avg_strike_score IS NULL OR (avg_strike_score > '-Infinity'::float8 AND avg_strike_score < 'Infinity'::float8)) AND (avg_rom_ratio IS NULL OR (avg_rom_ratio > '-Infinity'::float8 AND avg_rom_ratio < 'Infinity'::float8)) AND (avg_peak_speed_norm IS NULL OR (avg_peak_speed_norm > '-Infinity'::float8 AND avg_peak_speed_norm < 'Infinity'::float8)) AND (avg_elbow_angle_deg IS NULL OR (avg_elbow_angle_deg > '-Infinity'::float8 AND avg_elbow_angle_deg < 'Infinity'::float8)) AND (guard_retention_rate IS NULL OR (guard_retention_rate > '-Infinity'::float8 AND guard_retention_rate < 'Infinity'::float8)) AND (power_strike_ratio IS NULL OR (power_strike_ratio > '-Infinity'::float8 AND power_strike_ratio < 'Infinity'::float8)));

ALTER TABLE public.session_summaries ADD CONSTRAINT ck_session_summaries_finite CHECK ((avg_session_score IS NULL OR (avg_session_score > '-Infinity'::float8 AND avg_session_score < 'Infinity'::float8)) AND (avg_rom_ratio IS NULL OR (avg_rom_ratio > '-Infinity'::float8 AND avg_rom_ratio < 'Infinity'::float8)) AND (avg_peak_speed_norm IS NULL OR (avg_peak_speed_norm > '-Infinity'::float8 AND avg_peak_speed_norm < 'Infinity'::float8)) AND (score_delta IS NULL OR (score_delta > '-Infinity'::float8 AND score_delta < 'Infinity'::float8)) AND (rom_delta IS NULL OR (rom_delta > '-Infinity'::float8 AND rom_delta < 'Infinity'::float8)));

-- Context columns identify historical records and cannot be reassigned in place.
CREATE FUNCTION mma_private.reject_context_change() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE key TEXT;
BEGIN
  FOREACH key IN ARRAY TG_ARGV LOOP
    IF to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key THEN
      RAISE EXCEPTION 'Context %.% is immutable; create a new record', TG_TABLE_NAME, key USING ERRCODE='23514';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;

CREATE FUNCTION mma_private.reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; insert a correction/revision', TG_TABLE_NAME USING ERRCODE='23514';
END $$;

-- Parameters remain immutable after publication. Lifecycle changes are explicit.
CREATE FUNCTION mma_private.guard_config() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Deprecate configurations instead of deleting' USING ERRCODE='23514'; END IF;
  IF (OLD.activated_at IS NOT NULL
      OR EXISTS (SELECT 1 FROM public.ai_analyses WHERE algorithm_config_id=OLD.id)
      OR EXISTS (SELECT 1 FROM public.analysis_jobs WHERE algorithm_config_id=OLD.id)
      OR EXISTS (SELECT 1 FROM public.fighter_baselines WHERE algorithm_config_id=OLD.id)) AND
    (to_jsonb(OLD) - ARRAY['is_active','deprecated_at','notes']) IS DISTINCT FROM
    (to_jsonb(NEW) - ARRAY['is_active','deprecated_at','notes']) THEN
    RAISE EXCEPTION 'Published configuration parameters are immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.deprecated_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Deprecated configuration is immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_config_guard BEFORE UPDATE OR DELETE ON public.algorithm_configs FOR EACH ROW EXECUTE FUNCTION mma_private.guard_config();

CREATE FUNCTION mma_private.guard_baseline() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF OLD.is_locked AND
    (to_jsonb(OLD) - ARRAY['is_active','expires_at','updated_at']) IS DISTINCT FROM
    (to_jsonb(NEW) - ARRAY['is_active','expires_at','updated_at']) THEN
    RAISE EXCEPTION 'Approved baseline values are immutable; create a new version' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_baseline_guard BEFORE UPDATE ON public.fighter_baselines FOR EACH ROW EXECUTE FUNCTION mma_private.guard_baseline();

CREATE FUNCTION mma_private.guard_review_revision() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE prior_revision INTEGER;
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT revision INTO prior_revision FROM public.coach_reviews WHERE id=NEW.supersedes_id FOR KEY SHARE;
    IF NOT FOUND OR NEW.revision <> prior_revision + 1 THEN
      RAISE EXCEPTION 'Review revision must follow its predecessor' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_review_revision BEFORE INSERT ON public.coach_reviews FOR EACH ROW EXECUTE FUNCTION mma_private.guard_review_revision();

-- NULL-safe validation complements composite FKs for optional context links.
CREATE FUNCTION mma_private.validate_analysis_context() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent public.videos; job public.analysis_jobs;
BEGIN
  SELECT * INTO parent FROM public.videos WHERE id=NEW.video_id FOR KEY SHARE;
  IF NOT FOUND OR NEW.fighter_id IS DISTINCT FROM parent.subject_fighter_id OR NEW.session_id IS DISTINCT FROM parent.session_id THEN
    RAISE EXCEPTION 'Analysis context differs from its uploaded video' USING ERRCODE='23514';
  END IF;
  SELECT * INTO job FROM public.analysis_jobs WHERE id=NEW.job_id FOR KEY SHARE;
  IF NOT FOUND OR job.video_id IS DISTINCT FROM NEW.video_id
    OR (job.fighter_id IS NOT NULL AND job.fighter_id IS DISTINCT FROM NEW.fighter_id)
    OR (job.session_id IS NOT NULL AND job.session_id IS DISTINCT FROM NEW.session_id)
    OR (job.algorithm_config_id IS NOT NULL AND job.algorithm_config_id IS DISTINCT FROM NEW.algorithm_config_id) THEN
    RAISE EXCEPTION 'Analysis context differs from its linked job' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_analysis_context BEFORE INSERT OR UPDATE ON public.ai_analyses FOR EACH ROW EXECUTE FUNCTION mma_private.validate_analysis_context();

CREATE FUNCTION mma_private.validate_job_links() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent public.videos; analysis public.ai_analyses; key TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOREACH key IN ARRAY ARRAY['fighter_id','session_id','video_id','algorithm_config_id','created_by_id'] LOOP
      IF to_jsonb(OLD)->key <> 'null'::jsonb AND to_jsonb(OLD)->key IS DISTINCT FROM to_jsonb(NEW)->key THEN
        RAISE EXCEPTION 'Existing job link % is immutable', key USING ERRCODE='23514';
      END IF;
    END LOOP;
  END IF;
  -- Legacy inserts have no domain links and must not need privileges on new tables.
  IF NEW.video_id IS NULL AND NEW.fighter_id IS NULL AND NEW.session_id IS NULL
     AND NEW.algorithm_config_id IS NULL AND NEW.created_by_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.video_id IS NOT NULL THEN
    SELECT * INTO parent FROM public.videos WHERE id=NEW.video_id FOR KEY SHARE;
    IF NOT FOUND OR (NEW.fighter_id IS NOT NULL AND NEW.fighter_id IS DISTINCT FROM parent.subject_fighter_id)
      OR (NEW.session_id IS NOT NULL AND NEW.session_id IS DISTINCT FROM parent.session_id) THEN
      RAISE EXCEPTION 'Job links differ from video context' USING ERRCODE='23514';
    END IF;
  END IF;
  SELECT * INTO analysis FROM public.ai_analyses WHERE job_id=NEW.id;
  IF FOUND AND ((NEW.fighter_id IS NOT NULL AND NEW.fighter_id IS DISTINCT FROM analysis.fighter_id)
    OR (NEW.session_id IS NOT NULL AND NEW.session_id IS DISTINCT FROM analysis.session_id)
    OR (NEW.algorithm_config_id IS NOT NULL AND NEW.algorithm_config_id IS DISTINCT FROM analysis.algorithm_config_id)) THEN
    RAISE EXCEPTION 'Job links differ from existing analysis' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_job_links BEFORE INSERT OR UPDATE OF fighter_id, session_id, video_id, algorithm_config_id, created_by_id
  ON public.analysis_jobs FOR EACH ROW EXECUTE FUNCTION mma_private.validate_job_links();

CREATE FUNCTION mma_private.guard_assignment_history() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Close assignment episodes instead of deleting them' USING ERRCODE='23514';
  END IF;
  IF OLD.ends_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Closed assignment episodes are immutable' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_coach_assignment_history BEFORE UPDATE OR DELETE ON public.coach_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.guard_assignment_history();
CREATE TRIGGER trg_doctor_assignment_history BEFORE UPDATE OR DELETE ON public.doctor_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.guard_assignment_history();

CREATE FUNCTION mma_private.guard_measurement_correction() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.supersedes_id IS NOT NULL THEN
    PERFORM 1 FROM public.fighter_measurements WHERE id=NEW.supersedes_id AND fighter_id=NEW.fighter_id FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Correction must reference an existing measurement of the same fighter' USING ERRCODE='23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_measurement_correction BEFORE INSERT ON public.fighter_measurements FOR EACH ROW EXECUTE FUNCTION mma_private.guard_measurement_correction();

CREATE FUNCTION mma_private.validate_result_context() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE parent public.ai_analyses; payload JSONB := to_jsonb(NEW);
BEGIN
  IF NEW.analysis_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO parent FROM public.ai_analyses WHERE id=NEW.analysis_id FOR KEY SHARE;
  IF NOT FOUND OR NEW.fighter_id IS DISTINCT FROM parent.fighter_id
    OR NEW.algorithm_config_id IS DISTINCT FROM parent.algorithm_config_id
    OR NEW.session_id IS DISTINCT FROM parent.session_id
    OR (payload ? 'video_id' AND payload->>'video_id' IS NOT NULL AND (payload->>'video_id')::uuid IS DISTINCT FROM parent.video_id) THEN
    RAISE EXCEPTION 'Result context differs from analysis' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_users_context_immutable BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('auth_user_id');
CREATE TRIGGER trg_fighters_context_immutable BEFORE UPDATE ON public.fighters FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('user_id');
CREATE TRIGGER trg_coaches_context_immutable BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('user_id');
CREATE TRIGGER trg_sports_doctors_context_immutable BEFORE UPDATE ON public.sports_doctors FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('user_id');
CREATE TRIGGER trg_training_plans_context_immutable BEFORE UPDATE ON public.training_plans FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id');
CREATE TRIGGER trg_training_sessions_context_immutable BEFORE UPDATE ON public.training_sessions FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id', 'plan_id');
CREATE TRIGGER trg_session_rounds_context_immutable BEFORE UPDATE ON public.session_rounds FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('session_id');
CREATE TRIGGER trg_videos_context_immutable BEFORE UPDATE ON public.videos FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('subject_fighter_id', 'session_id', 'uploaded_by_id', 'storage_provider', 'storage_bucket', 'storage_key');
CREATE TRIGGER trg_ai_analyses_context_immutable BEFORE UPDATE ON public.ai_analyses FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('job_id', 'video_id', 'fighter_id', 'session_id', 'algorithm_config_id');
CREATE TRIGGER trg_technique_events_context_immutable BEFORE UPDATE ON public.technique_events FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('analysis_id', 'fighter_id', 'session_id', 'video_id', 'algorithm_config_id');
CREATE TRIGGER trg_health_alerts_context_immutable BEFORE UPDATE ON public.health_alerts FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('analysis_id', 'fighter_id', 'session_id', 'algorithm_config_id');
CREATE TRIGGER trg_injury_records_context_immutable BEFORE UPDATE ON public.injury_records FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id', 'reported_by_id');
CREATE TRIGGER trg_medical_clearances_context_immutable BEFORE UPDATE ON public.medical_clearances FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id', 'issued_by_id');
CREATE TRIGGER trg_treatments_context_immutable BEFORE UPDATE ON public.treatments FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('injury_id', 'doctor_id');
CREATE TRIGGER trg_recovery_plans_context_immutable BEFORE UPDATE ON public.recovery_plans FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('fighter_id', 'injury_id', 'doctor_id');
CREATE TRIGGER trg_coach_fighters_context_immutable BEFORE UPDATE ON public.coach_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('coach_id', 'fighter_id', 'assigned_by_id', 'starts_at');
CREATE TRIGGER trg_doctor_fighters_context_immutable BEFORE UPDATE ON public.doctor_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.reject_context_change('doctor_id', 'fighter_id', 'assigned_by_id', 'starts_at');
CREATE TRIGGER trg_technique_events_context BEFORE INSERT OR UPDATE ON public.technique_events FOR EACH ROW EXECUTE FUNCTION mma_private.validate_result_context();
CREATE TRIGGER trg_health_alerts_context BEFORE INSERT OR UPDATE ON public.health_alerts FOR EACH ROW EXECUTE FUNCTION mma_private.validate_result_context();
CREATE TRIGGER trg_joint_health_history_context BEFORE INSERT OR UPDATE ON public.joint_health_history FOR EACH ROW EXECUTE FUNCTION mma_private.validate_result_context();
CREATE TRIGGER trg_round_summaries_context BEFORE INSERT OR UPDATE ON public.round_summaries FOR EACH ROW EXECUTE FUNCTION mma_private.validate_result_context();
CREATE TRIGGER trg_session_summaries_context BEFORE INSERT OR UPDATE ON public.session_summaries FOR EACH ROW EXECUTE FUNCTION mma_private.validate_result_context();
CREATE TRIGGER trg_audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_audit_logs_no_truncate BEFORE TRUNCATE ON public.audit_logs FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_joint_health_history_append_only BEFORE UPDATE OR DELETE ON public.joint_health_history FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_joint_health_history_no_truncate BEFORE TRUNCATE ON public.joint_health_history FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_coach_reviews_append_only BEFORE UPDATE OR DELETE ON public.coach_reviews FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_coach_reviews_no_truncate BEFORE TRUNCATE ON public.coach_reviews FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_fighter_measurements_append_only BEFORE UPDATE OR DELETE ON public.fighter_measurements FOR EACH ROW EXECUTE FUNCTION mma_private.reject_history_mutation();
CREATE TRIGGER trg_fighter_measurements_no_truncate BEFORE TRUNCATE ON public.fighter_measurements FOR EACH STATEMENT EXECUTE FUNCTION mma_private.reject_history_mutation();

-- RLS helpers use the verified Supabase subject and DB role membership, not user metadata.
-- Keep mma_private outside Supabase exposed schemas. Never grant authenticated writes to users.
CREATE FUNCTION mma_private.current_app_role() RETURNS public.user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT u.role FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid())
    AND u.is_active AND u.deleted_at IS NULL
$$;
CREATE FUNCTION mma_private.can_read_fighter_medical(target_fighter_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u WHERE u.auth_user_id = (SELECT auth.uid()) AND u.is_active AND u.deleted_at IS NULL
      AND (u.role IN ('COACH','DOCTOR','ADMIN') OR (u.role='FIGHTER' AND EXISTS (
        SELECT 1 FROM public.fighters f WHERE f.id=target_fighter_id AND f.user_id=u.id AND f.is_active AND f.deleted_at IS NULL)))
  )
$$;

-- Mutations record identifiers + changed column names only (no clinical payload copies).
-- SELECT/access audit must be written by the authenticated backend request path; RLS does not log reads.
CREATE FUNCTION mma_private.audit_domain_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor UUID; row_id UUID; changed_keys JSONB := '[]'::jsonb;
BEGIN
  SELECT id INTO actor FROM public.users WHERE auth_user_id=(SELECT auth.uid()) AND is_active AND deleted_at IS NULL;
  IF TG_OP='DELETE' THEN row_id=OLD.id; ELSE row_id=NEW.id; END IF;
  IF TG_OP='UPDATE' THEN
    SELECT COALESCE(jsonb_agg(n.key ORDER BY n.key),'[]'::jsonb) INTO changed_keys
      FROM jsonb_each(to_jsonb(NEW)) n WHERE n.value IS DISTINCT FROM to_jsonb(OLD)->n.key;
  END IF;
  INSERT INTO public.audit_logs(actor_user_id,actor_type,action,resource_type,resource_id,request_id,details)
    VALUES(actor,CASE WHEN actor IS NULL THEN 'SYSTEM' ELSE 'USER' END,TG_OP,TG_TABLE_NAME,row_id,
      nullif(current_setting('mma.request_id',true),''), jsonb_build_object('changed_columns',changed_keys));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER trg_users_audit AFTER INSERT OR UPDATE OR DELETE ON public.users FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_user_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_role_permissions_audit AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_coach_fighters_audit AFTER INSERT OR UPDATE OR DELETE ON public.coach_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_doctor_fighters_audit AFTER INSERT OR UPDATE OR DELETE ON public.doctor_fighters FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_medical_clearances_audit AFTER INSERT OR UPDATE OR DELETE ON public.medical_clearances FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_injury_records_audit AFTER INSERT OR UPDATE OR DELETE ON public.injury_records FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_treatments_audit AFTER INSERT OR UPDATE OR DELETE ON public.treatments FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_recovery_plans_audit AFTER INSERT OR UPDATE OR DELETE ON public.recovery_plans FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_fighter_measurements_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_measurements FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_health_alerts_audit AFTER INSERT OR UPDATE OR DELETE ON public.health_alerts FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_coach_reviews_audit AFTER INSERT OR UPDATE OR DELETE ON public.coach_reviews FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_algorithm_configs_audit AFTER INSERT OR UPDATE OR DELETE ON public.algorithm_configs FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();
CREATE TRIGGER trg_fighter_baselines_audit AFTER INSERT OR UPDATE OR DELETE ON public.fighter_baselines FOR EACH ROW EXECUTE FUNCTION mma_private.audit_domain_mutation();

-- Deny inherited Supabase default privileges on all new domain tables.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.permissions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.role_permissions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_permissions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighters FROM PUBLIC, anon, authenticated;
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coaches FROM PUBLIC, anon, authenticated;
ALTER TABLE public.sports_doctors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sports_doctors FROM PUBLIC, anon, authenticated;
ALTER TABLE public.coach_fighters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_fighters FROM PUBLIC, anon, authenticated;
ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_plans FROM PUBLIC, anon, authenticated;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_sessions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.session_rounds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_rounds FROM PUBLIC, anon, authenticated;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.exercises FROM PUBLIC, anon, authenticated;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_exercises FROM PUBLIC, anon, authenticated;
ALTER TABLE public.algorithm_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.algorithm_configs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_baselines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_baselines FROM PUBLIC, anon, authenticated;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.videos FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_analyses FROM PUBLIC, anon, authenticated;
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.coach_reviews FROM PUBLIC, anon, authenticated;
ALTER TABLE public.technique_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.technique_events FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_joint_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_joint_states FROM PUBLIC, anon, authenticated;
ALTER TABLE public.joint_health_history ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.joint_health_history FROM PUBLIC, anon, authenticated;
ALTER TABLE public.health_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.health_alerts FROM PUBLIC, anon, authenticated;
ALTER TABLE public.medical_clearances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.medical_clearances FROM PUBLIC, anon, authenticated;
ALTER TABLE public.injury_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.injury_records FROM PUBLIC, anon, authenticated;
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.treatments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.recovery_plans ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recovery_plans FROM PUBLIC, anon, authenticated;
ALTER TABLE public.round_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.round_summaries FROM PUBLIC, anon, authenticated;
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.session_summaries FROM PUBLIC, anon, authenticated;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.doctor_fighters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.doctor_fighters FROM PUBLIC, anon, authenticated;
ALTER TABLE public.training_plan_exercises ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.training_plan_exercises FROM PUBLIC, anon, authenticated;
ALTER TABLE public.video_round_segments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.video_round_segments FROM PUBLIC, anon, authenticated;
ALTER TABLE public.fighter_measurements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fighter_measurements FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA mma_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mma_private TO authenticated;
GRANT EXECUTE ON FUNCTION mma_private.current_app_role() TO authenticated;
GRANT EXECUTE ON FUNCTION mma_private.can_read_fighter_medical(UUID) TO authenticated;
GRANT SELECT ON public.medical_clearances TO authenticated;
CREATE POLICY medical_read ON public.medical_clearances FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.injury_records TO authenticated;
CREATE POLICY medical_read ON public.injury_records FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.recovery_plans TO authenticated;
CREATE POLICY medical_read ON public.recovery_plans FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.fighter_measurements TO authenticated;
CREATE POLICY medical_read ON public.fighter_measurements FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.health_alerts TO authenticated;
CREATE POLICY medical_read ON public.health_alerts FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.fighter_joint_states TO authenticated;
CREATE POLICY medical_read ON public.fighter_joint_states FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.joint_health_history TO authenticated;
CREATE POLICY medical_read ON public.joint_health_history FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.fighter_baselines TO authenticated;
CREATE POLICY medical_read ON public.fighter_baselines FOR SELECT TO authenticated USING (mma_private.can_read_fighter_medical(fighter_id));
GRANT SELECT ON public.treatments TO authenticated;
CREATE POLICY medical_read ON public.treatments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.injury_records i WHERE i.id = injury_id AND mma_private.can_read_fighter_medical(i.fighter_id))
);
GRANT SELECT ON public.audit_logs TO authenticated;
CREATE POLICY admin_audit_read ON public.audit_logs FOR SELECT TO authenticated USING ((SELECT mma_private.current_app_role()) = 'ADMIN');
-- Client writes remain closed. Backend writes require role checks and actor/request context.
-- Admin domain CRUD is implemented via the backend, preserving append-only and clinical constraints.

COMMENT ON TABLE public.fighter_measurements IS 'Append-only dated body measurements. kg and cm; corrections reference supersedes_id. No automatic weight-class assignment.';
COMMENT ON COLUMN public.fighters.weight_class IS 'Registered competition division, not a live calculation from body mass. Ruleset and weigh-in eligibility belong to the competition domain.';
COMMENT ON COLUMN public.fighters.height_cm IS 'Profile snapshot in cm; dated measurements are stored separately and are not auto-synchronized.';
COMMENT ON COLUMN public.fighters.reach_cm IS 'Profile snapshot in cm; dated measurements are stored separately and are not auto-synchronized.';
COMMENT ON TABLE public.session_rounds IS 'Training-session rounds. Video-relative boundaries belong to video_round_segments.';
COMMENT ON TABLE public.ai_analyses IS 'One analysis per uploaded video, linked to exactly one existing analysis_jobs row. A new upload creates a new video/job/analysis.';
COMMENT ON TABLE public.session_summaries IS 'Per-analysis session summary. Multiple uploads in the same training session keep independent summaries.';
COMMENT ON TABLE public.coach_reviews IS 'Append-only review revisions; raw AI results are not overwritten by a coach review.';
COMMENT ON COLUMN public.coach_reviews.technique_rating IS 'Coach rating on the existing 1-10 scale; separate from AI scores on 0-100.';
COMMENT ON TABLE public.health_alerts IS 'Structured alerts populated only by an explicit future writer; legacy analysis_jobs.health_alerts JSONB remains unchanged.';
COMMENT ON COLUMN public.technique_events.speed_unit IS 'Explicit unit supplied by the producer; no conversion or inferred measurement is performed by this migration.';
COMMENT ON TABLE public.audit_logs IS 'Append-only operation metadata. Application must log medical reads; DB triggers audit selected mutations without copying health payloads.';

-- SQL Editor execution has no source checksum; the verified runner sets this value.
INSERT INTO mma_private.migration_history(version,name,source_sha256)
VALUES (3,'003_mma_tms_complete_schema.sql',nullif(current_setting('mma.migration_sha256',true),''));
COMMIT;
