import { type Href, usePathname, useRouter } from "expo-router";
import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type IconName } from "@/components/icon";
import { TabIcon } from "@/components/tab-icon";
import { fighter } from "@/i18n/fighter";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { navSideWidth, useNavKind, useNavRail } from "@/components/nav-rail";

export type FighterTab = "home" | "tap" | "plans" | "body" | "me";

const TABS: {
  key: FighterTab;
  href: Href;
  label: string;
  icon: IconName;
}[] = [
  { key: "home", href: "/", label: fighter.tabs.home, icon: "home" },
  { key: "tap", href: "/tap" as Href, label: fighter.tabs.tap, icon: "training" },
  { key: "plans", href: "/giao-an" as Href, label: fighter.tabs.plans, icon: "plans" },
  { key: "body", href: "/co-the" as Href, label: fighter.tabs.body, icon: "body" },
  { key: "me", href: "/toi" as Href, label: fighter.tabs.me, icon: "me" },
];

function tabFromPath(path: string): FighterTab | null {
  if (path.startsWith("/tap")) return "tap";
  if (path.startsWith("/giao-an")) return "plans";
  if (path.startsWith("/co-the")) return "body";
  if (path.startsWith("/toi")) return "me";
  if (path === "/" || path === "" || path.startsWith("/tran")) return "home";
  return null;
}

export function FighterTabBar() {
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const path = usePathname();
  const active = tabFromPath(path);
  // Phase 5 F: from 900 wide the same tabs sit in a left rail (iPad: a sidebar); the shells put it beside the content.
  const kind = useNavKind(); const rail = kind !== "bar"; const sidebar = kind === "sidebar";

  return (
    <View
      accessibilityRole="tablist"
      testID={sidebar ? "nav-sidebar" : rail ? "nav-rail" : "tab-bar"}
      style={rail ? [
        sidebar ? styles.sidebar : styles.rail,
        {
          backgroundColor: colors.bg,
          borderRightColor: colors.line,
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 12),
          paddingLeft: insets.left + (sidebar ? 12 : 0),
          width: navSideWidth(kind) + insets.left,
        },
      ] : [
        styles.bar,
        {
          backgroundColor: colors.bg,
          borderTopColor: colors.line,
          paddingBottom: Math.max(insets.bottom, 8),
        },
      ]}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? colors.activeInk : colors.muted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              const onHomeChild = tab.key === "home" && path !== "/" && path !== "";
              if (selected && !onHomeChild && tab.key !== "tap" && tab.key !== "plans") return;
              router.replace(tab.href);
            }}
            style={sidebar ? [styles.sidebarItem, selected && { backgroundColor: colors.accentSoft }] : rail ? styles.railItem : styles.item}
          >
            <TabIcon name={tab.icon} focused={selected} color={color} pillColor={colors.accentSoft} />
            <Text style={[sidebar ? styles.sidebarLabel : rail ? styles.railLabel : styles.label, { color, fontWeight: selected ? "700" : "500" }]} maxFontSizeMultiplier={1.4} numberOfLines={sidebar ? 1 : rail ? 2 : undefined}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  iconWrap: {
    width: 48,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  label: { fontSize: 10, lineHeight: 14 },
  rail: { flexDirection: "column", borderRightWidth: StyleSheet.hairlineWidth, gap: 12 },
  railItem: { minHeight: 64, paddingHorizontal: 4, alignItems: "center", justifyContent: "center", gap: 4 },
  railLabel: { fontSize: 12, lineHeight: 16, textAlign: "center" },
  sidebar: { flexDirection: "column", borderRightWidth: StyleSheet.hairlineWidth, gap: 4, paddingRight: 12 },
  sidebarItem: { flexDirection: "row", minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "flex-start", gap: 14, borderRadius: 12 },
  sidebarLabel: { fontSize: 15, lineHeight: 20, flex: 1, textAlign: "left" },
});

/**
 * From 900 wide: the fighter rail on the left, the screen beside it. Below that the shell keeps
 * rendering `<FighterTabBar />` at its bottom exactly as before, and this frame passes through.
 */
export function FighterRailFrame({ show, children, background }: { show: boolean; children: ReactNode; background: string }) {
  const rail = useNavRail();
  if (!show || !rail) return <>{children}</>;
  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: background }}>
      <FighterTabBar />
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}
