import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPipelineAccessToken = vi.hoisted(() => vi.fn());
const resolvePipelineFighterId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/pipeline-auth", () => ({ getPipelineAccessToken, resolvePipelineFighterId }));

import type { NextRequest } from "next/server";

import { POST as complete } from "../[videoId]/complete/route";
import { POST } from "./route";

const fighterId = "11111111-1111-4111-8111-111111111101";
const videoId = "22222222-2222-4222-8222-222222222222";
const signedUrl = "https://project.supabase.co/storage/v1/object/upload/sign/videos/key?token=t0k";
const body = { fighterId, title: "Bag work", trainingType: "heavy_bag", cameraAngle: "front", durationMs: 45_000, originalFilename: "bag.mp4", fileSizeBytes: 27 * 1024 * 1024, contentType: "video/mp4", sessionId: "demo-session-1" };

const jsonRequest = (value: unknown) => ({ json: async () => value }) as unknown as NextRequest;
const envelope = (data: unknown, status = 200) => Response.json({ success: true, message: "ok", data }, { status });
const created = (url = signedUrl) => envelope({ video: { id: videoId, status: "PENDING_UPLOAD" }, upload: { method: "PUT", url, token: "t0k", bucket: "videos", path: "key", contentType: "video/mp4", expiresInSeconds: 7200 } }, 201);

describe("direct video upload routes", () => {
    beforeEach(() => {
        getPipelineAccessToken.mockReset().mockResolvedValue("token");
        resolvePipelineFighterId.mockReset().mockImplementation(async (id: string) => id);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("asks the API for a signed URL with backend field names and returns it to the browser", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(created());
        const response = await POST(jsonRequest(body));

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({ videoId, upload: { method: "PUT", url: signedUrl, contentType: "video/mp4", expiresInSeconds: 7200 } });
        const [url, init] = fetchSpy.mock.calls[0] ?? [];
        expect(String(url)).toMatch(/\/videos\/upload-url$/);
        expect(init).toMatchObject({ method: "POST", headers: expect.objectContaining({ Authorization: "Bearer token" }) });
        const sent = JSON.parse(String((init as RequestInit).body));
        // Demo session ids are not UUIDs and are not linked.
        expect(sent).toEqual({ fighterId, title: "Bag work", trainingType: "HEAVY_BAG", cameraAngle: "FRONT", durationMs: 45_000, originalFilename: "bag.mp4", contentType: "video/mp4", fileSizeBytes: 27 * 1024 * 1024 });
    });

    it("rejects invalid metadata without calling the API", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const response = await POST(jsonRequest({ ...body, contentType: "video/x-msvideo" }));
        expect(response.status).toBe(400);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("passes the API's error code and status through", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: false, error: { statusCode: 413, code: "VIDEO_TOO_LARGE", message: "The video exceeds the configured upload limit" } }, { status: 413 }));
        const response = await POST(jsonRequest(body));
        expect(response.status).toBe(413);
        await expect(response.json()).resolves.toMatchObject({ code: "VIDEO_TOO_LARGE" });
    });

    it("refuses an upload target that is not a Supabase signed upload URL", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(created("https://evil.example/collect?token=t0k"));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const response = await POST(jsonRequest(body));
        expect(response.status).toBe(502);
    });

    it("confirms the upload and returns the same-origin playback URL", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(envelope({ id: videoId, status: "UPLOAD_COMPLETE" }));
        const response = await complete({} as NextRequest, { params: Promise.resolve({ videoId }) });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ videoId, sourceUrl: `/api/videos/${videoId}/content` });
        expect(String(fetchSpy.mock.calls[0]?.[0])).toMatch(new RegExp(`/videos/${videoId}/complete$`));
        expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    });

    it("does not forward a confirmation for a non-UUID id", async () => {
        const fetchSpy = vi.spyOn(globalThis, "fetch");
        const response = await complete({} as NextRequest, { params: Promise.resolve({ videoId: "../users" }) });
        expect(response.status).toBe(404);
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("keeps the API's 409 while the file has not reached storage", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ success: false, error: { statusCode: 409, code: "VIDEO_UPLOAD_MISSING", message: "The video file has not reached storage yet" } }, { status: 409 }));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        const response = await complete({} as NextRequest, { params: Promise.resolve({ videoId }) });
        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({ code: "VIDEO_UPLOAD_MISSING" });
    });
});
