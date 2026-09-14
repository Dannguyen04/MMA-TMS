-- ============================================================================
-- MMA-TMS ENTERPRISE DATABASE SCHEMA — COMPLETE MERGED VERSION v1.0
-- Merged from: Schema Audit Report + Biomechanical Pipeline Audit
-- Target: PostgreSQL 15+ / Supabase
-- Author: Principal Database Architect (AI-assisted)
-- Date: 2026-09-14
-- ============================================================================
--
-- Thứ tự thực thi:
--   1. Extensions
--   2. Enums
--   3. Core Domain Tables (Users, Fighters, Coaches, Doctors)
--   4. Session Hierarchy (Plans, Sessions, Rounds, Exercises)
--   5. AI Algorithm Config & Fighter Baselines
--   6. Video & AI Analysis Pipeline
--   7. Technique Events (Time-Series Core)
--   8. Joint Health Monitoring (State Machine + Alerts)
--   9. Medical Domain (Clearances, Injuries, Treatments, Recovery)
--  10. Aggregation Layer (Round & Session Summaries)
--  11. Notifications & Audit Logs
--  12. Indexes
-- ============================================================================

-- ─── 0. Extensions ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- Dùng cho EXCLUDE constraints tương lai

-- ─── 1. Enums ─────────────────────────────────────────────────────────────────

-- User & role management
CREATE TYPE user_role AS ENUM (
    'FIGHTER', 'COACH', 'SPORTS_DOCTOR', 'ADMIN'
);
COMMENT ON TYPE user_role IS 'Vai trò người dùng trong hệ thống';

CREATE TYPE weight_class AS ENUM (
    'STRAWWEIGHT', 'FLYWEIGHT', 'BANTAMWEIGHT', 'FEATHERWEIGHT', 'LIGHTWEIGHT',
    'WELTERWEIGHT', 'MIDDLEWEIGHT', 'LIGHT_HEAVYWEIGHT', 'HEAVYWEIGHT'
);
COMMENT ON TYPE weight_class IS 'Hạng cân MMA theo UFC standard';

-- Fighter biomechanics
CREATE TYPE fighter_stance AS ENUM ('ORTHODOX', 'SOUTHPAW', 'SWITCH');
COMMENT ON TYPE fighter_stance IS 'Tư thế chiến đấu. Ảnh hưởng đến lead hand và baseline ROM Jab/Cross.';

CREATE TYPE medical_status AS ENUM (
    'HEALTHY', 'MONITORING', 'RECOVERY', 'INJURED', 'NOT_CLEARED'
);

-- Training structure
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

-- Video & AI pipeline
CREATE TYPE video_status AS ENUM (
    'PENDING_UPLOAD', 'UPLOAD_COMPLETE', 'PROCESSING', 'PROCESSED', 'REJECTED', 'FAILED'
);
CREATE TYPE camera_angle AS ENUM ('FRONT', 'SIDE', 'CORNER', 'OVERHEAD', 'UNKNOWN');
COMMENT ON TYPE camera_angle IS 'Góc quay camera. Ảnh hưởng trực tiếp đến độ chính xác YOLO-Pose angle estimation.';

CREATE TYPE ai_analysis_status AS ENUM (
    'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'REJECTED'
);
CREATE TYPE anomaly_level AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- Biomechanics & Joint Health (mirror Python enums)
CREATE TYPE body_joint AS ENUM (
    'LEFT_SHOULDER',  'RIGHT_SHOULDER',
    'LEFT_ELBOW',     'RIGHT_ELBOW',
    'LEFT_WRIST',     'RIGHT_WRIST',
    'LEFT_HIP',       'RIGHT_HIP',
    'LEFT_KNEE',      'RIGHT_KNEE',
    'LEFT_ANKLE',     'RIGHT_ANKLE',
    'SPINE_CORE'
);
COMMENT ON TYPE body_joint IS 'Mirror của JointName enum trong python-worker/joint_health_tracker.py. Sync bắt buộc.';

CREATE TYPE joint_health_state AS ENUM (
    'HEALTHY', 'SUSPECTED', 'SUSPECTED_AVOIDANCE', 'CONFIRMED_IMPAIRMENT'
);
COMMENT ON TYPE joint_health_state IS 'Mirror của JointHealthState enum. SUSPECTED_AVOIDANCE = chi ngừng hoạt động nghi né đau.';

CREATE TYPE technique_type AS ENUM (
    'JAB', 'CROSS', 'LEAD_HOOK', 'REAR_HOOK',
    'LEAD_UPPERCUT', 'REAR_UPPERCUT',
    'LEAD_LOW_KICK', 'REAR_LOW_KICK',
    'LEAD_MIDDLE_KICK', 'REAR_MIDDLE_KICK',
    'LEAD_HIGH_KICK', 'REAR_HIGH_KICK',
    'FRONT_TEEP', 'SPINNING_BACK_FIST'
);
COMMENT ON TYPE technique_type IS 'Phân loại kỹ thuật tấn công. Đồng bộ với PunchAnalyzer & KickAnalyzer.';

CREATE TYPE limb_side AS ENUM (
    'LEFT_ARM', 'RIGHT_ARM', 'LEFT_LEG', 'RIGHT_LEG', 'BILATERAL'
);

CREATE TYPE motion_class AS ENUM (
    'TACTICAL_FEINT', 'POWER_STRIKE', 'PARTIAL_STRIKE', 'UNKNOWN'
);
COMMENT ON TYPE motion_class IS 'Mirror của MotionClass enum trong joint_health_tracker.py. Phân loại ý định chuyển động.';

CREATE TYPE alert_severity AS ENUM ('MEDIUM', 'HIGH', 'CRITICAL');
COMMENT ON TYPE alert_severity IS 'Mức độ nghiêm trọng cảnh báo sức khỏe khớp.';

CREATE TYPE alert_review_decision AS ENUM ('PENDING', 'CONFIRMED', 'DISMISSED', 'ESCALATED');

-- Medical domain
CREATE TYPE clearance_type AS ENUM ('TRAINING', 'COMPETITION', 'RETURN_FROM_INJURY');
CREATE TYPE clearance_status AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');
CREATE TYPE injury_severity AS ENUM ('MINOR', 'MODERATE', 'SEVERE', 'CRITICAL');
CREATE TYPE injury_status AS ENUM ('ACTIVE', 'RECOVERING', 'RESOLVED');
CREATE TYPE recovery_plan_status AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- Notifications
CREATE TYPE notification_type AS ENUM (
    'ANOMALY_HIGH', 'ANOMALY_MEDIUM', 'SESSION_REMINDER',
    'MEDICAL_CLEARANCE_EXPIRY', 'VIDEO_PROCESSED', 'SYSTEM',
    'JOINT_IMPAIRMENT_CONFIRMED'
);


-- ─── 2. Utility Function ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION update_updated_at IS 'Trigger function tự động cập nhật cột updated_at.';


-- ─── 3. Core Domain Tables ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT            NOT NULL UNIQUE,
    password_hash   TEXT            NOT NULL,
    role            user_role       NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);
COMMENT ON TABLE  users       IS 'Tài khoản người dùng. Một user tương ứng với đúng một profile (fighter/coach/doctor).';
COMMENT ON COLUMN users.role  IS 'Phân quyền tổng. UI routing và RLS dựa vào cột này.';

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT            NOT NULL UNIQUE,
    name            TEXT            NOT NULL,
    resource        TEXT            NOT NULL,
    action          TEXT            NOT NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  permissions             IS 'Danh mục quyền hạn hạt mịn (Fine-grained Permissions) trong hệ thống.';
COMMENT ON COLUMN permissions.code        IS 'Mã quyền định danh duy nhất (vd: videos:upload, clearances:issue, baselines:update).';
COMMENT ON COLUMN permissions.resource    IS 'Tài nguyên mục tiêu (vd: VIDEO, CLEARANCE, BASELINE, TRAINING).';
COMMENT ON COLUMN permissions.action      IS 'Hành động được phép (vd: CREATE, READ, UPDATE, DELETE, APPROVE).';

CREATE TRIGGER trg_permissions_updated_at
    BEFORE UPDATE ON permissions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS role_permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    role            user_role       NOT NULL,
    permission_id   UUID            NOT NULL REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE (role, permission_id)
);
COMMENT ON TABLE role_permissions IS 'Bảng liên kết phân quyền cho vai trò người dùng (Role-Permission Mapping).';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_permissions (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    permission_id   UUID            NOT NULL REFERENCES permissions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    is_granted      BOOLEAN         NOT NULL DEFAULT TRUE,
    granted_by      UUID            REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_permission UNIQUE (user_id, permission_id)
);
COMMENT ON TABLE user_permissions IS 'Cấp quyền hoặc thu hồi đặc cách cho từng tài khoản cụ thể (Permission Override).';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fighters (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID            NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    first_name              TEXT            NOT NULL,
    last_name               TEXT            NOT NULL,
    date_of_birth           DATE            NOT NULL,
    nationality             TEXT,
    weight_class            weight_class    NOT NULL,
    height_cm               FLOAT           CHECK (height_cm > 0 AND height_cm < 300),
    reach_cm                FLOAT           CHECK (reach_cm > 0 AND reach_cm < 300),
    -- Biomechanics fields (từ Schema Audit)
    dominant_stance         fighter_stance,
    left_arm_cm             FLOAT           CHECK (left_arm_cm  > 0 AND left_arm_cm  < 150),
    right_arm_cm            FLOAT           CHECK (right_arm_cm > 0 AND right_arm_cm < 150),
    left_leg_cm             FLOAT           CHECK (left_leg_cm  > 0 AND left_leg_cm  < 150),
    right_leg_cm            FLOAT           CHECK (right_leg_cm > 0 AND right_leg_cm < 150),
    -- Profile
    gym                     TEXT,
    current_medical_status  medical_status  NOT NULL DEFAULT 'NOT_CLEARED',
    bio                     TEXT,
    profile_image_url       TEXT,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);
COMMENT ON TABLE  fighters IS 'Hồ sơ võ sĩ. One-to-one với users.';
COMMENT ON COLUMN fighters.dominant_stance IS 'ORTHODOX = tay trái dẫn, SOUTHPAW = tay phải dẫn. Ảnh hưởng đến baseline ROM Jab/Cross.';
COMMENT ON COLUMN fighters.left_arm_cm     IS 'Chiều dài tay trái từ vai đến cổ tay (cm). Dùng để normalize peak_speed.';
COMMENT ON COLUMN fighters.left_leg_cm     IS 'Chiều dài chân trái từ hông đến mắt cá (cm). Dùng để normalize kick speed.';

CREATE TRIGGER trg_fighters_updated_at
    BEFORE UPDATE ON fighters
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coaches (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    first_name          TEXT        NOT NULL,
    last_name           TEXT        NOT NULL,
    is_head_coach       BOOLEAN     NOT NULL DEFAULT FALSE,
    specialization      TEXT,
    profile_image_url   TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
COMMENT ON TABLE coaches IS 'Hồ sơ huấn luyện viên. One-to-one với users.';

CREATE TRIGGER trg_coaches_updated_at
    BEFORE UPDATE ON coaches
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sports_doctors (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    first_name          TEXT        NOT NULL,
    last_name           TEXT        NOT NULL,
    license_number      TEXT        NOT NULL UNIQUE,
    specialization      TEXT,
    profile_image_url   TEXT,
    is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
COMMENT ON TABLE sports_doctors IS 'Hồ sơ bác sĩ thể thao. License number là unique business key.';

CREATE TRIGGER trg_sports_doctors_updated_at
    BEFORE UPDATE ON sports_doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_fighters (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id        UUID        NOT NULL REFERENCES coaches(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    fighter_id      UUID        NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    assigned_by_id  UUID        NOT NULL REFERENCES users(id)    ON DELETE RESTRICT ON UPDATE CASCADE,
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT uq_coach_fighter_pair UNIQUE (coach_id, fighter_id)
);
COMMENT ON TABLE coach_fighters IS 'Quan hệ nhiều-nhiều Coach ↔ Fighter. assigned_by_id audit trail ai tạo assignment.';


-- ─── 4. Session Hierarchy ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_plans (
    id          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id  UUID                    NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    coach_id    UUID                    NOT NULL REFERENCES coaches(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
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
    CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER trg_training_plans_updated_at
    BEFORE UPDATE ON training_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS training_sessions (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)      ON DELETE RESTRICT ON UPDATE CASCADE,
    coach_id                UUID            REFERENCES coaches(id)                ON DELETE RESTRICT ON UPDATE CASCADE,
    plan_id                 UUID            REFERENCES training_plans(id)         ON DELETE RESTRICT ON UPDATE CASCADE,
    title                   TEXT            NOT NULL,
    scheduled_at            TIMESTAMPTZ     NOT NULL,
    -- Thời gian: phân biệt dự kiến vs thực tế; đơn vị thống nhất = giây
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
    deleted_at              TIMESTAMPTZ
);
COMMENT ON COLUMN training_sessions.planned_duration_sec IS 'Thời lượng dự kiến (giây). Đồng bộ đơn vị với technique_events.start_time_ms.';
COMMENT ON COLUMN training_sessions.actual_duration_sec  IS 'Thời lượng thực tế. Tính từ checked_in_at đến completed_at/abandoned_at.';
COMMENT ON COLUMN training_sessions.reported_rpe         IS 'Rate of Perceived Exertion thang CR10 (1–10). CHECK constraint bắt buộc.';

CREATE TRIGGER trg_training_sessions_updated_at
    BEFORE UPDATE ON training_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Phân cấp Hiệp đấu (Round) — từ Pipeline Audit
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_rounds (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID        NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE ON UPDATE CASCADE,
    round_number        SMALLINT    NOT NULL CHECK (round_number BETWEEN 1 AND 30),
    -- Thời gian trong video (ms)
    start_time_ms       FLOAT       NOT NULL CHECK (start_time_ms >= 0),
    end_time_ms         FLOAT       NOT NULL CHECK (end_time_ms > start_time_ms),
    duration_ms         FLOAT       GENERATED ALWAYS AS (end_time_ms - start_time_ms) STORED,
    planned_duration_sec INTEGER    CHECK (planned_duration_sec > 0),
    target_rpe          SMALLINT    CHECK (target_rpe BETWEEN 1 AND 10),
    actual_rpe          SMALLINT    CHECK (actual_rpe BETWEEN 1 AND 10),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_round_number UNIQUE (session_id, round_number)
);
COMMENT ON TABLE  session_rounds IS 'Phân cấp hiệp đấu trong session. Suy giảm cơ sinh học tích lũy theo từng hiệp.';
COMMENT ON COLUMN session_rounds.start_time_ms IS 'Timestamp bắt đầu hiệp trong video (ms). Đồng bộ với technique_events.start_time_ms.';

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercises (
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

CREATE TRIGGER trg_exercises_updated_at
    BEFORE UPDATE ON exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS session_exercises (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID        NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE  ON UPDATE CASCADE,
    exercise_id      UUID        NOT NULL REFERENCES exercises(id)          ON DELETE RESTRICT ON UPDATE CASCADE,
    order_index      INTEGER     NOT NULL CHECK (order_index >= 0),
    sets             INTEGER     CHECK (sets > 0),
    reps             INTEGER     CHECK (reps > 0),
    duration_seconds INTEGER     CHECK (duration_seconds > 0),
    target_rpe       SMALLINT    CHECK (target_rpe BETWEEN 1 AND 10),
    coach_notes      TEXT,
    CONSTRAINT uq_session_exercise_order UNIQUE (session_id, order_index)
);


-- ─── 5. AI Algorithm Config & Fighter Baselines ───────────────────────────────
-- PHẢI tạo trước video/analysis vì chúng là FK dependency.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS algorithm_configs (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    version_tag                 TEXT        NOT NULL UNIQUE,
    -- YOLO Pose config
    yolo_model_name             TEXT        NOT NULL,
    conf_threshold              FLOAT       NOT NULL CHECK (conf_threshold BETWEEN 0.0 AND 1.0),
    ema_alpha                   FLOAT       NOT NULL CHECK (ema_alpha BETWEEN 0.0 AND 1.0),
    -- FeintFilter / Jerk thresholds (từ joint_health_tracker.py constants)
    jerk_smooth_threshold       FLOAT       NOT NULL CHECK (jerk_smooth_threshold > 0),
    jerk_smooth_window          INTEGER     NOT NULL DEFAULT 3 CHECK (jerk_smooth_window > 0),
    min_feint_velocity_ratio    FLOAT       NOT NULL DEFAULT 0.20,
    -- Joint Health State Machine thresholds
    rom_low_threshold           FLOAT       NOT NULL CHECK (rom_low_threshold > 0),
    rom_recovery_threshold      FLOAT       NOT NULL CHECK (rom_recovery_threshold > rom_low_threshold),
    consecutive_low_rom_limit   INTEGER     NOT NULL CHECK (consecutive_low_rom_limit > 0),
    window_sec_min              FLOAT       NOT NULL CHECK (window_sec_min > 0),
    window_sec_max              FLOAT       NOT NULL CHECK (window_sec_max > window_sec_min),
    disuse_sec_trigger          FLOAT       NOT NULL CHECK (disuse_sec_trigger > 0),
    -- Mahalanobis anomaly detection (từ Pipeline Audit)
    tau_mahalanobis             FLOAT       DEFAULT 3.0 CHECK (tau_mahalanobis > 0),
    -- Metadata
    notes                       TEXT,
    is_active                   BOOLEAN     NOT NULL DEFAULT FALSE,
    activated_at                TIMESTAMPTZ,
    deprecated_at               TIMESTAMPTZ,
    created_by                  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  algorithm_configs IS 'Version control toàn bộ hyperparameter của AI pipeline. KHÔNG xóa — chỉ deprecated_at.';
COMMENT ON COLUMN algorithm_configs.version_tag IS 'Semantic version gắn với git tag, ví dụ: v1.2.0-yolov8n-pose.';
COMMENT ON COLUMN algorithm_configs.is_active   IS 'Chỉ một config được active tại một thời điểm. Enforced bởi partial unique index.';
COMMENT ON COLUMN algorithm_configs.tau_mahalanobis IS 'Ngưỡng D_M. Đòn bị đánh dấu SUSPECTED khi D_M > tau_mahalanobis VÀ jerk > jerk_smooth_threshold.';

-- Chỉ một config active tại một thời điểm
CREATE UNIQUE INDEX uidx_algorithm_configs_single_active
    ON algorithm_configs (is_active)
    WHERE is_active = TRUE;

-- Seed bản ghi đầu tiên từ Python constants (joint_health_tracker.py lines 41-70)
INSERT INTO algorithm_configs (
    version_tag, yolo_model_name, conf_threshold, ema_alpha,
    jerk_smooth_threshold, jerk_smooth_window, min_feint_velocity_ratio,
    rom_low_threshold, rom_recovery_threshold, consecutive_low_rom_limit,
    window_sec_min, window_sec_max, disuse_sec_trigger,
    tau_mahalanobis, notes, is_active, activated_at
) VALUES (
    'v1.0.0-yolov8n-pose', 'yolov8n-pose', 0.50, 0.35,
    120.0, 3, 0.20,
    0.60, 0.90, 5,
    60.0, 120.0, 60.0,
    3.0,
    'Seed từ hardcode constants trong joint_health_tracker.py v1.0. ROM_LOW_THRESHOLD=0.60, CONSECUTIVE_LOW_ROM_LIMIT=5.',
    TRUE, NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fighter Baselines — cá nhân hóa thay thế BASELINE_ROM_BY_TECHNIQUE hardcode
-- Merged: Schema Audit (structure) + Pipeline Audit (covariance_matrix, is_locked)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fighter_baselines (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)          ON DELETE RESTRICT ON UPDATE CASCADE,
    algorithm_config_id     UUID            NOT NULL REFERENCES algorithm_configs(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    technique_type          technique_type  NOT NULL,
    limb_side               limb_side       NOT NULL,
    -- Biomechanical baseline values
    rom_baseline_deg        FLOAT           NOT NULL CHECK (rom_baseline_deg BETWEEN 0 AND 180),
    velocity_baseline       FLOAT           NOT NULL CHECK (velocity_baseline > 0),
    jerk_threshold          FLOAT           NOT NULL CHECK (jerk_threshold > 0),
    -- Mahalanobis Distance support (từ Pipeline Audit)
    -- Lưu ma trận hiệp phương sai nghịch đảo Σ⁻¹ dạng JSON array 2D
    covariance_matrix       JSONB           NOT NULL DEFAULT '[]',
    -- Confidence in baseline
    sample_count            INTEGER         NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
    sample_sessions         INTEGER         NOT NULL DEFAULT 0,
    std_dev_rom             FLOAT,
    -- Lifecycle
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- is_locked: Khóa khi bác sĩ/HLV duyệt — không auto-recalculate (từ Pipeline Audit)
    is_locked               BOOLEAN         NOT NULL DEFAULT FALSE,
    calculated_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at              TIMESTAMPTZ,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  fighter_baselines IS 'Baseline ROM & velocity cá nhân hóa. Thay thế BASELINE_ROM_BY_TECHNIQUE hardcode trong Python worker.';
COMMENT ON COLUMN fighter_baselines.sample_count      IS 'Số đòn đã dùng để tính baseline. Chỉ tin cậy khi sample_count >= 30.';
COMMENT ON COLUMN fighter_baselines.covariance_matrix IS 'Ma trận Σ⁻¹ dạng [[...],[...]] để tính D_M = sqrt((x-μ)^T Σ^-1 (x-μ)). Trống = dùng ngưỡng đơn giản.';
COMMENT ON COLUMN fighter_baselines.is_locked         IS 'TRUE = bác sĩ/HLV đã phê duyệt baseline. Không tự động recalculate.';

CREATE UNIQUE INDEX uidx_fighter_baselines_active
    ON fighter_baselines (fighter_id, technique_type, limb_side, algorithm_config_id)
    WHERE is_active = TRUE;

CREATE TRIGGER trg_fighter_baselines_updated_at
    BEFORE UPDATE ON fighter_baselines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── 6. Video & AI Analysis Pipeline ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_fighter_id  UUID            NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    uploaded_by_id      UUID            NOT NULL REFERENCES users(id)    ON DELETE RESTRICT ON UPDATE CASCADE,
    session_id          UUID            REFERENCES training_sessions(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    title               TEXT            NOT NULL,
    description         TEXT,
    -- Storage
    r2_key              TEXT            NOT NULL,
    r2_bucket           TEXT            NOT NULL,
    file_size_bytes     BIGINT          NOT NULL CHECK (file_size_bytes > 0),
    mime_type           TEXT            NOT NULL CHECK (mime_type LIKE 'video/%'),
    -- Video metadata (cần cho frame ↔ timestamp sync trong YOLO)
    duration_ms         INTEGER         CHECK (duration_ms > 0),
    fps                 FLOAT           CHECK (fps > 0 AND fps <= 240),
    resolution_width    INTEGER         CHECK (resolution_width > 0),
    resolution_height   INTEGER         CHECK (resolution_height > 0),
    camera_angle        camera_angle    NOT NULL DEFAULT 'UNKNOWN',
    -- Status
    status              video_status    NOT NULL DEFAULT 'PENDING_UPLOAD',
    rejection_reason    TEXT,
    thumbnail_url       TEXT,
    recorded_at         TIMESTAMPTZ,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
COMMENT ON COLUMN videos.fps              IS 'Frame rate thực tế (Hz). Dùng để convert frame_idx ↔ time_ms: time_ms = frame_idx / fps * 1000.';
COMMENT ON COLUMN videos.duration_ms      IS 'Thời lượng video (ms). Đơn vị thống nhất với technique_events.start_time_ms.';
COMMENT ON COLUMN videos.camera_angle     IS 'Góc quay ảnh hưởng accuracy của YOLO-Pose. SIDE cho angle estimation tốt nhất.';

CREATE TRIGGER trg_videos_updated_at
    BEFORE UPDATE ON videos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_analyses (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id                UUID                NOT NULL REFERENCES videos(id)             ON DELETE CASCADE  ON UPDATE CASCADE,
    algorithm_config_id     UUID                NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    status                  ai_analysis_status  NOT NULL DEFAULT 'QUEUED',
    confidence_score        FLOAT               CHECK (confidence_score BETWEEN 0.0 AND 1.0),
    requires_review         BOOLEAN             NOT NULL DEFAULT FALSE,
    anomaly_level           anomaly_level,
    -- High-level scores (đã tính sẵn — không dùng JSONB cho số liệu này)
    footwork_score          FLOAT               CHECK (footwork_score BETWEEN 0 AND 100),
    guard_score             FLOAT               CHECK (guard_score BETWEEN 0 AND 100),
    head_movement_score     FLOAT               CHECK (head_movement_score BETWEEN 0 AND 100),
    -- Style summary (JSONB OK — là object tĩnh, không cần index individual fields)
    style_profile           JSONB,
    clip_urls               TEXT[]              NOT NULL DEFAULT '{}',
    -- Processing metadata
    processing_started_at   TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message           TEXT,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  ai_analyses IS 'Kết quả phân tích AI cấp video. Dữ liệu chi tiết (strikes, alerts) ở technique_events và health_alerts.';
COMMENT ON COLUMN ai_analyses.algorithm_config_id IS 'CRITICAL: Biết ngưỡng nào tạo ra analysis này. Cho phép invalidate/rerun khi nâng cấp model.';
COMMENT ON COLUMN ai_analyses.style_profile       IS 'JSONB OK ở đây: snapshot tĩnh tổng quan phong cách chiến đấu. Không cần query field-level.';

CREATE TRIGGER trg_ai_analyses_updated_at
    BEFORE UPDATE ON ai_analyses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Domain model links (fix Schema Split Brain)
    fighter_id              UUID        REFERENCES fighters(id)          ON DELETE RESTRICT,
    session_id              UUID        REFERENCES training_sessions(id) ON DELETE RESTRICT,
    video_id                UUID        REFERENCES videos(id)            ON DELETE RESTRICT,
    algorithm_config_id     UUID        REFERENCES algorithm_configs(id) ON DELETE RESTRICT,
    -- Legacy fields (giữ tương thích ngược với BullMQ worker)
    user_id                 TEXT        NOT NULL DEFAULT 'anonymous',
    video_url               TEXT        NOT NULL,
    status                  job_status  NOT NULL DEFAULT 'PENDING',
    result_url              TEXT,
    -- Scores (patched: thêm CHECK constraint, tách best vs avg)
    best_score              SMALLINT    CHECK (best_score BETWEEN 0 AND 100),
    avg_score               FLOAT       CHECK (avg_score BETWEEN 0 AND 100),
    total_punches           INTEGER     NOT NULL DEFAULT 0 CHECK (total_punches >= 0),
    total_kicks             INTEGER     NOT NULL DEFAULT 0 CHECK (total_kicks >= 0),
    -- Anomaly summary (cache để tránh query health_alerts table)
    alert_count             INTEGER     NOT NULL DEFAULT 0 CHECK (alert_count >= 0),
    has_impairment          BOOLEAN     NOT NULL DEFAULT FALSE,
    -- joint_states JSONB OK: snapshot cuối session — không cần query fields riêng lẻ
    joint_states            JSONB       NOT NULL DEFAULT '{}',
    -- Performance monitoring
    processing_duration_ms  INTEGER     CHECK (processing_duration_ms >= 0),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  analysis_jobs IS 'Job queue table (BullMQ-compatible). Sau khi DONE, dữ liệu chi tiết ở technique_events & health_alerts.';
COMMENT ON COLUMN analysis_jobs.joint_states   IS 'Map {JointName→JointHealthState} snapshot cuối session. JSONB OK — đây là snapshot tĩnh.';
COMMENT ON COLUMN analysis_jobs.has_impairment IS 'Cache flag: TRUE nếu có ≥1 CONFIRMED_IMPAIRMENT. Partial index cho dashboard.';

CREATE TRIGGER trg_analysis_jobs_updated_at
    BEFORE UPDATE ON analysis_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coach_reviews (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id             UUID        NOT NULL REFERENCES ai_analyses(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    coach_id                UUID        NOT NULL REFERENCES coaches(id)     ON DELETE RESTRICT ON UPDATE CASCADE,
    review_text             TEXT        NOT NULL,
    technique_rating        SMALLINT    CHECK (technique_rating BETWEEN 1 AND 10),
    corrected_strike_counts JSONB,
    overrides_ai            BOOLEAN     NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);

CREATE TRIGGER trg_coach_reviews_updated_at
    BEFORE UPDATE ON coach_reviews
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── 7. Technique Events — Core Time-Series Table ────────────────────────────
-- Thay thế hoàn toàn: ai_analyses.strikes_detected JSONB
-- Mỗi PunchResult hoặc KickResult từ Python worker = 1 hàng
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS technique_events (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Liên kết context
    analysis_id             UUID            NOT NULL REFERENCES ai_analyses(id)        ON DELETE CASCADE  ON UPDATE CASCADE,
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT ON UPDATE CASCADE,
    session_id              UUID            REFERENCES training_sessions(id)            ON DELETE RESTRICT ON UPDATE CASCADE,
    round_id                UUID            REFERENCES session_rounds(id)               ON DELETE SET NULL ON UPDATE CASCADE,
    video_id                UUID            REFERENCES videos(id)                       ON DELETE SET NULL ON UPDATE CASCADE,
    algorithm_config_id     UUID            NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    -- Phân loại kỹ thuật
    technique_type          technique_type  NOT NULL,
    limb_side               limb_side       NOT NULL,
    -- Timeline trong video (ms) — đơn vị thống nhất
    start_time_ms           FLOAT           NOT NULL CHECK (start_time_ms >= 0),
    impact_time_ms          FLOAT           NOT NULL CHECK (impact_time_ms >= start_time_ms),
    end_time_ms             FLOAT           NOT NULL CHECK (end_time_ms >= impact_time_ms),
    -- Frame range (đồng bộ PunchResult/KickResult fields)
    start_frame             INTEGER         NOT NULL CHECK (start_frame >= 0),
    impact_frame            INTEGER         NOT NULL CHECK (impact_frame >= start_frame),
    end_frame               INTEGER         NOT NULL CHECK (end_frame >= impact_frame),
    -- Chấm điểm (từ PunchAnalyzer/KickAnalyzer)
    score                   SMALLINT        NOT NULL CHECK (score BETWEEN 0 AND 100),
    grade                   TEXT            NOT NULL CHECK (grade IN ('PERFECT','GOOD','FAIR','NEEDS_WORK')),
    -- Biometric metrics — đòn đấm
    max_elbow_angle_deg     FLOAT           CHECK (max_elbow_angle_deg BETWEEN 0 AND 180),
    -- Biometric metrics — đòn đá
    min_chamber_angle_deg   FLOAT           CHECK (min_chamber_angle_deg BETWEEN 0 AND 180),
    max_extension_angle_deg FLOAT           CHECK (max_extension_angle_deg BETWEEN 0 AND 180),
    -- Metrics chung
    peak_speed_norm         FLOAT           NOT NULL CHECK (peak_speed_norm >= 0),
    guard_preserved         BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Anomaly detection (từ Pipeline Audit — Mahalanobis + Autoencoder)
    is_feint                BOOLEAN         NOT NULL DEFAULT FALSE,
    motion_class            motion_class    NOT NULL DEFAULT 'UNKNOWN',
    mahalanobis_dist        FLOAT           CHECK (mahalanobis_dist >= 0),
    reconstruction_error    FLOAT           CHECK (reconstruction_error >= 0),
    -- So sánh với baseline cá nhân của võ sĩ
    rom_ratio               FLOAT           CHECK (rom_ratio >= 0),
    baseline_id             UUID            REFERENCES fighter_baselines(id) ON DELETE SET NULL,
    -- Timestamp thực tế để query time-series
    event_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  technique_events IS '🏆 CORE TABLE. 1 row = 1 PunchResult hoặc KickResult từ Python worker. Candidate cho TimescaleDB hypertable.';
COMMENT ON COLUMN technique_events.peak_speed_norm      IS 'Tốc độ đỉnh đã chuẩn hóa theo torso_length (u/s). KHÔNG phải pixel/s hay m/s.';
COMMENT ON COLUMN technique_events.max_elbow_angle_deg  IS 'Góc khuỷu tay tại impact (độ). NULL cho kỹ thuật đá.';
COMMENT ON COLUMN technique_events.min_chamber_angle_deg IS 'Góc gối khi rút chân (độ). NULL cho kỹ thuật đấm.';
COMMENT ON COLUMN technique_events.rom_ratio            IS 'peak_speed_norm / velocity_baseline. < 0.60 = ROM thấp theo ROM_LOW_THRESHOLD.';
COMMENT ON COLUMN technique_events.is_feint             IS 'TRUE = FeintFilter phân loại là đòn nhử. Indexed riêng để tránh false positive.';
COMMENT ON COLUMN technique_events.mahalanobis_dist     IS 'D_M = sqrt((x-μ)^T Σ^-1 (x-μ)). > tau_mahalanobis = đáng ngờ.';
COMMENT ON COLUMN technique_events.reconstruction_error IS 'Autoencoder MSE. Dữ phòng khi không có Mahalanobis đủ sample.';


-- ─── 8. Joint Health Monitoring ──────────────────────────────────────────────

-- Live State Table — trạng thái hiện tại của từng khớp mỗi võ sĩ (từ Pipeline Audit)
CREATE TABLE IF NOT EXISTS fighter_joint_states (
    id                          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id                  UUID                NOT NULL REFERENCES fighters(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    joint                       body_joint          NOT NULL,
    current_state               joint_health_state  NOT NULL DEFAULT 'HEALTHY',
    state_updated_at            TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    consecutive_suspected_count INTEGER             NOT NULL DEFAULT 0 CHECK (consecutive_suspected_count >= 0),
    -- Link đến event đã trigger trạng thái hiện tại
    last_trigger_event_id       UUID                REFERENCES technique_events(id) ON DELETE SET NULL,
    last_trigger_alert_id       UUID,               -- FK → health_alerts (thêm sau khi tạo bảng đó)
    window_started_at           TIMESTAMPTZ,        -- Khi nào bắt đầu cửa sổ SUSPECTED/AVOIDANCE
    notes                       TEXT,
    CONSTRAINT uq_fighter_joint UNIQUE (fighter_id, joint)
);
COMMENT ON TABLE  fighter_joint_states IS '🔴 LIVE STATE TABLE. 1 row per (fighter, joint). Cập nhật real-time bởi Python worker. Đây là "bộ nhớ ngắn hạn" của State Machine.';
COMMENT ON COLUMN fighter_joint_states.current_state               IS 'Trạng thái hiện tại. Dashboard đọc bảng này — không scan technique_events.';
COMMENT ON COLUMN fighter_joint_states.consecutive_suspected_count IS 'Counter đòn liên tiếp ROM thấp. Reset về 0 khi de-flag về HEALTHY.';
COMMENT ON COLUMN fighter_joint_states.window_started_at           IS 'Mốc thời gian bắt đầu cửa sổ quan sát (60–120s). Dùng để check window timeout.';

-- ─────────────────────────────────────────────────────────────────────────────

-- Append-only Joint Health Log — lịch sử trạng thái khớp qua các session
CREATE TABLE IF NOT EXISTS joint_health_history (
    id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id          UUID                NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT,
    session_id          UUID                REFERENCES training_sessions(id)            ON DELETE SET NULL,
    analysis_id         UUID                REFERENCES ai_analyses(id)                 ON DELETE SET NULL,
    joint               body_joint          NOT NULL,
    state               joint_health_state  NOT NULL,
    rom_ratio           FLOAT               CHECK (rom_ratio >= 0),
    algorithm_config_id UUID                NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    recorded_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE joint_health_history IS 'Append-only log lịch sử trạng thái khớp. Phát hiện xu hướng chấn thương dài hạn.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Health Alerts — chuẩn hóa từ JSONB blob
-- Merged: Schema Audit (workflow, FK) + Pipeline Audit (compensatory_pattern_detected)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS health_alerts (
    id                          UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Context links
    analysis_id                 UUID                    NOT NULL REFERENCES ai_analyses(id)        ON DELETE CASCADE  ON UPDATE CASCADE,
    fighter_id                  UUID                    NOT NULL REFERENCES fighters(id)            ON DELETE RESTRICT ON UPDATE CASCADE,
    session_id                  UUID                    REFERENCES training_sessions(id)            ON DELETE SET NULL ON UPDATE CASCADE,
    round_id                    UUID                    REFERENCES session_rounds(id)               ON DELETE SET NULL ON UPDATE CASCADE,
    -- Alert payload (mirror AlertPayload.to_dict() từ joint_health_tracker.py)
    joint                       body_joint              NOT NULL,
    state                       joint_health_state      NOT NULL DEFAULT 'CONFIRMED_IMPAIRMENT',
    severity                    alert_severity          NOT NULL,
    trigger_time_ms             FLOAT                   NOT NULL CHECK (trigger_time_ms >= 0),
    window_start_ms             FLOAT                   NOT NULL CHECK (window_start_ms >= 0),
    consecutive_low_rom         INTEGER                 NOT NULL CHECK (consecutive_low_rom > 0),
    avg_rom_ratio               FLOAT                   NOT NULL CHECK (avg_rom_ratio BETWEEN 0.0 AND 2.0),
    motion_class                motion_class            NOT NULL,
    recommendation              TEXT                    NOT NULL,
    -- Context snapshot cho bác sĩ review (từ Pipeline Audit)
    technique_type              technique_type,
    technique_event_id          UUID                    REFERENCES technique_events(id)             ON DELETE SET NULL,
    -- Compensatory movement detection (từ Pipeline Audit — Isolated Joint Tunnel-Vision fix)
    compensatory_pattern_detected TEXT,
    -- Các khớp lân cận cũng bị ảnh hưởng (để phát hiện compensatory chain)
    affected_adjacent_joints    body_joint[],
    -- Algorithm traceability (BẮT BUỘC cho hệ thống y tế)
    algorithm_config_id         UUID                    NOT NULL REFERENCES algorithm_configs(id)  ON DELETE RESTRICT,
    baseline_id                 UUID                    REFERENCES fighter_baselines(id)            ON DELETE SET NULL,
    -- Medical review workflow
    review_decision             alert_review_decision   NOT NULL DEFAULT 'PENDING',
    reviewed_by                 UUID                    REFERENCES users(id)                        ON DELETE SET NULL,
    reviewed_at                 TIMESTAMPTZ,
    review_notes                TEXT,
    -- Escalation: nếu bác sĩ xác nhận → tạo InjuryRecord
    linked_injury_record_id     UUID,                   -- FK → injury_records (thêm sau)
    created_at                  TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  health_alerts IS 'Chuẩn hóa từ analysis_jobs.health_alerts JSONB. Mỗi CONFIRMED_IMPAIRMENT alert = 1 hàng có đầy đủ context.';
COMMENT ON COLUMN health_alerts.trigger_time_ms IS 'Thời điểm ms trong video khi alert triggered. Dùng để video seek.';
COMMENT ON COLUMN health_alerts.avg_rom_ratio   IS 'ROM trung bình trong cửa sổ quan sát ÷ baseline cá nhân. < 0.60 = đáng lo ngại.';
COMMENT ON COLUMN health_alerts.compensatory_pattern_detected IS 'Mô tả bù trừ lực. Ví dụ: "Nghiêng cột sống 18° sang phải để bù lực đấm tay trái".';
COMMENT ON COLUMN health_alerts.affected_adjacent_joints IS 'Các khớp lân cận bị ảnh hưởng theo cơ chế bù trừ (Compensatory Movement Chain).';
COMMENT ON COLUMN health_alerts.algorithm_config_id IS 'CRITICAL: Ngưỡng nào tạo ra alert này. Nếu thay ngưỡng, có thể invalidate alert lịch sử.';

-- Thêm FK lại sau khi bảng health_alerts đã tạo
ALTER TABLE fighter_joint_states
    ADD CONSTRAINT fk_fjstates_last_alert
    FOREIGN KEY (last_trigger_alert_id) REFERENCES health_alerts(id) ON DELETE SET NULL;


-- ─── 9. Medical Domain ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS medical_clearances (
    id              UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id      UUID                NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    issued_by_id    UUID                NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    clearance_type  clearance_type      NOT NULL,
    status          clearance_status    NOT NULL DEFAULT 'ACTIVE',
    valid_from      TIMESTAMPTZ         NOT NULL,
    valid_until     TIMESTAMPTZ,
    notes           TEXT,
    -- Structured scope (thay vì JSONB tự do)
    allowed_session_types   session_type[],         -- NULL = tất cả
    allowed_technique_types technique_type[],       -- NULL = tất cả
    excluded_joints         body_joint[],           -- Khớp không được tập nặng
    -- Revocation audit trail
    revoked_at      TIMESTAMPTZ,
    revoked_by_id   UUID                REFERENCES sports_doctors(id) ON DELETE RESTRICT,
    revoked_reason  TEXT,
    is_active       BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    CHECK (valid_until IS NULL OR valid_until > valid_from)
);
COMMENT ON COLUMN medical_clearances.allowed_session_types   IS 'NULL = được phép tất cả loại session. Non-null = chỉ những loại này.';
COMMENT ON COLUMN medical_clearances.excluded_joints         IS 'Khớp bị giới hạn, ví dụ: LEFT_ELBOW sau chấn thương. Dùng để filter technique_events.';

CREATE TRIGGER trg_medical_clearances_updated_at
    BEFORE UPDATE ON medical_clearances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS injury_records (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id              UUID                NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    reported_by_id          UUID                NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    -- bodyPart nay là Enum đồng nhất với body_joint (sửa từ TEXT tự do)
    affected_joint          body_joint          NOT NULL,
    injury_type             TEXT                NOT NULL,
    severity                injury_severity     NOT NULL,
    occurred_at             TIMESTAMPTZ         NOT NULL,
    description             TEXT,
    -- Video context snapshot (từ Schema Audit)
    trigger_video_id        UUID                REFERENCES videos(id) ON DELETE SET NULL,
    trigger_time_ms         FLOAT               CHECK (trigger_time_ms >= 0),
    -- Link từ AI alert đã escalate thành injury
    source_alert_id         UUID                REFERENCES health_alerts(id) ON DELETE SET NULL,
    status                  injury_status       NOT NULL DEFAULT 'ACTIVE',
    resolved_at             TIMESTAMPTZ,
    is_active               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ
);
COMMENT ON COLUMN injury_records.affected_joint  IS 'Khớp bị chấn thương — dùng body_joint enum, đồng bộ với joint_health_tracker.py JointName.';
COMMENT ON COLUMN injury_records.source_alert_id IS 'Link đến health_alerts đã trigger ra injury này. Chain: Alert → Clinical Review → Diagnosis.';

CREATE TRIGGER trg_injury_records_updated_at
    BEFORE UPDATE ON injury_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cập nhật FK ngược từ health_alerts
ALTER TABLE health_alerts
    ADD CONSTRAINT fk_alerts_injury
    FOREIGN KEY (linked_injury_record_id) REFERENCES injury_records(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS treatments (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    injury_id       UUID        NOT NULL REFERENCES injury_records(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    doctor_id       UUID        NOT NULL REFERENCES sports_doctors(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
    treatment_date  TIMESTAMPTZ NOT NULL,
    treatment_type  TEXT        NOT NULL,
    description     TEXT,
    outcome_notes   TEXT,
    next_review_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_treatments_updated_at
    BEFORE UPDATE ON treatments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recovery_plans (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    fighter_id      UUID                    NOT NULL REFERENCES fighters(id)       ON DELETE RESTRICT ON UPDATE CASCADE,
    injury_id       UUID                    NOT NULL REFERENCES injury_records(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    doctor_id       UUID                    NOT NULL REFERENCES sports_doctors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
    title           TEXT                    NOT NULL,
    description     TEXT,
    start_date      DATE                    NOT NULL,
    estimated_end_date DATE,
    actual_end_date DATE,
    status          recovery_plan_status    NOT NULL DEFAULT 'ACTIVE',
    milestones      JSONB                   NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE TRIGGER trg_recovery_plans_updated_at
    BEFORE UPDATE ON recovery_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── 10. Aggregation Layer ────────────────────────────────────────────────────
-- Dashboard reads here — KHÔNG query raw technique_events cho summary views.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS round_summaries (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    round_id                UUID            NOT NULL UNIQUE REFERENCES session_rounds(id)  ON DELETE CASCADE,
    session_id              UUID            NOT NULL REFERENCES training_sessions(id)      ON DELETE CASCADE,
    fighter_id              UUID            NOT NULL REFERENCES fighters(id)               ON DELETE RESTRICT,
    analysis_id             UUID            REFERENCES ai_analyses(id)                    ON DELETE SET NULL,
    -- Strike counts
    total_strikes           INTEGER         NOT NULL DEFAULT 0,
    total_punches           INTEGER         NOT NULL DEFAULT 0,
    total_kicks             INTEGER         NOT NULL DEFAULT 0,
    total_feints            INTEGER         NOT NULL DEFAULT 0,
    -- Scoring breakdown
    avg_strike_score        FLOAT           CHECK (avg_strike_score BETWEEN 0 AND 100),
    best_strike_score       SMALLINT        CHECK (best_strike_score BETWEEN 0 AND 100),
    perfect_count           INTEGER         NOT NULL DEFAULT 0,
    good_count              INTEGER         NOT NULL DEFAULT 0,
    fair_count              INTEGER         NOT NULL DEFAULT 0,
    needs_work_count        INTEGER         NOT NULL DEFAULT 0,
    -- Biomechanical aggregates
    avg_rom_ratio           FLOAT           CHECK (avg_rom_ratio >= 0),
    avg_peak_speed_norm     FLOAT           CHECK (avg_peak_speed_norm >= 0),
    avg_elbow_angle_deg     FLOAT           CHECK (avg_elbow_angle_deg BETWEEN 0 AND 180),
    -- Guard & safety
    guard_drop_count        INTEGER         NOT NULL DEFAULT 0,
    guard_retention_rate    FLOAT           CHECK (guard_retention_rate BETWEEN 0 AND 100),
    -- Anomaly summary
    health_alert_count      INTEGER         NOT NULL DEFAULT 0,
    suspected_joint_count   INTEGER         NOT NULL DEFAULT 0,
    -- Dominant pattern
    dominant_motion_class   motion_class,
    power_strike_ratio      FLOAT           CHECK (power_strike_ratio BETWEEN 0.0 AND 1.0),
    -- Timestamps
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE round_summaries IS 'Pre-aggregated data theo từng hiệp. Dashboard coach đọc từ đây (<50ms). Tạo sau khi analysis hoàn thành.';

CREATE TRIGGER trg_round_summaries_updated_at
    BEFORE UPDATE ON round_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_summaries (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              UUID        NOT NULL UNIQUE REFERENCES training_sessions(id) ON DELETE CASCADE,
    fighter_id              UUID        NOT NULL REFERENCES fighters(id)                  ON DELETE RESTRICT,
    analysis_id             UUID        UNIQUE REFERENCES ai_analyses(id)                ON DELETE SET NULL,
    algorithm_config_id     UUID        NOT NULL REFERENCES algorithm_configs(id)        ON DELETE RESTRICT,
    -- Counts
    total_rounds            SMALLINT    NOT NULL DEFAULT 0,
    total_strikes           INTEGER     NOT NULL DEFAULT 0,
    total_punches           INTEGER     NOT NULL DEFAULT 0,
    total_kicks             INTEGER     NOT NULL DEFAULT 0,
    -- Scoring
    avg_session_score       FLOAT       CHECK (avg_session_score BETWEEN 0 AND 100),
    best_strike_score       SMALLINT    CHECK (best_strike_score BETWEEN 0 AND 100),
    -- Biomechanical aggregates
    avg_rom_ratio           FLOAT       CHECK (avg_rom_ratio >= 0),
    avg_peak_speed_norm     FLOAT,
    -- Health summary
    impairment_detected     BOOLEAN     NOT NULL DEFAULT FALSE,
    confirmed_alert_count   INTEGER     NOT NULL DEFAULT 0,
    -- Joint state snapshot cuối session (JSONB OK — tĩnh)
    joint_states            JSONB       NOT NULL DEFAULT '{}',
    -- Trend deltas (so với session liền trước của cùng fighter)
    score_delta             FLOAT,      -- Positive = tiến bộ
    rom_delta               FLOAT,
    -- Timestamps
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE  session_summaries IS 'Pre-aggregated data cấp session. Trend analysis và comparison dashboard.';
COMMENT ON COLUMN session_summaries.score_delta IS 'Chênh lệch avg_score vs session liền trước. Positive = tiến bộ, Negative = tụt lùi.';
COMMENT ON COLUMN session_summaries.joint_states IS 'Snapshot Map{JointName→JointHealthState} cuối session. JSONB chấp nhận được vì là snapshot tĩnh.';

CREATE TRIGGER trg_session_summaries_updated_at
    BEFORE UPDATE ON session_summaries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── 11. Notifications & Audit Logs ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id              UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID                    NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    type            notification_type       NOT NULL,
    title           TEXT                    NOT NULL,
    message         TEXT                    NOT NULL,
    payload         JSONB                   NOT NULL DEFAULT '{}',
    is_read         BOOLEAN                 NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN notifications.payload IS 'Extra data tùy theo type. Ví dụ: JOINT_IMPAIRMENT_CONFIRMED → {alert_id, joint, fighter_id}.';

CREATE TABLE IF NOT EXISTS audit_logs (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID        REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT        NOT NULL,
    table_name      TEXT        NOT NULL,
    record_id       UUID,
    old_values      JSONB,
    new_values      JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_logs IS 'Immutable audit trail. Không có updated_at, không có DELETE. Append-only.';


-- ─── 12. Indexes ─────────────────────────────────────────────────────────────

-- ── users ──
CREATE INDEX idx_users_role_active ON users (role, is_active);

-- ── permissions ──
CREATE INDEX idx_permissions_resource_action ON permissions (resource, action);
CREATE INDEX idx_role_permissions_role       ON role_permissions (role);
CREATE INDEX idx_user_permissions_user       ON user_permissions (user_id);

-- ── fighters ──
CREATE INDEX idx_fighters_user_id              ON fighters (user_id);
CREATE INDEX idx_fighters_medical_status       ON fighters (current_medical_status) WHERE current_medical_status != 'HEALTHY';
CREATE INDEX idx_fighters_weight_class         ON fighters (weight_class);

-- ── coach_fighters ──
CREATE INDEX idx_coach_fighters_fighter_id     ON coach_fighters (fighter_id);
CREATE INDEX idx_coach_fighters_coach_active   ON coach_fighters (coach_id, is_active);

-- ── training_plans ──
CREATE INDEX idx_training_plans_fighter        ON training_plans (fighter_id);
CREATE INDEX idx_training_plans_coach          ON training_plans (coach_id);
CREATE INDEX idx_training_plans_status         ON training_plans (status);

-- ── training_sessions ──
CREATE INDEX idx_training_sessions_fighter_time  ON training_sessions (fighter_id, scheduled_at DESC);
CREATE INDEX idx_training_sessions_fighter_status ON training_sessions (fighter_id, status);
CREATE INDEX idx_training_sessions_plan          ON training_sessions (plan_id);
CREATE INDEX idx_training_sessions_scheduled     ON training_sessions (scheduled_at);

-- ── session_rounds ──
CREATE INDEX idx_session_rounds_session        ON session_rounds (session_id);

-- ── videos ──
CREATE INDEX idx_videos_fighter_id             ON videos (subject_fighter_id);
CREATE INDEX idx_videos_session_id             ON videos (session_id);
CREATE INDEX idx_videos_status                 ON videos (status);

-- ── algorithm_configs ──
CREATE INDEX idx_algorithm_configs_active      ON algorithm_configs (is_active, created_at DESC);

-- ── fighter_baselines ──
CREATE INDEX idx_fighter_baselines_fighter     ON fighter_baselines (fighter_id);
CREATE INDEX idx_fighter_baselines_lookup      ON fighter_baselines (fighter_id, technique_type, limb_side);

-- ── ai_analyses ──
CREATE INDEX idx_ai_analyses_video             ON ai_analyses (video_id);
CREATE INDEX idx_ai_analyses_status            ON ai_analyses (status);
CREATE INDEX idx_ai_analyses_anomaly           ON ai_analyses (anomaly_level);
CREATE INDEX idx_ai_analyses_config            ON ai_analyses (algorithm_config_id);

-- ── analysis_jobs ──
CREATE INDEX idx_analysis_jobs_fighter_time    ON analysis_jobs (fighter_id, created_at DESC);
CREATE INDEX idx_analysis_jobs_status          ON analysis_jobs (status);
CREATE INDEX idx_analysis_jobs_impairment      ON analysis_jobs (has_impairment) WHERE has_impairment = TRUE;
CREATE INDEX idx_analysis_jobs_failed          ON analysis_jobs (status, created_at DESC) WHERE status = 'FAILED';

-- ── technique_events — CRITICAL QUERY PATHS ──
-- Q1: "Tất cả đòn của Fighter X trong Session Y theo thứ tự thời gian"
CREATE INDEX idx_te_fighter_session_time       ON technique_events (fighter_id, session_id, start_time_ms ASC);
-- Q2: "Trend ROM của Fighter X trong 30 ngày, theo kỹ thuật"
CREATE INDEX idx_te_fighter_technique_time     ON technique_events (fighter_id, technique_type, event_at DESC);
-- Q3: "Đòn có guard_preserved = FALSE trong một analysis" (safety audit)
CREATE INDEX idx_te_guard_dropped              ON technique_events (analysis_id, guard_preserved) WHERE guard_preserved = FALSE;
-- Q4: "Đòn có rom_ratio thấp" (nghi ngờ chấn thương)
CREATE INDEX idx_te_low_rom                    ON technique_events (fighter_id, rom_ratio ASC) WHERE rom_ratio < 0.70;
-- Q5: Score distribution trong một session
CREATE INDEX idx_te_session_score              ON technique_events (session_id, score DESC);
-- Q6: Anomaly scan — Mahalanobis vượt ngưỡng
CREATE INDEX idx_te_mahalanobis_anomaly        ON technique_events (fighter_id, is_feint, mahalanobis_dist DESC) WHERE mahalanobis_dist > 3.0;
-- Q7: Round-level analysis
CREATE INDEX idx_te_round_technique            ON technique_events (round_id, technique_type);

-- ── fighter_joint_states ──
CREATE INDEX idx_fjs_fighter_state             ON fighter_joint_states (fighter_id, current_state);
CREATE INDEX idx_fjs_non_healthy               ON fighter_joint_states (fighter_id, joint, state_updated_at DESC) WHERE current_state != 'HEALTHY';

-- ── joint_health_history ──
CREATE INDEX idx_jhh_fighter_joint_time        ON joint_health_history (fighter_id, joint, recorded_at DESC);
CREATE INDEX idx_jhh_session                   ON joint_health_history (session_id);

-- ── health_alerts ──
-- Q: "Tất cả alert chưa review của Fighter X"
CREATE INDEX idx_ha_fighter_pending            ON health_alerts (fighter_id, review_decision, created_at DESC) WHERE review_decision = 'PENDING';
-- Q: "Alert HIGH/CRITICAL chưa review — Dashboard bác sĩ"
CREATE INDEX idx_ha_high_severity_pending      ON health_alerts (severity, review_decision, created_at DESC) WHERE review_decision = 'PENDING' AND severity IN ('HIGH', 'CRITICAL');
-- Q: "Trend alert theo khớp của Fighter X"
CREATE INDEX idx_ha_fighter_joint_time         ON health_alerts (fighter_id, joint, created_at DESC);
-- Q: "Tất cả alert trong một session"
CREATE INDEX idx_ha_session                    ON health_alerts (session_id, severity);

-- ── medical_clearances ──
CREATE INDEX idx_mc_fighter_status_validity    ON medical_clearances (fighter_id, status, valid_until);
CREATE INDEX idx_mc_active_clearances          ON medical_clearances (fighter_id, status) WHERE status = 'ACTIVE' AND is_active = TRUE;

-- ── injury_records ──
CREATE INDEX idx_ir_fighter_status             ON injury_records (fighter_id, status);
CREATE INDEX idx_ir_joint                      ON injury_records (affected_joint, status);

-- ── round_summaries ──
CREATE INDEX idx_rs_fighter_session            ON round_summaries (fighter_id, session_id);

-- ── session_summaries ──
CREATE INDEX idx_ss_fighter_time               ON session_summaries (fighter_id, created_at DESC);
CREATE INDEX idx_ss_impairment                 ON session_summaries (fighter_id, impairment_detected, created_at DESC) WHERE impairment_detected = TRUE;

-- ── notifications ──
CREATE INDEX idx_notifications_user_unread     ON notifications (user_id, is_read, created_at DESC) WHERE is_read = FALSE;

-- ── audit_logs ──
CREATE INDEX idx_audit_logs_table_record       ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_user_time          ON audit_logs (user_id, created_at DESC);


-- ─── 13. Comments on Schema Design Decisions ─────────────────────────────────
COMMENT ON SCHEMA public IS
'MMA-TMS Enterprise Schema v1.0
Merged from: Schema Architecture Audit + Biomechanical Pipeline Audit
Key design decisions:
  1. technique_events: replaces ai_analyses.strikes_detected JSONB — enabler for all dashboard queries.
  2. fighter_baselines: replaces BASELINE_ROM_BY_TECHNIQUE hardcode in Python worker.
  3. fighter_joint_states: live state table for real-time State Machine (HEALTHY/SUSPECTED/CONFIRMED).
  4. algorithm_configs: version control for all AI thresholds — required for medical audit trail.
  5. health_alerts: normalized from JSONB array — each CONFIRMED_IMPAIRMENT = 1 reviewable row.
  6. round_summaries + session_summaries: pre-aggregated layer — dashboard reads here, not raw events.
  7. Unified time unit: ms for in-video timestamps, seconds for training duration.
  8. body_joint enum: replaces free-text bodyPart — synced with JointName in joint_health_tracker.py.
';
