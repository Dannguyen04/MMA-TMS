import { type ReactNode } from "react";
import {
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
import { useReadableWidth } from "@/components/readable-width";
import { ThemedRefreshControl, TopProgress, usePullRefresh } from "@/components/loading";

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
  onRefresh,
}: {
  children: ReactNode;
  keyboard?: boolean;
  /** Đang tải lần đầu: thanh tiến trình mảnh trên cùng (không xoay đôi với kéo làm mới). */
  refreshing?: boolean;
  /** Kéo để làm mới; reject khi lỗi → toast, giữ dữ liệu cũ. */
  onRefresh?: () => Promise<unknown> | unknown;
}) {
  const pull = usePullRefresh(onRefresh ?? (() => undefined));
  const readable = useReadableWidth();
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <ThemedRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} /> : undefined}
      contentContainerStyle={[{ paddingTop: insets.top + 10, paddingBottom: 24 }, readable]}
    >
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
      <View pointerEvents="none" style={[styles.progress, { top: insets.top }]}>
        <TopProgress active={!!refreshing && !pull.refreshing} />
      </View>
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
  const readable = useReadableWidth();
  const colors = useFighterPalette();
  const insets = useSafeAreaInsets();
  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingBottom: 16 }, readable]}
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
  progress: { position: "absolute", left: 0, right: 0 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: { flex: 1, flexShrink: 1 },
});
