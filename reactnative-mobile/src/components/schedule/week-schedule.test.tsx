/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { WeekSchedule, type WeekScheduleProps } from "./week-schedule";
import type { ScheduleItem } from "./week-model";

let mockWidth = 412;
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => ({ width: mockWidth, height: 915, scale: 1, fontScale: 1 }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/components/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0 }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));

const it7 = (n: number, date = "2026-11-11"): ScheduleItem[] => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, kind: "session", date, time: `0${i}:00`, title: `Buổi ${i}`, who: "Dat", target: { kind: "session", id: `s${i}` } }));
const props = (over: Partial<WeekScheduleProps> = {}): WeekScheduleProps => ({
  title: "Lịch", monday: "2026-11-09", today: "2026-11-11", selected: "2026-11-11", onSelect: jest.fn(), onWeek: jest.fn(), onToday: jest.fn(),
  items: [], loading: false, error: null, partial: false, onRetry: jest.fn(), onOpen: jest.fn(), ...over,
});
beforeEach(() => { mockWidth = 412; });

describe("WeekSchedule", () => {
  it("shows the week, the selected day's items and opens one", async () => {
    const p = props({ items: [...it7(2), { key: "w", kind: "weigh", date: "2026-11-13", time: "08:00", title: "TEST API", who: "Dat", target: { kind: "bout", id: "b1" } }] });
    const ui = await render(<WeekSchedule {...p}/>);
    expect(ui.getByTestId("week-range").props.children).toBe("09–15/11");
    expect(ui.getByLabelText("Thứ Tư 11/11, 2 mục").props.accessibilityState.selected).toBe(true);
    expect(ui.getByText("2 mục")).toBeTruthy();
    await fireEvent.press(ui.getByText("Buổi 1"));
    expect(p.onOpen).toHaveBeenCalledWith(expect.objectContaining({ key: "k1" }));
    await fireEvent.press(ui.getByLabelText("Thứ Sáu 13/11, 1 mục"));
    expect(p.onSelect).toHaveBeenCalledWith("2026-11-13");
  });

  it("phone: shows 5 items then 'Xem thêm' opening the rest in a sheet; iPad shows up to 12", async () => {
    const ui = await render(<WeekSchedule {...props({ items: it7(7) })}/>);
    expect(ui.queryByText("Buổi 5")).toBeNull();
    await fireEvent.press(ui.getByText("Xem thêm 2 mục"));
    expect(ui.getByText("Buổi 6")).toBeTruthy();
    mockWidth = 820;
    const wide = await render(<WeekSchedule {...props({ items: it7(7) })}/>);
    expect(wide.getByText("Buổi 6")).toBeTruthy();
    expect(wide.queryByText(/Xem thêm/)).toBeNull();
  });

  it("changes week, offers 'Hôm nay' away from today, and says when a day is empty", async () => {
    const p = props({ selected: "2026-11-12" });
    const ui = await render(<WeekSchedule {...p}/>);
    expect(ui.getByText("Không có lịch trong ngày này.")).toBeTruthy();
    await fireEvent.press(ui.getByLabelText("Tuần sau"));
    expect(p.onWeek).toHaveBeenCalledWith(1);
    await fireEvent.press(ui.getByText("Hôm nay"));
    expect(p.onToday).toHaveBeenCalled();
  });

  it("fails as a whole with a retry, or partly with a note while still listing what loaded", async () => {
    const p = props({ error: "failed" });
    const ui = await render(<WeekSchedule {...p}/>);
    await fireEvent.press(within(ui.getByTestId("day-agenda")).getByText("Thử lại"));
    expect(p.onRetry).toHaveBeenCalled();
    const part = await render(<WeekSchedule {...props({ partial: true, items: it7(1) })}/>);
    expect(part.getByText("Một phần lịch chưa tải được")).toBeTruthy();
    expect(part.getByText("Buổi 0")).toBeTruthy();
  });
});
