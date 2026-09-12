-- ============================================================
-- MARTIAL ARTS TRACKER — SUPABASE DATABASE & STORAGE SETUP
-- Chạy toàn bộ file này trong: Supabase Dashboard > SQL Editor
-- Project: wskisxkpbhisnqfpjqrm
-- ============================================================

-- ── 1. Enum & Bảng dữ liệu Jobs ─────────────────────────────
DO  BEGIN
    CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END ;

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_user_id ON analysis_jobs (user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status  ON analysis_jobs (status);

-- Trigger auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS 
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
 LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON analysis_jobs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── 2. Tạo Storage Buckets ──────────────────────────────────
-- Bucket 'videos': chứa video do user upload từ web
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Bucket 'analysis-results': chứa file JSON kết quả do Worker xuất
INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-results', 'analysis-results', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ── 3. Storage Policies (RLS) ───────────────────────────────
-- Xóa policy cũ nếu có để tránh trùng lặp
DROP POLICY IF EXISTS "Public read videos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read analysis-results" ON storage.objects;
DROP POLICY IF EXISTS "Public upload analysis-results" ON storage.objects;
DROP POLICY IF EXISTS "Public update analysis-results" ON storage.objects;

-- Cho phép đọc công khai (SELECT) từ bucket 'videos'
CREATE POLICY "Public read videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

-- Cho phép upload (INSERT) vào bucket 'videos'
CREATE POLICY "Public upload videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'videos');

-- Cho phép đọc công khai (SELECT) từ bucket 'analysis-results'
CREATE POLICY "Public read analysis-results"
ON storage.objects FOR SELECT
USING (bucket_id = 'analysis-results');

-- Cho phép Worker upload (INSERT) kết quả phân tích
CREATE POLICY "Public upload analysis-results"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'analysis-results');

-- Cho phép Worker ghi đè / upsert (UPDATE) kết quả phân tích
CREATE POLICY "Public update analysis-results"
ON storage.objects FOR UPDATE
USING (bucket_id = 'analysis-results');
