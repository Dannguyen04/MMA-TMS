/// <reference types="jest" />
import { fireEvent, render, within } from "@testing-library/react-native";
import { campApi, type CampBout } from "@/api/fight-camp";
import { previewBout } from "./camp-preview";
import { CoachCampList } from "./coach-camp-screen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: jest.fn(), push: mockPush }),
  useNavigation: () => ({ addListener: () => () => undefined, getParent: () => undefined }),
}));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "coach" } }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/api/fighters", () => ({ getFighter: jest.fn() }));
jest.mock("@/api/fight-camp", () => ({ campApi: { list: jest.fn() } }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());
jest.mock("./round-screens", () => ({ CornerScreen: () => null, RoundScreen: () => null, ReportScreen: () => null }));
jest.mock("./opponent-editor", () => ({ OpponentEditor: () => null }));

const api = campApi as jest.Mocked<typeof campApi>;
const bout = (id: string, eventName: string, status: CampBout["status"], boutAt: string): CampBout => ({ ...previewBout, id, eventName, status, boutAt });
beforeEach(() => { jest.clearAllMocks(); });

describe("Coach Fight Camp list", () => {
  it("asks for the newest bouts first, one page at a time, without the sample-UI button", async () => {
    api.list.mockResolvedValueOnce({ data: [bout("b2", "Trận mới", "CAMP", "2026-12-26T19:00:00+07:00")], hasNextPage: true, nextCursor: "c1" });
    const ui = await render(<CoachCampList/>);
    await ui.findByText("Trận mới");
    expect(api.list).toHaveBeenCalledWith({ limit: 20, cursor: undefined, order: "desc" });
    expect(ui.queryByText("Xem bản mẫu giao diện")).toBeNull();
  });

  it("loads the next page with the cursor and appends it", async () => {
    api.list
      .mockResolvedValueOnce({ data: [bout("b2", "Trận mới", "CAMP", "2026-12-26T19:00:00+07:00")], hasNextPage: true, nextCursor: "c1" })
      .mockResolvedValueOnce({ data: [bout("b1", "Trận cũ", "FIGHT_WEEK", "2026-12-01T19:00:00+07:00")], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampList/>);
    await ui.findByText("Trận mới");
    await fireEvent.press(ui.getByLabelText("Tải thêm trận"));
    await ui.findByText("Trận cũ");
    expect(api.list).toHaveBeenLastCalledWith({ limit: 20, cursor: "c1", order: "desc" });
    expect(ui.getByText("Trận mới")).toBeTruthy();
  });

  it("puts live bouts first (nearest fight first) and folds finished ones away", async () => {
    api.list.mockResolvedValueOnce({ data: [
      bout("done1", "Đã đấu xong", "COMPLETED", "2026-11-10T19:00:00+07:00"),
      bout("far", "Trận xa", "CAMP", "2026-12-26T19:00:00+07:00"),
      bout("cancel", "Trận huỷ", "CANCELLED", "2026-11-09T19:00:00+07:00"),
      bout("near", "Trận gần", "WEIGHED_IN", "2026-11-11T19:00:00+07:00"),
    ], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampList/>);
    const live = await ui.findByTestId("camp-live");
    const titles = within(live).getAllByText(/^Trận (gần|xa)$/).map(n => n.props.children);
    expect(titles).toEqual(["Trận gần", "Trận xa"]);
    expect(ui.queryByText("Đã đấu xong")).toBeNull();
    await fireEvent.press(ui.getByLabelText("Đã xong · 2 trận"));
    expect(ui.getByText("Đã đấu xong")).toBeTruthy();
    expect(ui.getByText("Trận huỷ")).toBeTruthy();
  });

  it("opens a bout by tapping its card, with no per-card button", async () => {
    api.list.mockResolvedValueOnce({ data: [bout("near", "Trận gần", "WEIGHED_IN", "2026-11-11T19:00:00+07:00")], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampList/>);
    await ui.findByText("Trận gần");
    expect(ui.queryByLabelText("Mở chi tiết trận")).toBeNull();
    await fireEvent.press(ui.getByRole("button", { name: /Trận gần/ }));
    expect(mockPush).toHaveBeenCalledWith(expect.objectContaining({ params: { id: "near", preview: "0" } }));
  });
});
