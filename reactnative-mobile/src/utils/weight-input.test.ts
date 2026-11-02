import { formatKg, parseWeightInput } from "./weight-input";

describe("parseWeightInput", () => {
  it("chấp nhận dấu phẩy và dấu chấm", () => {
    expect(parseWeightInput("66,5")).toEqual({ ok: true, kg: 66.5 });
    expect(parseWeightInput("66.5")).toEqual({ ok: true, kg: 66.5 });
    expect(parseWeightInput(" 70 ")).toEqual({ ok: true, kg: 70 });
    expect(parseWeightInput("66,5 kg")).toEqual({ ok: true, kg: 66.5 });
  });

  it("làm tròn 1 chữ số thập phân", () => {
    expect(parseWeightInput("66,54")).toEqual({ ok: true, kg: 66.5 });
    expect(parseWeightInput("66,56")).toEqual({ ok: true, kg: 66.6 });
  });

  it("nhận biên 30 và 200, từ chối ngoài khoảng", () => {
    expect(parseWeightInput("30")).toEqual({ ok: true, kg: 30 });
    expect(parseWeightInput("200")).toEqual({ ok: true, kg: 200 });
    expect(parseWeightInput("29,9")).toEqual({ ok: false, reason: "range" });
    expect(parseWeightInput("20")).toEqual({ ok: false, reason: "range" });
    expect(parseWeightInput("250")).toEqual({ ok: false, reason: "range" });
    expect(parseWeightInput("200,1")).toEqual({ ok: false, reason: "range" });
  });

  it("từ chối rỗng và sai định dạng", () => {
    expect(parseWeightInput("")).toEqual({ ok: false, reason: "empty" });
    expect(parseWeightInput("   ")).toEqual({ ok: false, reason: "empty" });
    expect(parseWeightInput("abc")).toEqual({ ok: false, reason: "format" });
    expect(parseWeightInput("66,5,1")).toEqual({ ok: false, reason: "format" });
    expect(parseWeightInput("1.234,5")).toEqual({ ok: false, reason: "format" });
    expect(parseWeightInput("-60")).toEqual({ ok: false, reason: "format" });
    expect(parseWeightInput("66,")).toEqual({ ok: false, reason: "format" });
  });
});

describe("formatKg", () => {
  it("dùng dấu phẩy kiểu Việt Nam", () => {
    expect(formatKg(66.5)).toBe("66,5");
    expect(formatKg(70)).toBe("70");
    expect(formatKg(70, true)).toBe("70,0");
    expect(formatKg(65.84)).toBe("65,8");
  });
});
