import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";

import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { navSideWidth, useNavKind } from "@/components/nav-rail";

/** Chiều cao tối thiểu của vùng nút (không tính vùng an toàn phía dưới). */
export const TAB_BAR_MIN_HEIGHT = 56;

/** Phần đệm dưới: vùng an toàn của thiết bị, tối thiểu 8dp để nhãn không bị cắt. */
export function tabBarBottomPadding(insetBottom: number): number {
  return Math.max(insetBottom, 8);
}

/** Expo Router ẩn tab `href: null` bằng `tabBarItemStyle: { display: "none" }`. */
export function isHiddenTab(style: StyleProp<ViewStyle> | undefined): boolean {
  return StyleSheet.flatten(style)?.display === "none";
}

/**
 * Thanh tab dùng chung cho Coach và Admin (Expo Tabs), cùng kiểu với `FighterTabBar`:
 * nền = nền màn hình, viên thuốc xanh chanh nhạt cho mục đang chọn, chữ/biểu tượng `activeInk`,
 * cao tối thiểu 56dp + vùng an toàn, nhãn luôn hiện đủ.
 * Từ bề rộng 900 (Phase 5 F): thành thanh điều hướng dọc bên trái, cùng biểu tượng, nhãn và huy hiệu;
 * trên iPad là thanh bên rộng 240 (biểu tượng và nhãn cùng hàng); layout đặt `tabBarPosition: "left"` cùng ngưỡng.
 */
export function RoleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const p = useFighterPalette();
  const insets = useSafeAreaInsets();
  const kind = useNavKind(); const rail = kind !== "bar"; const sidebar = kind === "sidebar";
  // A screen can hide the bar while it is focused (in-bout Fight Camp screens) with `tabBarStyle: { display: "none" }`.
  const focusedRoute = state.routes[state.index];
  if (focusedRoute && isHiddenTab(descriptors[focusedRoute.key]?.options.tabBarStyle as StyleProp<ViewStyle>)) return null;
  return (
    <View
      accessibilityRole="tablist"
      testID={sidebar ? "nav-sidebar" : rail ? "nav-rail" : "tab-bar"}
      style={rail ? [
        sidebar ? styles.sidebar : styles.rail,
        { backgroundColor: p.bg, borderRightColor: p.line, paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 12), paddingLeft: insets.left + (sidebar ? 12 : 0), width: navSideWidth(kind) + insets.left },
      ] : [
        styles.bar,
        { backgroundColor: p.bg, borderTopColor: p.line, paddingBottom: tabBarBottomPadding(insets.bottom) },
      ]}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        if (isHiddenTab(options.tabBarItemStyle)) return null;
        const focused = state.index === index;
        const color = focused ? p.activeInk : p.muted;
        const label = typeof options.title === "string" ? options.title : route.name;
        const badge = options.tabBarBadge == null || options.tabBarBadge === "" ? null : String(options.tabBarBadge);
        const a11y = options.tabBarAccessibilityLabel ?? (badge ? `${label}, ${badge}` : label);
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={a11y}
            accessibilityState={{ selected: focused }}
            onPress={() => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
            }}
            style={sidebar ? [styles.sidebarItem, focused && { backgroundColor: p.accentSoft }] : rail ? styles.railItem : styles.item}
          >
            <View>
              {options.tabBarIcon?.({ focused, color, size: 24 })}
              {badge ? (
                <View
                  importantForAccessibility="no-hide-descendants"
                  accessibilityElementsHidden
                  style={[styles.badge, { backgroundColor: p.accent, borderColor: p.bg }]}
                >
                  <Text style={[styles.badgeText, { color: p.onAccent }]} maxFontSizeMultiplier={1.2}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={[sidebar ? styles.sidebarLabel : rail ? styles.railLabel : styles.label, { color, fontWeight: focused ? "700" : "500" }]} maxFontSizeMultiplier={1.4} numberOfLines={rail && !sidebar ? 2 : 1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingHorizontal: 8, minHeight: TAB_BAR_MIN_HEIGHT },
  item: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontSize: 10, lineHeight: 14 },
  rail: { flexDirection: "column", borderRightWidth: StyleSheet.hairlineWidth, gap: 12 },
  railItem: { minHeight: 64, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 4 },
  railLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  sidebar: { flexDirection: "column", borderRightWidth: StyleSheet.hairlineWidth, gap: 4, paddingRight: 12 },
  sidebarItem: { flexDirection: "row", minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "flex-start", gap: 14, borderRadius: 12 },
  sidebarLabel: { fontSize: 15, lineHeight: 20, flex: 1, textAlign: "left" },
  badge: {
    position: "absolute",
    top: -6,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 11, lineHeight: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },
});
