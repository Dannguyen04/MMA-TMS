/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { coachTodayApi } from "@/api/coach/coach-today";
import { campApi, type CampBout, type CampDetail } from "@/features/fight-camp/api";
import { listFighters } from "@/api/fighters/fighters";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { CoachTodayScreen } from "./coach-today-screen";

const mockPush = jest.fn();
let mockWidth = 412;
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => ({ width: mockWidth, height: 915, scale: 1, fontScale: 1 }) }));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "coach" } }) }));
jest.mock("@/theme", () => ({
  useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }),
  fonts: { display: "D", displayExtraBold: "DX", displaySemi: "DS" },
}));
jest.mock("@/components/navigation/nav-rail", () => ({ useNavKind: () => "bar", navSideWidth: () => 0 }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/screens/coach/nav/coach-unread", () => ({ CoachBell: () => null }));
jest.mock("@/components/ui/slide-sheet", () => {
  const React = require("react"); const { View, Text } = require("react-native");
  return { SlideSheet: ({ visible, title, children }: { visible: boolean; title: string; children: unknown }) => visible ? React.createElement(View, { testID: "sheet" }, React.createElement(Text, null, title), children) : null };
});
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/features/fight-camp/api", () => ({ campApi: { list: jest.fn(), detail: jest.fn() } }));
jest.mock("@/api/coach/coach-today", () => ({ ...jest.requireActual("@/api/coach/coach-today"), coachTodayApi: { todo: jest.fn(), readiness: jest.fn() } }));
jest.mock("@/api/fighters/fighters", () => ({ listFighters: jest.fn() }));

const camp = campApi as jest.Mocked<typeof campApi>;
const today = coachTodayApi as jest.Mocked<typeof coachTodayApi>;
const fighters = listFighters as jest.MockedFunction<typeof listFighters>;
const bout = (over: Partial<CampBout>): CampBout => ({ ...previewBout, fighterId: "f1", ...over });
const days = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function arrange() {
  camp.list.mockResolvedValue({ data: [
    bout({ id: "b1", eventName: "TEST API", status: "FIGHT_WEEK", weighInAt: days(2), boutAt: days(3), weightLimitKg: 77, officialWeightKg: null }),
    bout({ id: "b2", eventName: "Lotus 14", status: "CAMP", boutAt: days(40) }),
    bout({ id: "b3", eventName: "Xong rồi", status: "COMPLETED", boutAt: days(-9) }),
  ], hasNextPage: false, nextCursor: null });
  camp.detail.mockResolvedValue({ ...structuredClone(previewBout), id: "b1", weight: { ...previewBout.weight, latestKg: 77.6 } } as CampDetail);
  today.todo.mockResolvedValue({ items: [
    { source: "CAN_ENTER_FIGHT_WEEK", phase: "BEFORE", fighterId: "f2", boutId: "b2", eventName: "Lotus 14", dueOn: null, count: null },
    { source: "WEIGHT_OVER_LIMIT", phase: "DURING", fighterId: "f1", boutId: "b1", eventName: "TEST API", dueOn: null, count: null },
  ], truncated: false });
  today.readiness.mockResolvedValue([
    { fighterId: "f3", fighterName: "Minh Trần", ready: true, status: "READY", latestWeightKg: null, latestWeightOn: null, activeBout: null, suspension: null, fullReturnOn: null, gradedReturn: null },
  ]);
  fighters.mockResolvedValue({ data: [
    { id: "f1", firstName: "Dat", lastName: "Nguyen", currentMedicalStatus: "HEALTHY" },
    { id: "f2", firstName: "Anh", lastName: "Le", currentMedicalStatus: "NOT_CLEARED" },
  ] as never, total: 2, hasNextPage: false });
}

beforeEach(() => { jest.clearAllMocks(); mockWidth = 412; arrange(); });

describe("Coach Hôm nay", () => {
  it("leads with the nearest live bout and its stage action", async () => {
    const ui = await render(<CoachTodayScreen/>);
    const spot = await ui.findByTestId("today-spotlight");
    expect(within(spot).getByLabelText("Còn 2 ngày tới cân chính thức")).toBeTruthy();
    await within(spot).findByText("77,6 kg · vượt 0,6 kg");
    await fireEvent.press(within(spot).getByLabelText("Ghi cân chính thức"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(coach)/fight-camp/bout", params: { id: "b1", preview: "0", view: "weigh" } });
  });

  it("lists other live bouts as rows and never the finished ones", async () => {
    const ui = await render(<CoachTodayScreen/>);
    const others = await ui.findByTestId("today-other-bouts");
    expect(within(others).getByText("Lotus 14")).toBeTruthy();
    expect(ui.queryByText("Xong rồi")).toBeNull();
    expect(ui.getByText("Xem tất cả 2 trận")).toBeTruthy();
  });

  it("shows each section as a count with its most urgent item, and opens the full list in a sheet", async () => {
    const ui = await render(<CoachTodayScreen/>);
    const todo = await ui.findByTestId("today-todo");
    await within(todo).findByText("Cân vượt ngưỡng giảm cân · Dat Nguyen");
    expect(within(todo).getByText("2")).toBeTruthy();
    expect(within(await ui.findByTestId("today-attention")).getByText("Anh Le · chưa cho phép tập")).toBeTruthy();
    await fireEvent.press(todo);
    const sheet = ui.getByTestId("sheet");
    expect(within(sheet).getByText("Đủ điều kiện vào tuần thi đấu")).toBeTruthy();
    await fireEvent.press(within(sheet).getByLabelText("Cân vượt ngưỡng giảm cân, Dat Nguyen · TEST API"));
    expect(mockPush).toHaveBeenCalledWith({ pathname: "/(coach)/fight-camp/bout", params: { id: "b1", preview: "0" } });
  });

  it("fails one source on its own with a retry, and says a positive word for zero", async () => {
    today.readiness.mockRejectedValueOnce(new Error("down"));
    today.todo.mockResolvedValue({ items: [], truncated: false });
    const ui = await render(<CoachTodayScreen/>);
    const ready = await ui.findByTestId("today-ready");
    await within(ready).findByText("Không tải được");
    expect(within(await ui.findByTestId("today-todo")).getByText("Đã xong hết")).toBeTruthy();
    expect(await ui.findByTestId("today-spotlight")).toBeTruthy();
    await fireEvent.press(within(ready).getByText("Thử lại"));
    await within(await ui.findByTestId("today-ready")).findByText("Minh Trần");
  });

  it("shows an empty state that links to the bout list when nothing is live", async () => {
    camp.list.mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachTodayScreen/>);
    await ui.findByText("Chưa có trận nào đang chuẩn bị.");
    await fireEvent.press(ui.getByLabelText("Danh sách trận"));
    expect(mockPush).toHaveBeenCalledWith("/(coach)/fight-camp");
  });

  it("on iPad puts bouts left and opens the to-do list on the right instead of its summary row", async () => {
    mockWidth = 820;
    const ui = await render(<CoachTodayScreen/>);
    await ui.findByTestId("today-columns");
    expect(ui.queryByTestId("today-todo")).toBeNull();
    const full = ui.getByTestId("today-todo-full");
    await within(full).findByText("Cân vượt ngưỡng giảm cân");
    expect(within(full).getByText("Việc cần làm · 2")).toBeTruthy();
  });
});
