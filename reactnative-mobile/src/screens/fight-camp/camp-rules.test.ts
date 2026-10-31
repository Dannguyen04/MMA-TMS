import { describe, expect, it } from "@jest/globals";
import { ApiError } from "@/api/errors";
import { campError, readKg, validateAnalysis } from "./camp-rules";
import { cornerHtml } from "./print-corner-html";
import { previewBout, previewCorner } from "./camp-preview";
describe("Fight Camp input and server errors", () => {
  it("accepts comma or dot and rejects rounding, exponents, negatives and out-of-range weights", () => {
    expect(readKg("59,8")).toBe(59.8); expect(readKg("60.5")).toBe(60.5);
    expect(readKg("30")).toBe(30); expect(readKg("200,0")).toBe(200);
    for (const invalid of ["", "60,55", "1e2", "-60", "29,9", "200,1", "NaN"]) expect(() => readKg(invalid)).toThrow();
  });
  it("explains an early weigh-in using earliestOn supplied by the backend", () => {
    const text = campError(new ApiError(409, "BOUT_WEIGH_IN_TOO_EARLY", "early", { earliestOn: "2026-10-29" }));
    expect(text).toContain("29/10/2026"); expect(text).toContain("giữ lại");
  });
  it("requires evidence and an observation basis before saving a tactic", () => {
    const a = { profile: {}, observations: [{ id: "o1", kind: "OPENING" as const, text: "Hạ tay", confidence: "ONCE" as const, evidenceNote: "Video hiệp 1" }], tactics: [{ id: "t1", text: "Đổi góc", round: null, observationIds: ["o1"], sessionIds: [] }] };
    expect(() => validateAnalysis(a, 3)).not.toThrow();
    expect(() => validateAnalysis({ ...a, observations: [{ ...a.observations[0], evidenceNote: "" }] }, 3)).toThrow("bằng chứng");
    expect(() => validateAnalysis({ ...a, tactics: [{ ...a.tactics[0], observationIds: [] }] }, 3)).toThrow("căn cứ");
    expect(() => validateAnalysis({ ...a, tactics: [{ ...a.tactics[0], round: 4 }] }, 3)).toThrow("Hiệp");
  });
  it("escapes data in the printable A4 and retains backend tactic order", () => {
    const html = cornerHtml({ ...previewBout, eventName: "<script>alert(1)</script>" }, "A & B", previewCorner, true);
    expect(html).toContain("size:A4"); expect(html).toContain("A &amp; B");
    expect(html).not.toContain("<script>"); expect(html).toContain("DỮ LIỆU MẪU");
    expect(html.indexOf(previewCorner.tactics[0].text)).toBeLessThan(html.indexOf(previewCorner.tactics[1].text));
  });
});
