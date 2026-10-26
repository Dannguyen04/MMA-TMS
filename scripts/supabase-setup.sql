-- ============================================================
-- MARTIAL ARTS TRACKER — SUPABASE DATABASE & STORAGE SETUP
-- Chạy toàn bộ file này trong: Supabase Dashboard > SQL Editor
-- Project: wskisxkpbhisnqfpjqrm
-- ============================================================

-- ── 1. Enum & Bảng dữ liệu Jobs ─────────────────────────────
DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON analysis_jobs;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ── 2. Tạo Storage Buckets (riêng tư) ───────────────────────
-- Video võ sĩ và kết quả phân tích là dữ liệu cá nhân: KHÔNG đặt public.
-- NestJS và Worker dùng service role (bỏ qua RLS); trình duyệt chỉ nhận
-- signed URL ngắn hạn qua route đã xác thực. Đường dẫn dạng
-- /storage/v1/object/public/... trong result_url chỉ là định danh để
-- NestJS tách storage key, không phải link đọc công khai.
-- Chạy lại script trên project cũ sẽ chuyển bucket về riêng tư.
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('analysis-results', 'analysis-results', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ── 3. Storage Policies (RLS) ───────────────────────────────
-- Gỡ các policy công khai của bản setup cũ (áp cho mọi role, kể cả anon:
-- đọc, upload, ghi đè). Không tạo policy mới: service role không cần.
DROP POLICY IF EXISTS "Public read videos" ON storage.objects;
DROP POLICY IF EXISTS "Public upload videos" ON storage.objects;
DROP POLICY IF EXISTS "Public read analysis-results" ON storage.objects;
DROP POLICY IF EXISTS "Public upload analysis-results" ON storage.objects;
DROP POLICY IF EXISTS "Public update analysis-results" ON storage.objects;
