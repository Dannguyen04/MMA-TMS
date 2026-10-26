import { mockBoutsApi } from "@/api/bouts.mock";
import { fighterBout as t } from "@/i18n/fighter-bout";

describe("dòng vượt cân", () => {
  it("không có tên hạng: một dòng so với giới hạn", () => {
    const single = { title: "Vượt 2,7 kg so với giới hạn 65,8 kg", detail: null };
    expect(t.weight.overLines("2,7", "65,8")).toEqual(single);
    expect(t.weight.overLines("2,7", "65,8", undefined)).toEqual(single);
    expect(t.weight.overLines("2,7", "65,8", "  ")).toEqual(single);
    expect(t.weight.overLines("2,7", "65,8").title).not.toContain("hạng cân");
  });

  it("có tên hạng: dòng 1 vượt so với hạng [tên], dòng 2 giới hạn", () => {
    expect(t.weight.overLines("2,7", "65,8", "lông")).toEqual({
      title: "Vượt 2,7 kg so với hạng lông",
      detail: "Giới hạn 65,8 kg",
    });
  });
});

describe("hướng dẫn giảm cân an toàn", () => {
  it("đủ 3 ý + dòng cuối, không có số kg hay mẹo cắt nước", () => {
    expect(t.weight.guide).toBe("Cách giảm cân an toàn");
    expect(t.guide.items).toEqual([
      "Uống đủ nước và không nhịn ăn đột ngột",
      "Giảm dần theo từng ngày, tránh cắt nước sát giờ cân",
      "Trao đổi với huấn luyện viên hoặc bác sĩ trước khi giảm thêm",
    ]);
    expect(t.guide.closing).toBe("Nếu thấy chóng mặt hoặc mệt, hãy dừng và báo ngay cho bác sĩ");
    expect([...t.guide.items, t.guide.closing].join(" ")).not.toMatch(/\d/);
  });
});

describe("mock: tên hạng cân tùy chọn", () => {
  afterEach(() => {
    delete (globalThis as { __BOUTS_MOCK_SCENARIO__?: string }).__BOUTS_MOCK_SCENARIO__;
  });

  it("mặc định không có tên hạng; kịch bản classname gán tên cho trận chính", async () => {
    expect((await mockBoutsApi.listBouts()).every((bout) => bout.weightClassName === undefined)).toBe(true);
    (globalThis as { __BOUTS_MOCK_SCENARIO__?: string }).__BOUTS_MOCK_SCENARIO__ = "classname";
    const bouts = await mockBoutsApi.listBouts();
    expect(bouts.find((bout) => bout.id === "bout-mock-main")?.weightClassName).toBe("lông");
    expect((await mockBoutsApi.getBout("bout-mock-main")).weightClassName).toBe("lông");
  });
});
