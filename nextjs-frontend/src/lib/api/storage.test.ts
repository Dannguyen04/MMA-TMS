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
});
