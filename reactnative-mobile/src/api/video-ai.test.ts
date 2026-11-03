import { ApiError } from "./errors";
import { mockVideoAiApi } from "./video-ai.mock";
import { filterJobs, isJobNotComplete, isJobRunning, needsCoachReview, toAiHealthAlerts, toAiJob, toAiJobs, toAiVideoPage } from "./video-ai.types";

const mockFetch = jest.fn();
jest.mock("./client", () => ({ apiFetch: (...args: unknown[]) => mockFetch(...args) }));
const mockStream = jest.fn();
jest.mock("./media", () => ({ resolveVideoStream: (...args: unknown[]) => mockStream(...args) }));
const mockResult = jest.fn();
jest.mock("./evidence", () => ({ getJobResult: (...args: unknown[]) => mockResult(...args) }));

/* eslint-disable @typescript-eslint/no-require-imports */
const real = () => (require("./video-ai") as typeof import("./video-ai")).realVideoAiApi;

const scenario = (s?: string) => {
  const g = globalThis as { __VIDEO_AI_MOCK_SCENARIO__?: string };
  if (s) g.__VIDEO_AI_MOCK_SCENARIO__ = s;
  else delete g.__VIDEO_AI_MOCK_SCENARIO__;
};

describe("video-ai: chuẩn hoá", () => {
  it("job: bỏ URL lưu trữ có chữ ký, giữ số 0 thật, lấy tên bài tập", () => {
    const j = toAiJob({ id: "j", status: "DONE", score: 0, alertCount: 0, videoUrl: "https://s3/sig", resultUrl: "https://s3/r", evidenceContext: { exerciseName: "Đấm thẳng" } })!;
    expect(j).not.toHaveProperty("videoUrl");
    expect(j).not.toHaveProperty("resultUrl");
    expect(j.score).toBe(0);
    expect(j.alertCount).toBe(0);
    expect(j.exerciseName).toBe("Đấm thẳng");
    expect(toAiJob({ id: "x" })).toBeNull();
    expect(toAiJobs([{ id: "a", status: "DONE" }, null, "x"])).toHaveLength(1);
    expect(toAiJob({ id: "a", status: "DONE", alertCount: "3" })!.alertCount).toBeNull();
  });

  it("trang video theo con trỏ; bỏ sourceUrl", () => {
    const p = toAiVideoPage({ items: [{ id: "v", fighterId: "f", title: "T", sourceUrl: "/videos/v/content" }, { id: "bad" }], pageInfo: { hasNextPage: true, endCursor: "c2" }, total: 9 });
    expect(p.items).toHaveLength(1);
    expect(p.items[0]).not.toHaveProperty("sourceUrl");
    expect(p).toMatchObject({ hasNextPage: true, endCursor: "c2", total: 9 });
    expect(toAiVideoPage(null)).toEqual({ items: [], hasNextPage: false, endCursor: null, total: 0 });
  });

  it("cảnh báo sức khỏe: sắp theo thời điểm, bỏ dòng hỏng, jointStates chỉ chuỗi", () => {
    const h = toAiHealthAlerts(
      { status: "DONE", alertCount: 2, hasImpairment: true, healthAlerts: [{ joint: "B", triggerTimeMs: 9 }, { joint: "A", triggerTimeMs: 1 }, { triggerTimeMs: 3 }], jointStates: { A: "HEALTHY", B: 3 } },
      "j1",
    );
    expect(h.jobId).toBe("j1");
    expect(h.alerts.map((a) => a.joint)).toEqual(["A", "B"]);
    expect(h.jointStates).toEqual({ A: "HEALTHY" });
  });

  it("quy tắc: 409 JOB_NOT_COMPLETE, đang chạy, chờ HLV duyệt, lọc job phía máy", () => {
    expect(isJobNotComplete(new ApiError(409, "JOB_NOT_COMPLETE", ""))).toBe(true);
    expect(isJobNotComplete(new ApiError(409, "JOB_TERMINAL", ""))).toBe(false);
    expect(isJobRunning("PROCESSING")).toBe(true);
    expect(isJobRunning("DONE")).toBe(false);
    expect(needsCoachReview({ status: "DONE" }, { findingReviews: [], corrections: [] })).toBe(true);
    expect(needsCoachReview({ status: "DONE" }, { findingReviews: [{} as never], corrections: [] })).toBe(false);
    expect(needsCoachReview({ status: "PROCESSING" }, { findingReviews: [], corrections: [] })).toBe(false);
    expect(needsCoachReview({ status: "DONE" }, null)).toBe(false);
    const jobs = toAiJobs([
      { id: "1", status: "DONE", fighterId: "a", createdAt: "2026-10-01" },
      { id: "2", status: "FAILED", fighterId: "a", createdAt: "2026-10-03" },
      { id: "3", status: "DONE", fighterId: "b", createdAt: "2026-10-02" },
    ]);
    expect(filterJobs(jobs, { status: "DONE" }).map((j) => j.id)).toEqual(["3", "1"]);
    expect(filterJobs(jobs, { fighterId: "a" }).map((j) => j.id)).toEqual(["2", "1"]);
  });
});

describe("video-ai: lớp thật chỉ GET đúng đường dẫn swagger", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("mỗi hàm gọi đúng 1 GET", async () => {
    const api = real();
    const cases: [() => Promise<unknown>, string, unknown][] = [
      [() => api.listVideos({ fighterId: "f1", limit: 500 }), "/videos?fighterId=f1&limit=100", { items: [] }],
      [() => api.getVideo("v 1"), "/videos/v%201", { id: "v 1", fighterId: "f" }],
      [() => api.listJobs(), "/jobs", []],
      [() => api.listImpairmentJobs(), "/jobs/impairments", []],
      [() => api.getJob("j1"), "/jobs/j1", { id: "j1", status: "DONE" }],
      [() => api.getHealthAlerts("j1"), "/jobs/j1/health-alerts", {}],
      [() => api.getCoachingState("j1"), "/coaching/jobs/j1/state", {}],
      [() => api.getMovementReviews("j1"), "/movement-evidence/jobs/j1/reviews", {}],
      [() => api.listSessionExercises("s1"), "/movement-evidence/sessions/s1/exercises", []],
    ];
    for (const [call, path, body] of cases) {
      mockFetch.mockResolvedValueOnce(body);
      await call();
      const [p, init] = mockFetch.mock.calls.at(-1)!;
      expect(p).toBe(path);
      expect(init).toEqual({ method: "GET" });
    }
    expect(mockFetch).toHaveBeenCalledTimes(cases.length);
  });

  it("nội dung video và kết quả job dùng lại hàm đọc có sẵn", async () => {
    const api = real();
    mockStream.mockResolvedValueOnce({ uri: "https://signed" });
    await expect(api.getVideoStream("v1", "tok")).resolves.toEqual({ uri: "https://signed" });
    expect(mockStream).toHaveBeenCalledWith("/videos/v1/content", "tok");
    mockResult.mockResolvedValueOnce({ durationMs: 1 });
    await api.getJobResult("j1");
    expect(mockResult).toHaveBeenCalledWith("j1", undefined);
  });

  it("phản hồi sai hình → lỗi rõ ràng", async () => {
    mockFetch.mockResolvedValueOnce({});
    await expect(real().getJob("j1")).rejects.toThrow("JOB_SHAPE");
  });

  it("không có thao tác ghi trong lớp này", () => {
    const api = real();
    expect(Object.keys(api).every((k) => /^(list|get)/.test(k))).toBe(true);
    for (const f of ["video-ai.ts", "video-ai.mock.ts", "video-ai.types.ts"]) {
      const fs = jest.requireActual("fs") as { readFileSync: (p: string, e: string) => string };
      const src = fs.readFileSync(`src/api/${f}`, "utf8");
      expect(src).not.toMatch(/method:\s*"(POST|PATCH|PUT|DELETE)"/);
      expect(src).not.toMatch(/\b(createAnalysisJob|uploadVideo|deleteVideo|reviewFinding|submitCoachCorrection|appendMovementReview)\b/);
    }
  });
});

describe("video-ai: lớp giả lập", () => {
  afterEach(() => scenario());

  it("đủ 4 trạng thái job; impairments chỉ job có suy giảm", async () => {
    const jobs = await mockVideoAiApi.listJobs();
    expect(new Set(jobs.map((j) => j.status))).toEqual(new Set(["PENDING", "DONE", "PROCESSING", "FAILED"]));
    expect(jobs.filter((j) => j.status === "DONE")).toHaveLength(2);
    const imp = await mockVideoAiApi.listImpairmentJobs();
    expect(imp.every((j) => j.hasImpairment)).toBe(true);
  });

  it("kết quả: 409 khi chưa xong, có điểm khi xong", async () => {
    const err = await mockVideoAiApi.getJobResult("cj-3").catch((e: unknown) => e);
    expect(isJobNotComplete(err)).toBe(true);
    const r = await mockVideoAiApi.getJobResult("cj-1");
    expect(r.avgScore).toBe(71);
  });

  it("cảnh báo + trạng thái duyệt", async () => {
    const h = await mockVideoAiApi.getHealthAlerts("cj-1");
    expect(h.alerts).toHaveLength(2);
    expect((await mockVideoAiApi.getHealthAlerts("cj-2")).alerts).toHaveLength(0);
    const jobs = await mockVideoAiApi.listJobs();
    const waiting = [];
    for (const j of jobs) if (needsCoachReview(j, await mockVideoAiApi.getCoachingState(j.id))) waiting.push(j.id);
    expect(waiting).toEqual(["cj-2"]);
    expect((await mockVideoAiApi.getMovementReviews("cj-1")).reviews[0]!.decision).toBe("confirmed");
  });

  it("video: lọc, phân trang con trỏ", async () => {
    const all = await mockVideoAiApi.listVideos({ limit: 2 });
    expect(all.items).toHaveLength(2);
    expect(all.hasNextPage).toBe(true);
    const next = await mockVideoAiApi.listVideos({ limit: 2, cursor: all.endCursor! });
    expect(next.items.map((v) => v.id)).toEqual(["cv-3", "cv-4"]);
    expect((await mockVideoAiApi.listVideos({ fighterId: "cf-1" })).total).toBe(2);
  });

  it("kịch bản trống / mất mạng / 403 / không tìm thấy", async () => {
    scenario("empty");
    expect(await mockVideoAiApi.listJobs()).toEqual([]);
    scenario("offline");
    await expect(mockVideoAiApi.listVideos()).rejects.toMatchObject({ status: 0 });
    scenario("forbidden");
    await expect(mockVideoAiApi.getVideo("cv-1")).rejects.toMatchObject({ status: 403 });
    scenario();
    await expect(mockVideoAiApi.getJob("nope")).rejects.toMatchObject({ status: 404, code: "JOB_NOT_FOUND" });
  });
});
