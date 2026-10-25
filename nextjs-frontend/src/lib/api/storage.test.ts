import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadVideoToStorage } from "./storage";

const videoId = "22222222-2222-4222-8222-222222222222";

describe("uploadVideoToStorage", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("omits absent optional metadata instead of sending the string 'undefined'", async () => {
        const fetchMock = vi.fn().mockResolvedValue(Response.json({ videoId, sourceUrl: `/api/videos/${videoId}/content` }, { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);
        const file = new File([new Uint8Array(4)], "bag-work.mp4", { type: "video/mp4" });

        await expect(
            uploadVideoToStorage(file, {
                fighterId: "11111111-1111-4111-8111-111111111101",
                title: "Bag work",
                description: undefined,
                trainingType: "heavy_bag",
                cameraAngle: "front",
                sessionId: undefined,
                durationMs: 45_000,
            }),
        ).resolves.toEqual({ videoId, sourceUrl: `/api/videos/${videoId}/content` });

        const query = new URL(String(fetchMock.mock.calls[0]?.[0]), "http://localhost").searchParams;
        expect(query.has("description")).toBe(false);
        expect(query.has("sessionId")).toBe(false);
        expect(query.get("durationMs")).toBe("45000");
        expect(query.get("originalFilename")).toBe("bag-work.mp4");
        expect(query.get("fileSizeBytes")).toBe("4");
    });

    const metadata = { fighterId: "11111111-1111-4111-8111-111111111101", title: "Bag work", trainingType: "heavy_bag" as const, cameraAngle: "front" as const, durationMs: 20_000 };
    function mockXhr() {
        const xhr = {
            open: vi.fn(), setRequestHeader: vi.fn(), send: vi.fn(),
            upload: { onprogress: null as ((event: { lengthComputable: boolean; loaded: number; total: number }) => void) | null },
            onload: null as (() => void) | null,
            onabort: null as (() => void) | null,
            onerror: null as (() => void) | null,
            status: 201, responseText: JSON.stringify({ videoId, sourceUrl: `/api/videos/${videoId}/content` }),
            abort: vi.fn(() => xhr.onabort?.()),
        };
        vi.stubGlobal("XMLHttpRequest", class { constructor() { return xhr; } });
        return xhr;
    }

    it("reports bytes sent but waits for storage confirmation before completing", async () => {
        const xhr = mockXhr();
        const progress = vi.fn();
        let completed = false;
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4"), metadata, { onProgress: progress });
        void upload.then(() => { completed = true; });
        xhr.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 5 });
        await Promise.resolve();
        expect(progress).toHaveBeenCalledWith(100);
        expect(completed).toBe(false);
        xhr.onload?.();
        await expect(upload).resolves.toMatchObject({ videoId });
    });

    it("cancel stops the network transfer rather than just hiding its progress", async () => {
        const xhr = mockXhr();
        const controller = new AbortController();
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4"), metadata, { onProgress: vi.fn(), signal: controller.signal });
        const rejected = expect(upload).rejects.toMatchObject({ name: "AbortError" });
        controller.abort();
        await rejected;
        expect(xhr.abort).toHaveBeenCalledOnce();
    });

    it("keeps storage rejection details after the upload reaches 100 percent", async () => {
        const xhr = mockXhr();
        xhr.status = 413;
        xhr.responseText = JSON.stringify({ message: "File is too large" });
        const upload = uploadVideoToStorage(new File(["video"], "clip.mp4"), metadata, { onProgress: vi.fn() });
        xhr.onload?.();
        await expect(upload).rejects.toThrow("File is too large");
    });
});
