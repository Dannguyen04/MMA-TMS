import { Fragment, type ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { useRouter, type Href } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ApplicationStatus } from "@/api/admissions";
import { Icon, IconBadge, type IconName, type IconTone } from "@/components/icon";
import { FadeInView, PressableScale } from "@/components/motion";
import { useReadableWidth } from "@/components/readable-width";
import { FeatureUnavailable } from "@/components/feature-unavailable";
import { manager } from "@/i18n/manager";
import { vi } from "@/i18n/vi";
import { useAdminType } from "@/screens/admin/admin-page";
import { radius, spacing, useThemePreference, type ColorTokens } from "@/theme";
import { mixHex } from "@/theme/appearance/color-math";
import { ThemedRefreshControl, usePullRefresh } from "@/components/loading";

/** Khung màn Quản lý theo Figma: tiêu đề + nút quay lại, nội dung cuộn, thanh nút cố định dưới. */
export function AdminScreen({
  title,
  onBack = true,
  action,
  children,
  footer,
  testID,
  onBackPress,
  onRefresh,
}: {
  title: string;
  onBack?: boolean;
  /** Ghi đè hành vi nút quay lại (vd. đóng Modal). */
  onBackPress?: () => void;
  action?: { label: string; onPress: () => void };
  children?: ReactNode;
  footer?: ReactNode;
  testID?: string;
  /** Kéo để làm mới; hàm trả Promise, reject khi lỗi (toast, giữ dữ liệu cũ). */
  onRefresh?: (mode: "refresh") => Promise<unknown> | unknown;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const insets = useSafeAreaInsets();
  const pull = usePullRefresh(onRefresh ?? (() => undefined));
  const router = useRouter();
  const readable = useReadableWidth();

  return (
    <View testID={testID} style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top + spacing.sm }]}>
      <View style={[styles.header, readable]}>
        {onBack ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={manager.back}
            hitSlop={10}
            onPress={() => (onBackPress ? onBackPress() : router.canGoBack() ? router.back() : router.replace("/(admin)" as Href))}
            style={styles.backBtn}
          >
            <Icon name="back" size={24} />
          </PressableScale>
        ) : null}
        <Text accessibilityRole="header" style={[at.name, styles.flex, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        {action ? (
          <PressableScale accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
            <Text style={[at.metaStrong, { color: colors.lotus }]}>{action.label}</Text>
          </PressableScale>
        ) : null}
      </View>
      <ScrollView
        style={styles.flex}
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <ThemedRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} /> : undefined}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: (footer ? spacing.lg : insets.bottom) + spacing.xl },
          readable,
        ]}
      >
        {children}
      </ScrollView>
      {footer ? (
        <View
          style={[
            styles.footer,
            { borderTopColor: colors.line, backgroundColor: colors.bg, paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          <View style={[styles.footerInner, readable]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );
}

export function AdminSection({ title, hint, children, style }: { title: string; hint?: string; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View style={[styles.section, style]}>
      <Text accessibilityRole="header" style={[at.section, { color: colors.ink }]}>{title}</Text>
      {hint ? <Text style={[at.meta, { color: colors.inkMuted }]}>{hint}</Text> : null}
      {children}
    </View>
  );
}

export function AdminCard({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useThemePreference();
  return <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }, style]}>{children}</View>;
}

export function AdminField({ label, value }: { label: string; value: string }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View style={styles.field}>
      <Text style={[at.meta, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[at.body, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

export function AdminFieldPair({ children }: { children: ReactNode }) {
  return <View style={styles.pair}>{children}</View>;
}

/** Ghi chú trong thẻ (icon màu nhấn + tiêu đề + mô tả), như "Bước tiếp theo", "Khám ban đầu". */
export function AdminNotice({
  icon = "info",
  title,
  body,
  tone = "accent",
}: {
  icon?: IconName;
  title?: string;
  body: string;
  tone?: IconTone;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}>
      <Icon name={icon} size={20} tone={tone} />
      <View style={styles.flex}>
        {title ? <Text style={[at.metaStrong, { color: colors.ink }]}>{title}</Text> : null}
        <Text style={[at.meta, { color: colors.inkMuted }]}>{body}</Text>
      </View>
    </View>
  );
}

/** Hàng danh sách có icon, tiêu đề, phụ đề và mũi tên. */
export function AdminRow({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  tone = "accent",
  index,
  last,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  badge?: string;
  onPress?: () => void;
  tone?: IconTone;
  index?: number;
  last?: boolean;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const body = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[title, subtitle, badge].filter(Boolean).join(", ")}
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.985}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}
    >
      {icon ? <Icon name={icon} size={22} tone={tone} /> : null}
      <View style={styles.flex}>
        <Text style={[at.rowTitle, { color: colors.ink }]} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={[at.meta, { color: colors.inkMuted }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={[at.meta, { color: colors.inkSubtle }]}>{badge}</Text> : null}
      {onPress ? <Icon name="chevron" size={20} tone="muted" /> : null}
    </PressableScale>
  );
  return index == null ? body : <FadeInView index={index}>{body}</FadeInView>;
}

/** Lựa chọn dạng radio trong danh sách (chọn HLV, bác sĩ). */
export function AdminChoiceList({
  options,
  value,
  onChange,
}: {
  options: { id: string; title: string; subtitle?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View accessibilityRole="radiogroup" style={[styles.choices, { borderColor: colors.line }]}>
      {options.map((option, index) => {
        const selected = option.id === value;
        return (
          <Fragment key={option.id}>
            {index > 0 ? <View style={[styles.rule, { backgroundColor: colors.line }]} /> : null}
            <PressableScale
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.title}
              onPress={() => onChange(option.id)}
              scaleTo={0.985}
              style={[
                styles.choice,
                {
                  backgroundColor: selected ? mixHex(colors.surface, colors.lotus, 0.14) : colors.surface,
                  borderColor: selected ? colors.lotus : "transparent",
                },
              ]}
            >
              <Icon name={selected ? "success" : "circle"} size={22} tone={selected ? "accent" : "muted"} />
              <View style={styles.flex}>
                <Text style={[at.rowTitle, { color: colors.ink }]} numberOfLines={1}>{option.title}</Text>
                {option.subtitle ? (
                  <Text style={[at.meta, { color: colors.inkMuted }]} numberOfLines={1}>{option.subtitle}</Text>
                ) : null}
              </View>
            </PressableScale>
          </Fragment>
        );
      })}
    </View>
  );
}

export function AdminButton({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "danger";
  disabled?: boolean;
  loading?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const off = disabled || loading;
  const bg = variant === "primary" ? (off ? colors.disabledFill : colors.cta) : off && variant === "danger" ? colors.surface : "transparent";
  const border = variant === "primary" ? "transparent" : variant === "danger" ? (off ? colors.line : colors.danger) : colors.line;
  const ink = off ? colors.disabledInk : variant === "primary" ? colors.onCta : variant === "danger" ? colors.danger : colors.ink;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={[styles.button, { backgroundColor: bg, borderColor: border }, style]}
    >
      {loading ? <ActivityIndicator color={ink} /> : icon ? <Icon name={icon} size={20} color={ink} /> : null}
      <Text style={[at.rowTitle, { color: ink }]} numberOfLines={1}>{title}</Text>
    </PressableScale>
  );
}

export function AdminButtonRow({ children }: { children: ReactNode }) {
  return <View style={styles.buttonRow}>{children}</View>;
}

export function AdminInput({ label, style, ...rest }: TextInputProps & { label: string }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  return (
    <View style={styles.field}>
      <Text style={[at.metaStrong, { color: colors.ink }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.inkSubtle}
        {...rest}
        style={[
          at.body,
          styles.input,
          rest.multiline && styles.inputMulti,
          { color: colors.ink, backgroundColor: colors.surfaceMuted, borderColor: colors.line },
          style,
        ]}
      />
    </View>
  );
}

/** Nhóm nút chọn dạng tab (Tổng quan / Gán HLV / Quyết định, bộ lọc). */
export function AdminSegments<T extends string>({
  options,
  value,
  onChange,
  scroll,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  scroll?: boolean;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const items = options.map((option) => {
    const selected = option.value === value;
    return (
      <PressableScale
        key={option.value}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={option.label}
        onPress={() => onChange(option.value)}
        style={[
          scroll ? styles.chip : styles.segment,
          {
            backgroundColor: selected ? colors.bg : "transparent",
            borderColor: selected ? colors.line : "transparent",
          },
        ]}
      >
        <Text style={[at.metaStrong, { color: selected ? colors.lotus : colors.inkMuted }]} numberOfLines={1}>
          {option.label}
        </Text>
      </PressableScale>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.segments, { backgroundColor: colors.surface }]}>
        {items}
      </ScrollView>
    );
  }
  return (
    <View accessibilityRole="tablist" style={[styles.segments, { backgroundColor: colors.surface }]}>
      {items}
    </View>
  );
}

export function Initials({ name, size = 44 }: { name: string; size?: number }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? "")
    .filter(Boolean);
  // Tên Việt: lấy chữ đầu của hai từ cuối (Đỗ Khánh Linh → KL), như Figma.
  const text = (letters.length > 1 ? letters.slice(-2).join("") : letters[0] ?? "?").toUpperCase();
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: mixHex(colors.surface, colors.lotus, 0.16),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[at.metaStrong, { color: colors.lotus, fontSize: size * 0.36 }]}>{text}</Text>
    </View>
  );
}

const STATUS_ICON: Record<ApplicationStatus, IconName> = {
  SUBMITTED: "send",
  FAILED: "xCircle",
  PASSED: "success",
  REJECTED: "ban",
  APPROVED: "success",
  ACTIVATED: "admission",
};

function statusColor(colors: ColorTokens, status: ApplicationStatus): string {
  if (status === "FAILED" || status === "REJECTED") return colors.danger;
  if (status === "SUBMITTED") return colors.lotus;
  return colors.success;
}

export function ApplicationStatusPill({ status }: { status: ApplicationStatus }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const ink = statusColor(colors, status);
  return (
    <View style={[styles.pill, { backgroundColor: mixHex(colors.surface, ink, 0.14) }]}>
      <Icon name={STATUS_ICON[status]} size={14} color={ink} />
      <Text style={[at.metaStrong, { color: ink, fontSize: 13 }]} numberOfLines={1}>
        {vi.admission.status[status]}
      </Text>
    </View>
  );
}

/** Nhãn nhỏ trung tính (vai trò, trạng thái, loại video). */
export function AdminTag({ label, tone = "muted" }: { label: string; tone?: "muted" | "accent" | "danger" | "success" }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const ink = tone === "accent" ? colors.lotus : tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.inkMuted;
  return (
    <View style={[styles.pill, { backgroundColor: tone === "muted" ? colors.surfaceMuted : mixHex(colors.surface, ink, 0.14) }]}>
      <Text style={[at.metaStrong, { color: ink, fontSize: 13 }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

/** Màn chưa có API (bố cục Figma "Chưa khả dụng trên điện thoại") — dùng FeatureUnavailable + nút "Về Quản lý". */
export function AdminUnavailable({ title, description }: { title: string; description: string }) {
  const router = useRouter();
  return (
    <AdminScreen
      title={title}
      footer={<AdminButton title={manager.backHome} icon="home" variant="outline" onPress={() => router.replace("/(admin)" as Href)} />}
    >
      <View style={styles.centered}>
        <FeatureUnavailable description={`${description} ${manager.unavailableBody}`} />
      </View>
    </AdminScreen>
  );
}

export { IconBadge };

export const adminStyles = StyleSheet.create({
  gapLg: { gap: spacing.lg },
  gapMd: { gap: spacing.md },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.xl - 4,
  },
  backBtn: { width: 32, height: 40, alignItems: "flex-start", justifyContent: "center" },
  scroll: { paddingHorizontal: spacing.xl - 4, paddingTop: spacing.lg, gap: spacing.xl },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, paddingHorizontal: spacing.xl - 4 },
  footerInner: { gap: spacing.md },
  section: { gap: spacing.md },
  card: { borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.md },
  field: { gap: 4, flex: 1 },
  pair: { flexDirection: "row", gap: spacing.lg, flexWrap: "wrap" },
  notice: { flexDirection: "row", gap: spacing.md, padding: spacing.lg, borderRadius: radius.field, alignItems: "flex-start" },
  row: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  choices: { borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  rule: { height: StyleSheet.hairlineWidth },
  choice: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderWidth: 1 },
  button: {
    minHeight: 52,
    borderRadius: radius.field,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexGrow: 1,
  },
  buttonRow: { flexDirection: "row", gap: spacing.md },
  input: { minHeight: 48, borderRadius: radius.field, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  inputMulti: { minHeight: 96, textAlignVertical: "top" },
  segments: { flexDirection: "row", borderRadius: radius.field, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.field - 2, borderWidth: 1, paddingHorizontal: spacing.xs },
  chip: { minHeight: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.field - 2, borderWidth: 1, paddingHorizontal: spacing.md },
  pill: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  centered: { minHeight: 420, justifyContent: "center" },
});
