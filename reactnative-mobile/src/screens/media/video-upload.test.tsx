import { act, fireEvent, render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { uploadVideo } from "@/api/media";
import { palettes } from "@/theme/colors";
import { ThemePreferenceProvider } from "@/theme";

import { VideoUploadContent } from "./video-upload";

jest.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/api/media", () => {
  const actual = jest.requireActual("@/api/media");
  return { ...actual, uploadVideo: jest.fn() };
});

jest.mock("@/screens/fighter/redesign/palette", () => {
  const actual = jest.requireActual("@/screens/fighter/redesign/palette");
  const colors = jest.requireActual("@/theme/colors");
  return {
    ...actual,
    useFighterPalette: () =>
      actual.paletteFromTokens(
        (globalThis as { __videoPalette?: typeof colors.palettes.light }).__videoPalette ?? colors.palettes.light,
      ),
  };
});

const picker = jest.requireMock("expo-image-picker") as {
  requestMediaLibraryPermissionsAsync: jest.Mock;
  launchImageLibraryAsync: jest.Mock;
};

const insets = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

async function renderUpload(onUploaded = jest.fn()) {
  return render(
    <SafeAreaProvider initialMetrics={insets}>
      <ThemePreferenceProvider>
        <VideoUploadContent fighterId="fighter-1" onBack={jest.fn()} onUploaded={onUploaded} />
      </ThemePreferenceProvider>
    </SafeAreaProvider>,
  );
}

type View = Awaited<ReturnType<typeof renderUpload>>;

async function chooseVideo(view: View) {
  await act(async () => {
    fireEvent.press(view.getByLabelText("Chọn video có sẵn"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("VideoUploadContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as { __videoPalette?: typeof palettes.light }).__videoPalette = palettes.light;
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: "file://clip.mp4",
          fileName: "clip.mp4",
          mimeType: "video/mp4",
          duration: 12_000,
          fileSize: 2048,
        },
      ],
    });
    global.fetch = jest.fn(async () => ({
      blob: async () => ({ size: 2048 }),
    })) as unknown as typeof fetch;
  });

  it("starts with no file and keeps submit disabled until the draft is valid", async () => {
    const view = await renderUpload();
    expect(view.getByText("Chưa chọn video")).toBeTruthy();
    expect(view.getByRole("button", { name: "Gửi video" }).props.accessibilityState.disabled).toBe(true);
    fireEvent.changeText(view.getByLabelText("Tiêu đề"), "Chỉ tiêu đề");
    expect(view.getByRole("button", { name: "Gửi video" }).props.accessibilityState.disabled).toBe(true);
    expect(uploadVideo).not.toHaveBeenCalled();
  });

  it("keeps the draft across cancel, file selection, theme change, failed submit, and one success", async () => {
    const onUploaded = jest.fn();
    const view = await renderUpload(onUploaded);
    fireEvent.changeText(view.getByLabelText("Tiêu đề"), "Giữ tiêu đề");
    fireEvent.changeText(view.getByLabelText("Mô tả"), "Giữ mô tả");
    fireEvent.press(view.getByLabelText("Bao cát"));
    fireEvent.press(view.getByLabelText("Bên"));

    picker.launchImageLibraryAsync.mockResolvedValueOnce({ canceled: true, assets: [] });
    await chooseVideo(view);
    expect(view.getByDisplayValue("Giữ tiêu đề")).toBeTruthy();
    expect(view.getByDisplayValue("Giữ mô tả")).toBeTruthy();
    expect(view.queryByText("clip.mp4")).toBeNull();

    picker.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({ granted: false });
    await chooseVideo(view);
    expect(await view.findByText("Không có quyền mở thư viện video.")).toBeTruthy();
    expect(view.getByDisplayValue("Giữ tiêu đề")).toBeTruthy();
    expect(view.getByDisplayValue("Giữ mô tả")).toBeTruthy();
    expect(view.queryByText("clip.mp4")).toBeNull();
    expect(uploadVideo).not.toHaveBeenCalled();
    expect(onUploaded).not.toHaveBeenCalled();
  });
});
