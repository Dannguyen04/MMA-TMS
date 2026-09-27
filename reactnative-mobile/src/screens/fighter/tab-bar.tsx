import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type Href, usePathname, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fighter } from "@/i18n/fighter";
import { spacing, type, useThemePreference } from "@/theme";

export type FighterTab = "home" | "tap" | "plans" | "body" | "me";

const TABS: {
  key: FighterTab;
  href: Href;
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
}[] = [
  { key: "home", href: "/", label: fighter.tabs.home, icon: "home-outline" },
  { key: "tap", href: "/tap" as Href, label: fighter.tabs.tap, icon: "boxing-glove" },
  { key: "plans", href: "/giao-an" as Href, label: fighter.tabs.plans, icon: "clipboard-text-outline" },
  { key: "body", href: "/co-the" as Href, label: fighter.tabs.body, icon: "human" },
  { key: "me", href: "/toi" as Href, label: fighter.tabs.me, icon: "account-outline" },
];

function tabFromPath(path: string): FighterTab {
  if (path.startsWith("/tap")) return "tap";
  if (path.startsWith("/giao-an")) return "plans";
  if (path.startsWith("/co-the")) return "body";
  if (path.startsWith("/toi")) return "me";
  return "home";
}

export function FighterTabBar() {
  const { colors } = useThemePreference();
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
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {TABS.map((tab) => {
        const selected = tab.key === active;
        const color = selected ? colors.lotus : colors.inkMuted;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected && tab.key !== "tap" && tab.key !== "plans") return;
              router.replace(tab.href);
            }}
            style={styles.item}
          >
            <MaterialCommunityIcons name={tab.icon} size={22} color={color} />
            <Text style={[type.caption, styles.label, { color }]}>{tab.label}</Text>
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
    paddingTop: spacing.sm,
  },
  item: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  label: {
    lineHeight: 16,
    fontSize: 11,
  },
});
