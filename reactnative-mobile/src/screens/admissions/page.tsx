import { type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { vi } from "@/i18n/vi";
import { spacing, type, useThemePreference } from "@/theme";

export function AdmissionPage({
  title,
  children,
  onBack = true,
}: {
  title: string;
  children: ReactNode;
  onBack?: boolean;
}) {
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.md }]}>
      <View style={styles.top}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()}>
            <Text style={[type.link, { color: colors.lotus }]}>Quay lại</Text>
          </Pressable>
        ) : (
          <Text style={[type.wordmark, { color: colors.ink }]}>{vi.brand.wordmark}</Text>
        )}
      </View>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.screenX, gap: spacing.md },
  top: { minHeight: 44, justifyContent: "center" },
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
});
