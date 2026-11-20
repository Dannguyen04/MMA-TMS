/// <reference types="jest" />
import { fireEvent, render } from "@testing-library/react-native";
import { listAnalysisJobs, listVideos } from "@/api/media";
import { FighterUploadV2 } from "./upload-v2";
import { FighterVideosV2 } from "./video-list-v2";
import { detailLine, pickedLine, rowView } from "./video-v2-model";

const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn(), canGoBack: () => true }), useFocusEffect: () => undefined }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }), SafeAreaInsetsContext: require("react").createContext(null) }));
jest.mock("@/theme", () => ({ useThemePreference: () => ({ colors: jest.requireActual("@/theme/colors").palettes.light, resolvedScheme: "light" }) }));
jest.mock("@/components/icon", () => ({ Icon: () => null }));
jest.mock("@/shared/ui/camp-ui", () => require("@/features/fight-camp/testing/camp-test-ui").campUiMock());
jest.mock("@/shared/ui/camp-lit", () => ({ LitFill: () => null }));
jest.mock("@/screens/fighter/use-fighter-id", () => ({ useFighterId: () => ({ fighterId: "f1", canFetch: true }) }));
jest.mock("@/components/toast/app-toast", () => ({ useToastMessage: () => undefined }));
jest.mock("@/api/media", () => ({ ...jest.requireActual("@/api/media"), listVideos: jest.fn(), listAnalysisJobs: jest.fn(), uploadVideo: jest.fn() }));

const video = (over: object = {}) => ({ id: "v1", title: "Bao cát tối thứ hai", trainingType: "HEAVY_BAG", cameraAngle: "FRONT", status: "PROCESSED", createdAt: "2026-11-10T11:30:00.000Z", ...over }) as never;
const job = (over: object = {}) => ({ id: "j1", videoId: "v1", status: "DONE", score: 82, alertCount: 2, createdAt: "2026-11-10T11:42:00.000Z", updatedAt: "2026-11-10T11:50:00.000Z", ...over }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(listVideos).mockResolvedValue({ items: [video()], pageInfo: { hasNextPage: false, endCursor: null }, total: 1 } as never);
  jest.mocked(listAnalysisJobs).mockResolvedValue([job()]);
});

describe("Video model", () => {
  it("leads with the score when done, a mark otherwise, and says the status in words", () => {
    expect(rowView(video(), job())).toMatchObject({ lead: "82", leadTone: "ok", line: "Xong · Bao cát · 10/11", lineTone: "ok" });
    expect(rowView(video(), job({ status: "FAILED", score: null }))).toMatchObject({ lead: "!", leadTone: "warn", line: "Thất bại · Bao cát · 10/11" });
    expect(rowView(video(), job({ status: "PROCESSING" }))).toMatchObject({ kind: "wait", lead: undefined, line: "Đang phân tích · Bao cát · 10/11" });
    expect(rowView(video(), null)).toMatchObject({ lead: "–", leadTone: "dim", line: "Chưa phân tích · Bao cát · 10/11" });
  });

  it("writes the title line and the picked file line", () => {
    expect(detailLine(video())).toBe("Bao cát · Góc trước · 10/11 18:30");
    expect(pickedLine({ uri: "x", filename: "a.mp4", mimeType: "video/mp4", durationMs: 102000, fileSizeBytes: 38 * 1024 * 1024 })).toBe("1:42 · 38.0 MB");
  });
});

describe("Video list", () => {
  it("shows the upload button and one row per video that opens it", async () => {
    const ui = await render(<FighterVideosV2/>);
    expect(await ui.findByLabelText("Bao cát tối thứ hai. Xong · Bao cát · 10/11. Điểm 82")).toBeTruthy();
    await fireEvent.press(ui.getByTestId("video-row-v1"));
    expect(mockPush).toHaveBeenCalledWith("/video/v1");
    await fireEvent.press(ui.getByText("Tải video lên"));
    expect(mockPush).toHaveBeenCalledWith("/video/tai-len");
  });

  it("says when there is no video", async () => {
    jest.mocked(listVideos).mockResolvedValueOnce({ items: [], pageInfo: { hasNextPage: false, endCursor: null }, total: 0 } as never);
    const empty = await render(<FighterVideosV2/>);
    expect(await empty.findByText("Chưa có video nào")).toBeTruthy();
  });

  it("offers Thử lại when the list fails", async () => {
    jest.mocked(listVideos).mockRejectedValueOnce(new Error("down"));
    const failed = await render(<FighterVideosV2/>);
    expect(await failed.findByText("Không tải được video")).toBeTruthy();
    expect(failed.getByText("Thử lại")).toBeTruthy();
  });
});

describe("Tải video", () => {
  it("keeps Gửi video off until a file, a title, a type and an angle are chosen", async () => {
    const ui = await render(<FighterUploadV2/>);
    expect(ui.getByText("Chọn video")).toBeTruthy();
    expect(ui.getByLabelText("Gửi video").props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(ui.getByLabelText("Tiêu đề"), "Bao cát tối thứ hai");
    await fireEvent.press(ui.getByTestId("choice-HEAVY_BAG"));
    await fireEvent.press(ui.getByTestId("choice-FRONT"));
    expect(ui.getByTestId("choice-HEAVY_BAG").props.accessibilityState.checked).toBe(true);
    expect(ui.getByLabelText("Gửi video").props.accessibilityState.disabled).toBe(true);
  });
});
