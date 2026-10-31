import { type ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FighterTabBar } from "@/screens/fighter/tab-bar";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useTypography } from "@/theme";
import { titleTextStyle } from "@/theme/typography";

export function HubHeader({ title, trailing }: { title: string; trailing?: ReactNode }) {
  const colors = useFighterPalette();
  const live = useTypography();
  const titleStyle = titleTextStyle(live);
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[titleStyle, styles.headerTitle, { color: colors.ink, textTransform: "none" }]}
      >
        {title}
      </Text>
      {trailing}
    </View>
  );
}

export function FighterHub({
  children,
  keyboard,
  refreshing,
}: {
  children: ReactNode;
  keyboard?: boolean;
  refreshing?: boolean;
}) {
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 24 }}
    >
      {refreshing ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : null}
      {children}
    </ScrollView>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      <FighterTabBar />
    </View>
  );
}

export function FighterStack({
  children,
  footer,
  keyboard,
}: {
  children: ReactNode;
  footer?: ReactNode;
  keyboard?: boolean;
}) {
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 16 }}
    >
      {children}
    </ScrollView>
  );
  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  spinner: { marginBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { flex: 1, flexShrink: 1 },
});
