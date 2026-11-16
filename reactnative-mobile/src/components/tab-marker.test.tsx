/// <reference types="jest" />
import { StyleSheet } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";
import { ThemePreferenceProvider } from "@/theme";
import { RoleTabBar } from "@/components/role-tab-bar";
import { TabIcon } from "@/components/tab-icon";
import { useSlidingMarker } from "@/components/tab-marker";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({ __esModule: true, default: () => ({ width: 390, height: 844, scale: 2, fontScale: 1 }) }));

const wrap = (node: React.ReactNode) => <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}><ThemePreferenceProvider>{node}</ThemePreferenceProvider></SafeAreaProvider>;
const props = (index: number) => ({
  state: { index, routes: [{ key: "a", name: "hom-nay" }, { key: "b", name: "vo-si" }, { key: "c", name: "thong-bao" }] },
  descriptors: {
    a: { options: { title: "Hôm nay", tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => <TabIcon name="home" focused={focused} color={color} solid/> } },
    b: { options: { title: "Võ sĩ", tabBarIcon: ({ focused, color }: { focused: boolean; color: string }) => <TabIcon name="fighters" focused={focused} color={color} solid/> } },
    c: { options: { title: "Thông báo", tabBarItemStyle: { display: "none" } } },
  },
  navigation: { emit: () => ({ defaultPrevented: false }), navigate: jest.fn() },
}) as unknown as BottomTabBarProps;

const layout = (x: number, y: number, width: number, height: number) => ({ nativeEvent: { layout: { x, y, width, height } } });

describe("sliding tab marker (redesign step 15)", () => {
  it("draws one red marker behind the focused icon and no per-icon pill", async () => {
    await render(wrap(<RoleTabBar {...props(0)}/>));
    expect(screen.getAllByTestId("tab-marker", { includeHiddenElements: true })).toHaveLength(1);
    const marker = screen.getByTestId("tab-marker", { includeHiddenElements: true });
    expect(StyleSheet.flatten(marker.props.style)).toMatchObject({ width: 56, height: 28, borderRadius: 14, backgroundColor: "#D9381E" });
  });

  it("places the marker on the measured active icon, then follows the focused route", async () => {
    const view = await render(wrap(<RoleTabBar {...props(0)}/>));
    const items = [screen.getByRole("tab", { name: "Hôm nay" }), screen.getByRole("tab", { name: "Võ sĩ" })];
    await act(async () => {
      items.forEach((it, k) => {
        it.props.onLayout(layout(8 + k * 100, 8, 100, 48));
        it.children[0] && (it.children[0] as unknown as { props: { onLayout: (e: unknown) => void } }).props.onLayout?.(layout(26, 2, 48, 28));
      });
    });
    await view.rerender(wrap(<RoleTabBar {...props(1)}/>));
    await fireEvent.press(items[1]);
    expect(screen.getByTestId("tab-marker", { includeHiddenElements: true })).toBeTruthy();
  });

  it("stays centred on the tab when the bar widens and the icon reports no new layout", async () => {
    const hooks: { onItem?: (k: string) => (e: unknown) => void; onIcon?: (k: string) => (e: unknown) => void } = {};
    function Probe() {
      const { marker, onItemLayout, onIconLayout } = useSlidingMarker("a");
      hooks.onItem = onItemLayout as never; hooks.onIcon = onIconLayout as never;
      return marker;
    }
    await render(<Probe/>);
    const x = () => (StyleSheet.flatten(screen.getByTestId("tab-marker", { includeHiddenElements: true }).props.style).transform as { translateX?: number }[])[0]!.translateX;
    await act(async () => { hooks.onItem!("a")(layout(0, 8, 75, 48)); hooks.onIcon!("a")(layout(14, 2, 48, 28)); });
    expect(x()).toBe(75 / 2 - 28);
    // The pane widens: the tab grows to 110, the icon keeps its size and sends nothing.
    await act(async () => { hooks.onItem!("a")(layout(0, 8, 110, 48)); });
    expect(x()).toBe(110 / 2 - 28);
  });
});
