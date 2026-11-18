/// <reference types="jest" />
import { Platform, StyleSheet, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { READABLE_MAX_WIDTH } from "@/components/readable-width";
import { CAMP_TWO_COLUMN_MAX, CampColumns, campTwoColumns } from "./camp-columns";
import { CampShell } from "./camp-ui";

let mockDims = { width: 390, height: 844, scale: 2, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDims }));
jest.mock("expo-router", () => ({ useRouter: () => ({ back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const page = (columns: boolean) => <CampShell columns={columns} title="Báo cáo trận" onBack={() => undefined}>
  <CampColumns left={<Text>Kết quả</Text>} right={<Text>Chiến thuật</Text>}><Text>Kết quả</Text><Text>Chiến thuật</Text></CampColumns>
</CampShell>;
const maxWidth = (ui: Awaited<ReturnType<typeof render>>) => StyleSheet.flatten(ui.getByTestId("camp-column").props.style).maxWidth;

describe("Coach two columns (Phase 5 E)", () => {
  it("needs the opt-in and at least 744 of shell width", () => {
    expect(campTwoColumns(true, 743)).toBe(false);
    expect(campTwoColumns(true, 744)).toBe(true);
    expect(campTwoColumns(false, 1200)).toBe(false);
    expect(CAMP_TWO_COLUMN_MAX).toBe(1040);
  });
  it.each([
    { width: 390, height: 844, two: false },
    { width: 430, height: 932, two: false },
    { width: 744, height: 1133, two: true },
    { width: 820, height: 1180, two: true },
    { width: 1024, height: 768, two: true },
    { width: 1180, height: 820, two: true },
    { width: 1280, height: 800, two: true },
  ])("at $width×$height (window minus the rail) two columns: $two", async ({ width, height, two }) => {
    mockDims = { width, height, scale: 2, fontScale: 1 };
    const ui = await render(page(true));
    expect(!!ui.queryByTestId("camp-two-columns")).toBe(two);
    expect(maxWidth(ui)).toBe(two ? CAMP_TWO_COLUMN_MAX : READABLE_MAX_WIDTH);
    expect(ui.getAllByText("Kết quả")).toHaveLength(1);
    expect(ui.getAllByText("Chiến thuật")).toHaveLength(1);
    if (two) {
      let n: ReturnType<typeof ui.getByText> | null = ui.getByText("Kết quả"); while (n && n.props.testID !== "camp-column-left") n = n.parent;
      expect(n).toBeTruthy();
    }
  });
  it("follows the measured shell width, not the window", async () => {
    mockDims = { width: 1180, height: 820, scale: 2, fontScale: 1 };
    const ui = await render(page(true));
    expect(ui.queryByTestId("camp-two-columns")).toBeTruthy();
    const root = ui.getByTestId("camp-shell");
    await act(async () => { fireEvent(root, "layout", { persist: () => undefined, nativeEvent: { layout: { x: 0, y: 0, width: 700, height: 820 } } }); });
    expect(ui.queryByTestId("camp-two-columns")).toBeNull();
    expect(maxWidth(ui)).toBe(READABLE_MAX_WIDTH);
  });
  it.each([
    { width: 1024, height: 768, two: true },
    { width: 1180, height: 820, two: true },
    { width: 1366, height: 1024, two: true },
  ])("iPad sidebar (240): $width×$height two columns: $two (window minus the sidebar before layout)", async ({ width, height, two }) => {
    Object.defineProperty(Platform, "isPad", { value: true, configurable: true });
    try {
      mockDims = { width, height, scale: 2, fontScale: 1 };
      const ui = await render(page(true));
      expect(!!ui.queryByTestId("camp-two-columns")).toBe(two);
    } finally { Object.defineProperty(Platform, "isPad", { value: false, configurable: true }); }
  });
  it("stays one column without the opt-in", async () => {
    mockDims = { width: 1280, height: 800, scale: 2, fontScale: 1 };
    const ui = await render(page(false));
    expect(ui.queryByTestId("camp-two-columns")).toBeNull();
  });
});
