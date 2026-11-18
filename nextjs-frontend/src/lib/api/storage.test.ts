import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadVideoToStorage, videoContentType } from "./storage";

const videoId = "22222222-2222-4222-8222-222222222222";
const signedUrl = "https://project.supabase.co/storage/v1/object/upload/sign/videos/fighter/video/source.mp4?token=t0k";
const metadata = { fighterId: "11111111-1111-4111-8111-111111111101", title: "Bag work", trainingType: "heavy_bag" as const, cameraAngle: "front" as const, durationMs: 20_000 };

const started = () => Response.json({ videoId, upload: { method: "PUT", url: signedUrl, contentType: "video/mp4", expiresInSeconds: 7200 } }, { status: 201 });
const completed = () => Response.json({ videoId, sourceUrl: `/api/videos/${videoId}/content` });

/** Route handlers answer through fetch; storage answers the PUT. */
function mockFetch(storage: () => Response = () => Response.json({ Key: "videos/fighter/video/source.mp4" })) {
    const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
        if (url === "/api/videos/direct-upload") return started();
        if (url === `/api/videos/${videoId}/complete`) return completed();
        if (url === signedUrl) return storage();
        return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

function mockXhr() {
    const xhr = {
        open: vi.fn(), setRequestHeader: vi.fn(), send: vi.fn(),
        upload: { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null },
        onload: null as (() => void) | null,
        onabort: null as (() => void) | null,
        onerror: null as (() => void) | null,
        status: 200, responseText: JSON.stringify({ Key: "videos/fighter/video/source.mp4" }),
        abort: vi.fn(() => xhr.onabort?.()),
    };
    vi.stubGlobal("XMLHttpRequest", class { constructor() { return xhr; } });
    return xhr;
}

/** Let the queued fetch for step 1 settle so the PUT has started. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("uploadVideoToStorage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("asks for a signed URL, PUTs the file straight to storage, then confirms it", async () => {
        const fetchMock = mockFetch();
        const file = new File([new Uint8Array(4)], "bag-work.mp4", { type: "video/mp4" });

        await expect(uploadVideoToStorage(file, { ...metadata, description: undefined, sessionId: undefined })).resolves.toEqual({ videoId, sourceUrl: `/api/videos/${videoId}/content` });

        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/videos/direct-upload", signedUrl, `/api/videos/${videoId}/complete`]);
        const startBody = JSON.parse(String((fetchMock.mock.calls[0]?.[1] as RequestInit).body));
        expect(startBody).toEqual({ ...metadata, originalFilename: "bag-work.mp4", fileSizeBytes: 4, contentType: "video/mp4" });
        expect(startBody).not.toHaveProperty("description");
        const put = fetchMock.mock.calls[1]?.[1] as RequestInit;
        expect(put.method).toBe("PUT");
        expect(put.body).toBe(file);
        expect(put.headers).toMatchObject({ "Content-Type": "video/mp4", "x-upsert": "false" });
        expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe("POST");
    });

    it("never sends the file through our own routes (no Vercel body limit)", async () => {
        const fetchMock = mockFetch();
        await uploadVideoToStorage(new File([new Uint8Array(8)], "clip.mp4", { type: "video/mp4" }), metadata);
        for (const [url, init] of fetchMock.mock.calls) {
            if (String(url).startsWith("/api/")) expect((init as RequestInit).body ?? "").not.toBeInstanceOf(File);
        }
    });

    it("reports bytes sent but waits for the API confirmation before completing", async () => {
        const fetchMock = mockFetch();
        const xhr = mockXhr();
        const progress = vi.fn();
        let done = false;
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4", { type: "video/mp4" }), metadata, { onProgress: progress });
        void upload.then(() => { done = true; });
        await flush();
        expect(xhr.open).toHaveBeenCalledWith("PUT", signedUrl);
        expect(xhr.setRequestHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
        xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 5 });
        expect(progress).toHaveBeenCalledWith(100);
        expect(done).toBe(false);
        xhr.onload?.();
        await expect(upload).resolves.toMatchObject({ videoId });
        expect(fetchMock).toHaveBeenLastCalledWith(`/api/videos/${videoId}/complete`, expect.objectContaining({ method: "POST" }));
    });

    it("cancel stops the network transfer and skips the confirmation", async () => {
        const fetchMock = mockFetch();
        const xhr = mockXhr();
        const controller = new AbortController();
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4", { type: "video/mp4" }), metadata, { onProgress: vi.fn(), signal: controller.signal });
        const rejected = expect(upload).rejects.toMatchObject({ name: "AbortError" });
        await flush();
        controller.abort();
        await rejected;
        expect(xhr.abort).toHaveBeenCalledOnce();
        expect(fetchMock.mock.calls.map(([url]) => url)).not.toContain(`/api/videos/${videoId}/complete`);
    });

    it("keeps the storage rejection message", async () => {
        mockFetch();
        const xhr = mockXhr();
        xhr.status = 413;
        xhr.responseText = JSON.stringify({ statusCode: "413", error: "Payload too large", message: "The object exceeded the maximum allowed size" });
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4", { type: "video/mp4" }), metadata, { onProgress: vi.fn() });
        await flush();
        xhr.onload?.();
        await expect(upload).rejects.toThrow("The object exceeded the maximum allowed size");
    });

    it("surfaces the API's reason when the upload cannot start", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ code: "VIDEO_TOO_LARGE", message: "The video exceeds the configured upload limit" }, { status: 413 }));
        vi.stubGlobal("fetch", fetchMock);
        await expect(uploadVideoToStorage(new File(["video"], "clip.mp4", { type: "video/mp4" }), metadata)).rejects.toThrow("The video exceeds the configured upload limit");
        expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("surfaces the API's reason when the confirmation fails", async () => {
        const fetchMock = mockFetch();
        fetchMock.mockImplementation(async (url: string) => {
            if (url === "/api/videos/direct-upload") return started();
            if (url === signedUrl) return Response.json({});
            return Response.json({ code: "VIDEO_UPLOAD_MISSING", message: "The video file has not reached storage yet" }, { status: 409 });
        });
        await expect(uploadVideoToStorage(new File(["video"], "clip.mp4", { type: "video/mp4" }), metadata)).rejects.toThrow("The video file has not reached storage yet");
    });
});

describe("videoContentType", () => {
    it.each([
        [new File([""], "clip.mp4", { type: "video/mp4" }), "video/mp4"],
        [new File([""], "clip.MOV"), "video/quicktime"],
        [new File([""], "clip.webm"), "video/webm"],
        [new File([""], "clip.avi"), "application/octet-stream"],
    ])("%#: %s", (file, expected) => {
        expect(videoContentType(file)).toBe(expected);
    });
});
