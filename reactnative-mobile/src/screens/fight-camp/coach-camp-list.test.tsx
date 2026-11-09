/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { campApi } from "@/api/fight-camp";
import { previewBout } from "./camp-preview";
import { CoachCampList } from "./coach-camp-screen";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ back: jest.fn(), push: jest.fn() }),
  useNavigation: () => ({ addListener: () => () => undefined, getParent: () => undefined }),
}));
jest.mock("@/session/session-context", () => ({ useSession: () => ({ isDemo: false, user: { id: "coach" } }) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light }) }));
jest.mock("@/api/fighters", () => ({ getFighter: jest.fn() }));
jest.mock("@/api/fight-camp", () => ({ campApi: { list: jest.fn() } }));
jest.mock("./camp-ui", () => require("./camp-test-ui").campUiMock());
jest.mock("./round-screens", () => ({ CornerScreen: () => null, RoundScreen: () => null, AdviceScreen: () => null, ReportScreen: () => null }));
jest.mock("./opponent-editor", () => ({ OpponentEditor: () => null }));

const api = campApi as jest.Mocked<typeof campApi>;
const bout = (id: string, eventName: string) => ({ ...previewBout, id, eventName });
beforeEach(() => { jest.clearAllMocks(); });

describe("Coach Fight Camp list", () => {
  it("asks for the newest bouts first, one page at a time, without the sample-UI button", async () => {
    api.list.mockResolvedValueOnce({ data: [bout("b2", "Trận mới")], hasNextPage: true, nextCursor: "c1" });
    const ui = await render(<CoachCampList/>);
    await ui.findByText("Trận mới");
    expect(api.list).toHaveBeenCalledWith({ limit: 20, cursor: undefined, order: "desc" });
    expect(ui.queryByText("Xem bản mẫu giao diện")).toBeNull();
  });
  it("loads the next page with the cursor and appends it below", async () => {
    api.list
      .mockResolvedValueOnce({ data: [bout("b2", "Trận mới")], hasNextPage: true, nextCursor: "c1" })
      .mockResolvedValueOnce({ data: [bout("b1", "Trận cũ")], hasNextPage: false, nextCursor: null });
    const ui = await render(<CoachCampList/>);
    await ui.findByText("Trận mới");
    await fireEvent.press(ui.getByLabelText("Tải thêm trận"));
    await ui.findByText("Trận cũ");
    expect(api.list).toHaveBeenLastCalledWith({ limit: 20, cursor: "c1", order: "desc" });
    expect(ui.getByText("Trận mới")).toBeTruthy();
  });
});
