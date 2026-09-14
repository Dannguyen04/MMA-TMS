import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Supabase Storage adapter for training footage (browser uploads, public URLs for the worker). */

const VIDEO_BUCKET = "videos";

export class StorageUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "StorageUploadError";
    }
}

let client: SupabaseClient | null = null;

/** Created on first use so builds and mock mode never need Supabase credentials. */
function storageClient(): SupabaseClient {
    if (client) return client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
        throw new StorageUploadError("Video storage isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
    }
    client = createClient(url, key);
    return client;
}

export interface StoredVideo {
    path: string;
    publicUrl: string;
}

/** Uploads a video file and returns its storage path and public URL. */
export async function uploadVideoToStorage(file: File): Promise<StoredVideo> {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `uploads/${Date.now()}_${safeName}`;
    const bucket = storageClient().storage.from(VIDEO_BUCKET);
    const { error } = await bucket.upload(path, file, { cacheControl: "3600", upsert: false, contentType: file.type || undefined });
    if (error) throw new StorageUploadError(`The upload failed: ${error.message}`);
    return { path, publicUrl: bucket.getPublicUrl(path).data.publicUrl };
}
