import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemePreferenceProvider } from "@/theme/theme-preference";
import { readableTextStyle } from "@/theme/typography";
import { AppearanceScreen, appearanceCopy as t } from "./appearance-screen";

type Listener = (event: { preventDefault: () => void; data: { action: unknown } }) => void;
const mockListeners: Listener[] = [];
const mockDispatch = jest.fn();
const mockBack = jest.fn();
const mockToast = jest.fn();

jest.mock("moti", () => ({ MotiView: jest.requireActual("react-native").View }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  useNavigation: () => ({
    addListener: (_name: string, fn: Listener) => { mockListeners.push(fn); return () => {}; },
    dispatch: mockDispatch,
  }),
}));
jest.mock("@/components/toast/app-toast", () => ({ showAppToast: (...args: unknown[]) => mockToast(...args) }));

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const screen = () => render(<SafeAreaProvider initialMetrics={metrics}><ThemePreferenceProvider><AppearanceScreen/></ThemePreferenceProvider></SafeAreaProvider>);

beforeEach(() => { mockListeners.length = 0; jest.clearAllMocks(); });

describe("Giao diện", () => {
  it("previews the draft, then Lưu applies it to the whole app at once", async () => {
    const ui = await screen();
    const state = () => ui.getByTestId("appearance-preview-state");
    await waitFor(() => expect(state()).toHaveTextContent(t.inUse));
    expect(ui.getByRole("button", { name: t.save })).toBeDisabled();
    expect(ui.queryByText(t.discard)).toBeNull();

    // Jest reports an OS text scale of 2, which already caps the size factor, so the test moves line height.
    const before = readableTextStyle(16).lineHeight;
    await fireEvent.press(ui.getByLabelText("Tăng Khoảng cách dòng"));
    expect(state()).toHaveTextContent(t.unsaved);
    expect(ui.getByText(t.discard)).toBeTruthy();
    expect(readableTextStyle(16).lineHeight).toBe(before); // nothing outside the preview moves before saving

    await act(async () => { fireEvent.press(ui.getByRole("button", { name: t.save })); });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(t.saved, "success"));
    expect(readableTextStyle(16).lineHeight).toBeGreaterThan(before); // the app reads the saved setting on its next render
    expect(state()).toHaveTextContent(t.inUse);
  });

  it("asks before leaving with unsaved changes", async () => {
    const ui = await screen();
    await fireEvent.press(ui.getByLabelText(t.modes.light));
    const preventDefault = jest.fn();
    const action = { type: "GO_BACK" };
    await act(async () => { mockListeners.forEach(fn => fn({ preventDefault, data: { action } })); });
    expect(preventDefault).toHaveBeenCalled();
    expect(ui.getByTestId("appearance-preview-state")).toHaveTextContent(t.unsaved);
    expect(ui.getByText(t.leaveTitle)).toBeTruthy();
    await fireEvent.press(ui.getByText(t.leaveDrop));
    expect(mockDispatch).toHaveBeenCalledWith(action);
  });

  it("Về mặc định only resets the draft; Bỏ thay đổi goes back to what is in use", async () => {
    const ui = await screen();
    await fireEvent.press(ui.getByLabelText(t.modes.dark));
    expect(ui.getByText(t.discard)).toBeTruthy();
    await fireEvent.press(ui.getByText(t.discard));
    expect(ui.queryByText(t.discard)).toBeNull();
    await fireEvent.press(ui.getByLabelText(t.modes.dark));
    await fireEvent.press(ui.getByTestId("appearance-reset"));
    // The first test saved a taller line height, so the default is a change that still needs Lưu.
    expect(ui.getByText("1.35×")).toBeTruthy();
    expect(ui.getByTestId("appearance-preview-state")).toHaveTextContent(t.unsaved);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
