/// <reference types="jest" />
import { Platform, StyleSheet, Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { ThemePreferenceProvider } from "@/theme";
import { RoleTabBar } from "@/components/role-tab-bar";
import { FighterRailFrame, FighterTabBar } from "@/screens/fighter/tab-bar";
import { NAV_RAIL_MIN_WIDTH, NAV_RAIL_WIDTH, NAV_SIDEBAR_WIDTH, isNavRail, navKind, navSideWidth } from "./nav-rail";

let mockDims = { width: 390, height: 844, scale: 2, fontScale: 1 };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => mockDims }));
const mockReplace = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: mockReplace }), usePathname: () => "/co-the" }));

const wrap = (node: React.ReactNode, insets = { top: 0, left: 0, right: 0, bottom: 0 }) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: mockDims.width, height: mockDims.height }, insets }}><ThemePreferenceProvider>{node}</ThemePreferenceProvider></SafeAreaProvider>;
const navigate = jest.fn();
const props = {
  state: { index: 0, routes: [{ key: "a", name: "vo-si" }, { key: "b", name: "thong-bao" }, { key: "c", name: "medical" }] },
  descriptors: {
    a: { options: { title: "Võ sĩ" } },
    b: { options: { title: "Thông báo", tabBarBadge: "2", tabBarAccessibilityLabel: "Thông báo, 2 thông báo chưa đọc" } },
    c: { options: { title: "Y tế", tabBarItemStyle: { display: "none" } } },
  },
  navigation: { emit: () => ({ defaultPrevented: false }), navigate },
} as unknown as BottomTabBarProps;

const setPad = (pad: boolean) => { Object.defineProperty(Platform, "isPad", { value: pad, configurable: true }); };
beforeEach(() => { jest.clearAllMocks(); setPad(false); });
afterAll(() => setPad(false));
describe("Navigation rail (Phase 5 F)", () => {
  it("switches at 900 wide", () => {
    expect(NAV_RAIL_MIN_WIDTH).toBe(900);
    expect([390, 820, 899].map(isNavRail)).toEqual([false, false, false]);
    expect([900, 1180, 1280].map(isNavRail)).toEqual([true, true, true]);
  });
  it.each([{ width: 390, height: 844, id: "tab-bar" }, { width: 820, height: 1180, id: "tab-bar" }, { width: 1180, height: 820, id: "nav-rail" }, { width: 1280, height: 800, id: "nav-rail" }])("role tabs at $width×$height render as $id with the same labels, badge and hidden tabs", async ({ width, height, id }) => {
    mockDims = { width, height, scale: 2, fontScale: 1 };
    await render(wrap(<RoleTabBar {...props}/>, { top: 24, left: id === "nav-rail" ? 20 : 0, right: 0, bottom: 20 }));
    const bar = screen.getByTestId(id);
    expect(screen.queryByTestId(id === "nav-rail" ? "tab-bar" : "nav-rail")).toBeNull();
    expect(screen.getByLabelText("Thông báo, 2 thông báo chưa đọc")).toBeTruthy();
    expect(screen.getByText("2", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Y tế")).toBeNull();
    const style = StyleSheet.flatten(bar.props.style);
    if (id === "nav-rail") {
      expect(style.width).toBe(NAV_RAIL_WIDTH + 20);
      expect(style.paddingLeft).toBe(20);
      expect(style.paddingTop).toBe(24 + 12);
      expect(style.flexDirection).toBe("column");
    } else expect(style.flexDirection).toBe("row");
    await fireEvent.press(screen.getByLabelText("Thông báo, 2 thông báo chưa đọc"));
    expect(navigate).toHaveBeenCalledWith("thong-bao", undefined);
  });
  it("iPad gets a 240 sidebar from 900, Android and web keep the 88 rail", () => {
    expect(navKind(1180, true)).toBe("sidebar");
    expect(navKind(1366, true)).toBe("sidebar");
    expect(navKind(820, true)).toBe("bar");
    expect(navKind(1280, false)).toBe("rail");
    expect([navSideWidth("sidebar"), navSideWidth("rail"), navSideWidth("bar")]).toEqual([NAV_SIDEBAR_WIDTH, NAV_RAIL_WIDTH, 0]);
    expect(NAV_SIDEBAR_WIDTH).toBe(240);
  });
  it.each([{ width: 1180, height: 820 }, { width: 1366, height: 1024 }])("iPad role tabs at $width×$height: sidebar with icon and label in a row, same badge and hidden tabs", async ({ width, height }) => {
    setPad(true);
    mockDims = { width, height, scale: 2, fontScale: 1 };
    await render(wrap(<RoleTabBar {...props}/>, { top: 24, left: 0, right: 0, bottom: 20 }));
    const bar = screen.getByTestId("nav-sidebar");
    expect(screen.queryByTestId("nav-rail")).toBeNull();
    expect(StyleSheet.flatten(bar.props.style).width).toBe(NAV_SIDEBAR_WIDTH);
    expect(screen.getByText("2", { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByText("Y tế")).toBeNull();
    const item = screen.getByLabelText("Thông báo, 2 thông báo chưa đọc");
    expect(StyleSheet.flatten(item.props.style).flexDirection).toBe("row");
    await fireEvent.press(item);
    expect(navigate).toHaveBeenCalledWith("thong-bao", undefined);
  });
  it("Android-size tablet (not iPad) at 1280×800 keeps the rail", async () => {
    mockDims = { width: 1280, height: 800, scale: 2, fontScale: 1 };
    await render(wrap(<RoleTabBar {...props}/>));
    expect(screen.getByTestId("nav-rail")).toBeTruthy();
    expect(screen.queryByTestId("nav-sidebar")).toBeNull();
  });
  it("fighter tabs on iPad become the sidebar beside the screen", async () => {
    setPad(true);
    mockDims = { width: 1366, height: 1024, scale: 2, fontScale: 1 };
    await render(wrap(<FighterRailFrame show background="#000"><Text>Màn hình</Text></FighterRailFrame>));
    expect(StyleSheet.flatten(screen.getByTestId("nav-sidebar").props.style).width).toBe(NAV_SIDEBAR_WIDTH);
    expect(screen.getByRole("tab", { name: "Cơ thể", selected: true })).toBeTruthy();
  });
  it("fighter tabs become a rail beside the screen only from 900 wide", async () => {
    mockDims = { width: 1180, height: 820, scale: 2, fontScale: 1 };
    await render(wrap(<FighterRailFrame show background="#000"><Text>Màn hình</Text></FighterRailFrame>));
    expect(screen.getByTestId("nav-rail")).toBeTruthy();
    expect(screen.getByText("Màn hình")).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Cơ thể", selected: true })).toBeTruthy();
    mockDims = { width: 820, height: 1180, scale: 2, fontScale: 1 };
    const narrow = await render(wrap(<FighterRailFrame show background="#000"><Text>Màn hình</Text></FighterRailFrame>));
    expect(narrow.queryByTestId("nav-rail")).toBeNull();
    const bar = await render(wrap(<FighterTabBar/>));
    expect(bar.getByTestId("tab-bar")).toBeTruthy();
  });
});
