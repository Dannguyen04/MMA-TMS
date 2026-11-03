/**
 * Đối chiếu fixture mock của lớp Video & AI với swagger (bản sao reactnative-mobile/docs/api-docs.json).
 * Swagger chỉ mô tả vỏ phản hồi { success, message, data } (data: {} không có schema) cho các GET này, nên
 * phần thân được đối chiếu với các DTO có trong swagger: UpdateJobStatusDto (status, score, healthAlerts[]),
 * MovementReviewDto (windowId, decision, notes, startMs, endMs) và các tham số GET.
 */
import { __fixtures } from "./video-ai.mock";
import { ALERT_SEVERITIES, JOB_STATUSES, MOVEMENT_DECISIONS } from "./video-ai.types";

/* eslint-disable @typescript-eslint/no-require-imports */
const fs = jest.requireActual("fs") as typeof import("fs");
/** Bản sao swagger nằm trong reactnative-mobile/docs để test chạy được ở mọi máy. */
const CANDIDATES = [`${__dirname}/../../docs/api-docs.json`];
const file = CANDIDATES.find((f) => fs.existsSync(f));
type Schema = { type?: string; enum?: string[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema; example?: unknown };
const doc = file ? (JSON.parse(fs.readFileSync(file, "utf8")) as { paths: Record<string, Record<string, { responses: Record<string, { content?: Record<string, { schema?: Schema }> }>; parameters?: { name: string; in: string }[] }>>; components: { schemas: Record<string, Schema> } }) : null;
const d = describe;
it("có bản sao swagger docs/api-docs.json", () => expect(doc).not.toBeNull());

function jsType(v: unknown): string {
  if (Array.isArray(v)) return "array";
  if (v === null) return "null";
  return typeof v === "number" ? "number" : typeof v;
}
function sameType(schemaType: string | undefined, v: unknown): boolean {
  if (!schemaType) return true;
  if (schemaType === "integer") return Number.isInteger(v);
  return jsType(v) === schemaType;
}

d("mock Video & AI khớp swagger", () => {
  const S = doc!.components.schemas;

  it("mọi GET dùng trong lớp có trong swagger, vỏ phản hồi có success/message/data", () => {
    for (const p of ["/videos", "/videos/{id}", "/videos/{id}/content", "/jobs", "/jobs/impairments", "/jobs/{id}", "/jobs/{id}/result", "/jobs/{id}/health-alerts", "/coaching/jobs/{jobId}/state", "/movement-evidence/jobs/{jobId}/reviews", "/movement-evidence/sessions/{sessionId}/exercises"]) {
      expect(doc!.paths[p]?.get).toBeTruthy();
    }
    for (const p of ["/jobs", "/jobs/impairments", "/jobs/{id}", "/jobs/{id}/health-alerts"]) {
      const sc = doc!.paths[p]!.get!.responses["200"]!.content!["application/json"]!.schema!;
      expect(sc.required).toEqual(expect.arrayContaining(["success", "message", "data"]));
    }
  });

  it("job: status thuộc enum; score là number 0..100 như UpdateJobStatusDto", () => {
    const dto = S.UpdateJobStatusDto!;
    expect(dto.properties!.score!.type).toBe("number");
    for (const j of __fixtures.RAW_JOBS) {
      expect(JOB_STATUSES).toContain(j.status);
      if (j.score != null) {
        expect(sameType("number", j.score)).toBe(true);
        expect(j.score).toBeGreaterThanOrEqual(0);
        expect(j.score).toBeLessThanOrEqual(100);
      }
    }
    // enum DONE/FAILED của DTO cập nhật phải nằm trong enum mobile dùng.
    for (const s of dto.properties!.status!.enum!) expect(JOB_STATUSES).toContain(s);
  });

  it("health alert: đúng tập trường + kiểu như ví dụ UpdateJobStatusDto.healthAlerts", () => {
    const example = (S.UpdateJobStatusDto!.properties!.healthAlerts!.example as Record<string, unknown>[])[0]!;
    const keys = Object.keys(example).sort();
    expect(ALERT_SEVERITIES).toContain(example.severity);
    for (const res of Object.values(__fixtures.ALERTS)) {
      expect(res.alertCount).toBe(res.healthAlerts.length);
      for (const a of res.healthAlerts) {
        expect(Object.keys(a).sort()).toEqual(keys);
        for (const k of keys) expect(jsType((a as Record<string, unknown>)[k])).toBe(jsType(example[k]));
        expect(ALERT_SEVERITIES).toContain(a.severity);
      }
    }
  });

  it("movement review: trường bắt buộc + kiểu + enum decision như MovementReviewDto", () => {
    const dto = S.MovementReviewDto!;
    expect([...dto.properties!.decision!.enum!].sort()).toEqual([...MOVEMENT_DECISIONS].sort());
    const fields = ["windowId", "decision", "notes", "startMs", "endMs"] as const;
    for (const r of __fixtures.MOVES.reviews) {
      for (const k of fields) {
        const v = (r as Record<string, unknown>)[k];
        if (v === undefined) expect(dto.required).not.toContain(k);
        else expect(sameType(dto.properties![k]!.type, v)).toBe(true);
      }
      for (const k of dto.required!.filter((k) => k !== "requestId" && k !== "expectedRevision")) expect((r as Record<string, unknown>)[k]).toBeDefined();
    }
  });

  it("finding review: trạng thái chỉ approved/rejected/corrected", () => {
    for (const st of Object.values(__fixtures.STATES)) for (const r of st.reviews) expect(["approved", "rejected", "corrected"]).toContain(r.status);
  });
});

describe("cờ mock Video & AI", () => {
  const load = (env: Record<string, string>) => {
    const saved = { ...process.env };
    Object.assign(process.env, { EXPO_PUBLIC_VIDEO_AI_MOCK: "", EXPO_PUBLIC_COACH_MOCK: "", EXPO_PUBLIC_DOCTOR_MOCK: "", EXPO_PUBLIC_ADMIN_MOCK: "" }, env);
    let flag = false;
    jest.isolateModules(() => {
      flag = (require("./video-ai") as typeof import("./video-ai")).USE_MOCK_VIDEO_AI;
    });
    process.env = saved;
    return flag;
  };
  it("chỉ bật khi EXPO_PUBLIC_VIDEO_AI_MOCK === 'true'; không kế thừa cờ Coach/Doctor/Admin", () => {
    expect(load({})).toBe(false);
    expect(load({ EXPO_PUBLIC_COACH_MOCK: "true", EXPO_PUBLIC_DOCTOR_MOCK: "true", EXPO_PUBLIC_ADMIN_MOCK: "true" })).toBe(false);
    expect(load({ EXPO_PUBLIC_VIDEO_AI_MOCK: "1" })).toBe(false);
    expect(load({ EXPO_PUBLIC_VIDEO_AI_MOCK: "true" })).toBe(true);
  });
});
