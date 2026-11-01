import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastMessage } from "@/components/toast/app-toast";
import { fighter } from "@/i18n/fighter";
import { FighterRailFrame, FighterTabBar } from "@/screens/fighter/tab-bar";
import { useNavRail } from "@/components/nav-rail";
import { radius, spacing, type, useThemePreference } from "@/theme";
import { StateView } from "@/components/state-view";
import { states } from "@/i18n/unavailable";
import { useReadableWidth } from "@/components/readable-width";
import { ThemedRefreshControl, TopProgress, usePullRefresh } from "@/components/loading";
import { ArenaFrame } from "@/components/arena/arena-frame";
import { ArenaTitle } from "@/components/arena/arena-title";

type FighterScreenProps = {
  title: string;
  children: ReactNode;
  onBack?: boolean;
  keyboard?: boolean;
  /** Đang tải lần đầu: thanh tiến trình mảnh dưới tiêu đề. */
  refreshing?: boolean;
  /** Kéo để làm mới; reject khi lỗi → toast, giữ dữ liệu cũ. */
  onRefresh?: () => Promise<unknown> | unknown;
  footer?: ReactNode;
  /** Thước đo Designer FINAL: lề 16, khoảng cách 16, tiêu đề màn hình 24/32 đậm. */
  specLayout?: boolean;
  /** Mặc định có thanh tab của Fighter; màn Coach đã có thanh tab riêng nên đặt false. */
  tabBar?: boolean;
  /** Nút phụ bên phải tiêu đề (vd. chuông Thông báo); mặc định để trống cho cân tiêu đề. */
  trailing?: ReactNode;
  /** Bỏ giới hạn bề rộng đọc trên tablet (màn tự bố cục nhiều cột). */
  wide?: boolean;
  /** Tuỳ chọn: chỉ số con trực tiếp được ghim khi cuộn (mặc định không ghim). */
  stickyHeaderIndices?: number[];
};

export function FighterScreen({
  title,
  children,
  onBack,
  keyboard,
  refreshing,
  onRefresh,
  footer,
  specLayout,
  tabBar = true,
  trailing,
  wide,
  stickyHeaderIndices,
}: FighterScreenProps) {
  const pull = usePullRefresh(onRefresh ?? (() => undefined));
  const readable = useReadableWidth();
  const { colors } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const rail = useNavRail();

  const body = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      stickyHeaderIndices={stickyHeaderIndices}
      refreshControl={onRefresh ? <ThemedRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} /> : undefined}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xxl },
        specLayout && { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
        wide ? null : readable,
      ]}
    >
      {children}
    </ScrollView>
  );

  return (
    <FighterRailFrame show={tabBar} background={colors.bg}>
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            borderBottomColor: colors.line,
            backgroundColor: colors.surface,
          },
        ]}
      >
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={fighter.common.back}
            hitSlop={8}
            onPress={() => router.back()}
            style={styles.back}
          >
            <MaterialCommunityIcons name="chevron-left" size={28} color={colors.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <ArenaTitle compact>{title}</ArenaTitle>
        {trailing ? <View style={styles.back}>{trailing}</View> : <View style={styles.back} />}
      </View>
      <TopProgress active={!!refreshing && !pull.refreshing} />
      {keyboard ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={8}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
      {footer}
      {tabBar && !rail ? <FighterTabBar /> : null}
    </View>
    </FighterRailFrame>
  );
}

export function GlassCard({ children }: { children: ReactNode }) {
  return <ArenaFrame>{children}</ArenaFrame>;
}

export function StatusLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { colors } = useThemePreference();
  useToastMessage(message, "error");
  if (!message || !onRetry) return null;
  // Lỗi có thể thử lại → khối trạng thái có minh họa (Lottie "error").
  return (
    <StateView
      kind="error"
      compact
      title={states.loadFailed}
      description={message}
      actionLabel={fighter.common.retry}
      onAction={onRetry}
    />
  );
}

export function EmptyCopy({ text }: { text: string }) {
  // Trạng thái rỗng có minh họa (Lottie "empty"), màu theo theme.
  return <StateView kind="empty" compact title={text} />;
}

export function SectionLabel({ text }: { text: string }) {
  const { colors } = useThemePreference();
  return <Text style={[type.label, styles.section, { color: colors.lotus }]}>{text}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, textAlign: "center" },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.panel,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  status: { gap: spacing.sm },
  retry: { minHeight: 44, justifyContent: "center" },
  section: { letterSpacing: 0.8, lineHeight: 18, textTransform: "uppercase" },
});
