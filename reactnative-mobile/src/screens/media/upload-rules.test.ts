import { toAnalysisJob } from "@/api/media";

import { uploadIssue } from "./upload-rules";

const ready = {
  title: "Đấm bóng",
  trainingType: "SHADOW_BOXING" as const,
  cameraAngle: "FRONT" as const,
  durationMs: 12_000,
  fileSizeBytes: 1000,
  mimeType: "video/mp4",
  filename: "clip.mp4",
};

describe("upload draft", () => {
  it("accepts a complete clip and rejects a missing file", () => {
    expect(uploadIssue(ready)).toBeNull();
    expect(uploadIssue({ ...ready, filename: null })).toBe("file");
    expect(uploadIssue({ ...ready, mimeType: "image/jpeg" })).toBe("mime");
    expect(uploadIssue({ ...ready, durationMs: 0 })).toBe("durationRange");
  });
});

describe("analysis job mapping", () => {
  it("drops signed video URLs", () => {
    const job = toAnalysisJob({
      id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      status: "DONE",
      score: 80,
      fighterId: "3915bd44-1f5b-49d9-a9e6-7e6865b5d37a",
      sessionId: null,
      videoId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      alertCount: 1,
      hasImpairment: true,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      videoUrl: "https://example.supabase.co/object/sign/secret-token",
      resultUrl: "https://example.supabase.co/object/sign/result-token",
    });
    expect(job?.score).toBe(80);
    expect(job && "videoUrl" in job).toBe(false);
    expect(JSON.stringify(job)).not.toContain("secret-token");
  });
});
