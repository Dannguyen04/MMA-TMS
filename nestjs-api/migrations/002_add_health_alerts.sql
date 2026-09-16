-- Migration 002: Thêm cột health_alerts và joint_states vào analysis_jobs
-- Chạy trên PostgreSQL/Supabase SQL Editor

ALTER TABLE analysis_jobs
  ADD COLUMN IF NOT EXISTS health_alerts  JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS joint_states   JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS alert_count    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_impairment BOOLEAN NOT NULL DEFAULT FALSE;

-- GIN index để query nhanh bên trong JSONB (tìm theo joint, severity...)
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_health_alerts
  ON analysis_jobs USING GIN (health_alerts);

-- Partial index: nhanh chóng lọc job có cảnh báo chấn thương
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_has_impairment
  ON analysis_jobs (has_impairment)
  WHERE has_impairment = TRUE;

-- Comment mô tả schema
COMMENT ON COLUMN analysis_jobs.health_alerts IS
  'Mảng JSON AlertPayload[] từ JointHealthTracker — chỉ chứa CONFIRMED_IMPAIRMENT';
COMMENT ON COLUMN analysis_jobs.joint_states IS
  'Map { JointName → JointHealthState } snapshot cuối session';
COMMENT ON COLUMN analysis_jobs.alert_count IS
  'Số lượng CONFIRMED_IMPAIRMENT alert (cache để sort/filter nhanh)';
COMMENT ON COLUMN analysis_jobs.has_impairment IS
  'TRUE nếu có ít nhất 1 CONFIRMED_IMPAIRMENT — partial index cho dashboard';
