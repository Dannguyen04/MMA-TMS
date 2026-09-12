-- Migration: Tạo bảng analysis_jobs
-- Chạy lệnh này trên PostgreSQL/Supabase SQL Editor

CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT        NOT NULL    DEFAULT 'anonymous',
  video_url   TEXT        NOT NULL,
  status      job_status  NOT NULL    DEFAULT 'PENDING',
  result_url  TEXT,
  score       INTEGER,
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL    DEFAULT NOW()
);

-- Index để query theo userId
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status  ON analysis_jobs (status);

-- Trigger tự update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

