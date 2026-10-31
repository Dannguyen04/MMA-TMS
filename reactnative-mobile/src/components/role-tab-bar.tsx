import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "expo-router/build/layouts/Tabs";

import { useFighterPalette } from "@/screens/fighter/redesign/palette";

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
 */
export function RoleTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const p = useFighterPalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[
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
            style={styles.item}
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
            <Text style={[styles.label, { color, fontWeight: focused ? "700" : "500" }]} maxFontSizeMultiplier={1.4} numberOfLines={1}>
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
