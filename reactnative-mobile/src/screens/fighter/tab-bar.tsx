import { type Href, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type IconName } from "@/components/icon";
import { TabIcon } from "@/components/tab-icon";
import { fighter } from "@/i18n/fighter";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";

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

  return (
    <View
      accessibilityRole="tablist"
      style={[
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
            style={styles.item}
          >
            <TabIcon name={tab.icon} focused={selected} color={color} pillColor={colors.accentSoft} />
            <Text style={[styles.label, { color, fontWeight: selected ? "700" : "500" }]} maxFontSizeMultiplier={1.4}>
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
});
