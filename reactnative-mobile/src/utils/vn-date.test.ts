import { vnDaysUntil, vnLongDate, vnShortDate, vnTimeAndDate } from "./vn-date";

describe("vn-date (Asia/Ho_Chi_Minh)", () => {
  it("chuyển UTC sang giờ Việt Nam qua nửa đêm", () => {
    // 2026-10-24T18:00Z = 01:00 ngày 25/10 giờ VN
    expect(vnShortDate("2026-10-24T18:00:00Z")).toBe("25/10");
    expect(vnTimeAndDate("2026-10-24T18:00:00Z")).toBe("01:00, 25/10");
    expect(vnLongDate("2026-10-24T07:00:00Z")).toBe("Thứ Bảy, 24/10/2026");
  });

  it("đếm ngày lịch theo giờ VN", () => {
    const now = Date.parse("2026-10-18T10:00:00Z"); // 17:00 ngày 18 VN
    expect(vnDaysUntil("2026-10-19T00:00:00+07:00", now)).toBe(1);
    expect(vnDaysUntil("2026-10-18T23:00:00+07:00", now)).toBe(0);
    expect(vnDaysUntil("2026-10-17T08:00:00+07:00", now)).toBe(-1);
  });
});
