import { describe, expect, it } from "vitest";

import { foldText, matchItems } from "./quick-jump";

describe("quick jump search", () => {
    it("ignores case and Vietnamese marks", () => {
        expect(foldText("Đặng Võ Sĩ")).toBe("dang vo si");
    });

    it("needs every word, in any order, and puts labels that start with the query first", () => {
        const items = [{ label: "Lịch tập" }, { label: "Tập luyện" }, { label: "Trận đấu" }, { label: "Kế hoạch tập luyện" }];
        expect(matchItems(items, "tap").map((item) => item.label)).toEqual(["Tập luyện", "Lịch tập", "Kế hoạch tập luyện"]);
        expect(matchItems(items, "luyen ke").map((item) => item.label)).toEqual(["Kế hoạch tập luyện"]);
        expect(matchItems(items, "  ")).toHaveLength(4);
    });
});
