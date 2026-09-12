-- 1. Tạo bucket "videos" (chứa video người dùng upload lên)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('videos', 'videos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Tạo bucket "analysis-results" (chứa video kết quả do Worker trả về)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('analysis-results', 'analysis-results', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Cho phép TẤT CẢ mọi người (anon) được phép upload vào thư mục "uploads/" của bucket "videos"
CREATE POLICY "Allow public uploads to videos bucket" 
ON storage.objects FOR INSERT 
TO public 
WITH CHECK (
    bucket_id = 'videos' 
    AND (storage.foldername(name))[1] = 'uploads'
);

-- 4. Cho phép TẤT CẢ mọi người (anon) được phép xem và tải file từ bucket "videos"
CREATE POLICY "Allow public read from videos bucket" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'videos');

-- 5. Cho phép TẤT CẢ mọi người (anon) được phép xem và tải file từ bucket "analysis-results"
CREATE POLICY "Allow public read from analysis-results bucket" 
ON storage.objects FOR SELECT 
TO public 
USING (bucket_id = 'analysis-results');

