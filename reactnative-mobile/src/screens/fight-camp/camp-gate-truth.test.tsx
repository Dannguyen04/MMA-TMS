/// <reference types="jest" />
import { render } from "@testing-library/react-native";
import type { Suspension } from "@/api/fight-camp";
import { allowedTodayLine, allowedTypes, limitsTrainingToday } from "./camp-rules";
import { FighterSuspensionCard } from "./fighter-suspension";
import { SuspensionCard } from "./camp-suspension";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());

const DEFAULT_MANUAL = ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING", "STRENGTH_CONDITIONING"];
const s = (over: Partial<Suspension>): Suspension => ({ id: "s", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: DEFAULT_MANUAL, requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null, ...over });

describe("Phase 5 B: allowed line follows the server gate (suspension.gate.ts:38-57)", () => {
  it("in force: everything not in blockedSessionTypes (default manual list)", () => {
    expect(allowedTodayLine(s({}))).toBe("Hôm nay được tập: phục hồi, vật lý trị liệu");
    expect(allowedTodayLine(s({ status: "AWAITING_CLEARANCE", requiresClearance: true }))).toBe("Hôm nay được tập: phục hồi, vật lý trị liệu");
  });
  it("free list that skips a tier: SPARRING stays open when only GRAPPLING is blocked, whatever maxAllowedTier says", () => {
    const line = allowedTodayLine(s({ blockedSessionTypes: ["GRAPPLING"], maxAllowedTier: 3 }))!;
    expect(line).toContain("đối luyện");
    expect(line).not.toContain("vật / khoá siết");
    expect(allowedTypes(s({ blockedSessionTypes: ["HEAVY_BAG"], maxAllowedTier: 2 }))).toEqual(["RECOVERY", "PHYSICAL_THERAPY", "STRENGTH_CONDITIONING", "SHADOW_BOXING", "PAD_WORK", "GRAPPLING", "SPARRING"]);
  });
  it("ignores a stale maxAllowedTier", () => {
    expect(allowedTodayLine(s({ blockedSessionTypes: ["SPARRING"], maxAllowedTier: 1 }))).toBe("Hôm nay được tập: phục hồi, vật lý trị liệu, thể lực và sức mạnh, đánh gió, đánh bao, đánh đích, vật / khoá siết");
  });
  it("nothing blocked / everything blocked", () => {
    expect(allowedTodayLine(s({ blockedSessionTypes: [] }))).toBe("Hôm nay được tập tất cả các loại");
    expect(allowedTodayLine(s({ blockedSessionTypes: [...DEFAULT_MANUAL, "RECOVERY", "PHYSICAL_THERAPY"], maxAllowedTier: 0 }))).toBe("Hôm nay chưa được tập loại nào");
  });
  it("graded return day 1 (ceiling 3) and day 2 (ceiling 4) use the ceiling, not the record list", () => {
    const day1 = s({ reason: "KO", status: "ENDED", blockedSessionTypes: DEFAULT_MANUAL, maxAllowedTier: 1, gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-03" } });
    expect(allowedTodayLine(day1)).toBe("Hôm nay được tập: phục hồi, vật lý trị liệu, thể lực và sức mạnh, đánh gió, đánh bao, đánh đích");
    const day2 = { ...day1, gradedReturn: { ceiling: 4 as const, fullReturnOn: "2026-11-03" } };
    expect(allowedTypes(day2)).toContain("GRAPPLING");
    expect(allowedTypes(day2)).not.toContain("SPARRING");
  });
  it("day 3 (no gradedReturn, ENDED): no line, no limit today", () => {
    const ended = s({ status: "ENDED", gradedReturn: null });
    expect(allowedTodayLine(ended)).toBeNull();
    expect(limitsTrainingToday([ended])).toBe(false);
  });
  it("UPCOMING: from the start date, and does not limit today", () => {
    const up = s({ status: "UPCOMING", startsOn: "2026-11-10", endsOn: "2026-11-20" });
    expect(allowedTodayLine(up)).toBe("Từ 10/11 được tập: phục hồi, vật lý trị liệu");
    expect(limitsTrainingToday([up])).toBe(false);
    expect(limitsTrainingToday([up, s({})])).toBe(true);
    expect(limitsTrainingToday([s({ status: "ENDED", gradedReturn: { ceiling: 4, fullReturnOn: "2026-11-03" } })])).toBe(true);
  });
  it("coach card: one line, no 'bị chặn / không bị chặn' lists; graded return shows the ceiling", async () => {
    const ui = await render(<SuspensionCard s={s({ reason: "KO", status: "ENDED", maxAllowedTier: 1, gradedReturn: { ceiling: 4, fullReturnOn: "2026-11-03" } })}/>);
    expect(ui.getByText("Hôm nay được tập: phục hồi, vật lý trị liệu, thể lực và sức mạnh, đánh gió, đánh bao, đánh đích, vật / khoá siết")).toBeTruthy();
    expect(ui.queryByText(/bị chặn/)).toBeNull();
  });
  it("fighter ladder ticks from the gate list; a partly blocked tier names only what is open", async () => {
    const ui = await render(<FighterSuspensionCard items={[s({ blockedSessionTypes: ["HEAVY_BAG", "SPARRING"], maxAllowedTier: 2 })]} error={false} onRetry={() => undefined}/>);
    expect(ui.getByText(/Đánh gió, Đánh đích \(một phần\)/)).toBeTruthy();
    expect(ui.getByLabelText(/Bậc 4, .*Được tập$/)).toBeTruthy();
    expect(ui.getByLabelText(/Bậc 5, .*Chưa được tập$/)).toBeTruthy();
  });
});

describe("Phase 5 B (2a): coach card during graded return", () => {
  it("shows the graded-return headline, not 'Đã kết thúc / Đình chỉ này đã kết thúc.'", async () => {
    const ui = await render(<SuspensionCard s={s({ reason: "KO", status: "ENDED", endsOn: "2026-10-30", gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-02" } })}/>);
    expect(ui.getByText("Đang tập lại theo bậc, tập đầy đủ từ 02/11")).toBeTruthy();
    expect(ui.queryByText("Đã kết thúc")).toBeNull();
    expect(ui.queryByText("Đình chỉ này đã kết thúc.")).toBeNull();
    expect(ui.getByText(/^Hôm nay được tập: /)).toBeTruthy();
  });
  it("a plain ended suspension still reads as ended", async () => {
    const ui = await render(<SuspensionCard s={s({ status: "ENDED", endsOn: "2026-10-20" })}/>);
    expect(ui.getByText("Đã kết thúc")).toBeTruthy();
    expect(ui.getByText("Đình chỉ này đã kết thúc.")).toBeTruthy();
    expect(ui.queryByText(/Đang tập lại theo bậc/)).toBeNull();
  });
});
