import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — chỉ khởi tạo khi được gọi (tránh lỗi build-time khi env chưa có)
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
    if (_supabase) return _supabase;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new Error(
            "Chưa cấu hình Supabase. Thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY vào .env.local",
        );
    }
    _supabase = createClient(url, key);
    return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        return (getSupabase() as any)[prop];
    },
});

/**
 * Upload video file lên Supabase Storage bucket 'videos'
 * Trả về public URL của file đã upload
 */
export async function uploadVideo(
    file: File,
    onProgress?: (pct: number) => void,
): Promise<string> {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const path = `uploads/${fileName}`;

    // Supabase JS v2 không có built-in progress — upload trực tiếp
    const { error } = await supabase.storage.from("videos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
    });

    if (error) throw new Error(`Upload thất bại: ${error.message}`);
    onProgress?.(100);

    const { data } = supabase.storage.from("videos").getPublicUrl(path);
    return data.publicUrl;
}
