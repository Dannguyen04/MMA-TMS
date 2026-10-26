import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";

import { BottomSheet } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { StateView } from "@/components/state-view";
import { doctorUi } from "@/i18n/doctor-ui";
import { radius, spacing, type, useThemePreference } from "@/theme";

import { cleanInitials, doctorMuted } from "./doctor-chrome";

export { cleanInitials };

/**
 * Thang chữ 4 bậc cho mọi màn Bác sĩ (lấy từ token `type`, theo cài đặt Giao diện):
 * heading (tiêu đề thẻ) · section (nhãn nhóm, viết hoa) · value (nội dung) · meta (phụ, ngày giờ).
 * Số liệu sinh hiệu dùng `type.title` (display) nhưng không viết hoa.
 */
export function useDoctorText() {
  const { colors } = useThemePreference();
  const muted = doctorMuted(colors);
  const style = (...parts: (TextStyle | false | null | undefined)[]): StyleProp<TextStyle> => parts;
  return {
    colors,
    muted,
    heading: style(type.cta, { color: colors.ink }),
    section: style(type.label, styles.section, { color: muted }),
    value: style(type.body, { color: colors.ink }),
    meta: style(type.caption, { color: muted }),
    stat: style(type.title, styles.stat, { color: colors.ink }),
    link: style(type.link, { color: colors.lotus }),
  };
}

export function DoctorAvatar({ initials, size = 42 }: { initials: string; size?: number }) {
  const t = useDoctorText();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: t.colors.surfaceMuted },
      ]}
    >
      <Text style={[size > 48 ? t.heading : t.value, { color: t.colors.ink }]}>{initials}</Text>
    </View>
  );
}

export function SectionTitle({ text, trailing }: { text: string; trailing?: ReactNode }) {
  const t = useDoctorText();
  return (
    <View style={styles.sectionRow}>
      <Text style={[t.section, styles.flex]} accessibilityRole="header">
        {text}
      </Text>
      {trailing}
    </View>
  );
}

/** Thẻ tóm tắt: tiêu đề + chip + 1 dòng meta + (tuỳ chọn) 2 dòng xem trước; chạm để mở chi tiết. */
export function SummaryCard({
  title,
  badges,
  meta,
  preview,
  onPress,
  actionLabel,
  children,
}: {
  title: string;
  badges?: ReactNode;
  meta?: string | null;
  preview?: string | null;
  onPress?: () => void;
  actionLabel?: string;
  children?: ReactNode;
}) {
  const t = useDoctorText();
  const body = (
    <View style={[styles.card, { backgroundColor: t.colors.surface, borderColor: t.colors.line }]}>
      <View style={styles.cardHead}>
        <Text style={[t.heading, styles.flex]}>{title}</Text>
        {onPress ? <Icon name="chevron" size={18} color={t.muted} /> : null}
      </View>
      {badges ? <View style={styles.badges}>{badges}</View> : null}
      {meta ? <Text style={t.meta}>{meta}</Text> : null}
      {preview ? (
        <Text style={t.value} numberOfLines={2}>
          {preview}
        </Text>
      ) : null}
      {children}
      {onPress && actionLabel ? <Text style={t.link}>{actionLabel}</Text> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, meta].filter(Boolean).join(". ")}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      {body}
    </Pressable>
  );
}

export type Stat = { label: string; value: string; unit?: string };

/** Ô số liệu 2 cột (sinh hiệu…). */
export function StatGrid({ items }: { items: Stat[] }) {
  const t = useDoctorText();
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ""}`}
          style={[styles.tile, { backgroundColor: t.colors.surface, borderColor: t.colors.line }]}
        >
          <Text style={t.meta}>{item.label}</Text>
          <Text style={t.stat} numberOfLines={1} adjustsFontSizeToFit>
            {item.value}
            {item.unit ? <Text style={t.meta}> {item.unit}</Text> : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

export type KeyValue = { label: string; value: string | null | undefined; tone?: "danger" | "ok" };

/** Nhãn trái – giá trị phải; dòng rỗng bị ẩn (không in "—"). */
export function KeyValueList({ rows }: { rows: KeyValue[] }) {
  const t = useDoctorText();
  const visible = rows.filter((row) => row.value != null && row.value !== "" && row.value !== "—");
  if (visible.length === 0) return null;
  return (
    <View style={styles.kv}>
      {visible.map((row) => (
        <View key={row.label} style={[styles.kvRow, { borderBottomColor: t.colors.line }]}>
          <Text style={[t.meta, styles.kvLabel]}>{row.label}</Text>
          <Text
            style={[
              t.value,
              styles.kvValue,
              row.tone === "danger" ? { color: t.colors.danger } : row.tone === "ok" ? { color: t.colors.success } : null,
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Văn bản tự do dài: 2 dòng + "Xem thêm"/"Thu gọn". */
export function ClampText({ text, lines = 2, label }: { text: string; lines?: number; label?: string }) {
  const t = useDoctorText();
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  return (
    <View style={styles.clamp}>
      {label ? <Text style={t.meta}>{label}</Text> : null}
      <Text
        style={t.value}
        numberOfLines={open ? undefined : lines}
        onTextLayout={(event) => {
          if (!open && event.nativeEvent.lines.length >= lines) setLong(true);
        }}
      >
        {text}
      </Text>
      {long || text.length > 120 ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setOpen((v) => !v)}>
          <Text style={t.link}>{open ? doctorUi.showLess : doctorUi.showMore}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Nút ⓘ mở bottom sheet giải thích (câu pháp lý / kỹ thuật không cần đọc mỗi lần). */
export function InfoButton({ title, body }: { title: string; body: string | string[] }) {
  const t = useDoctorText();
  const [open, setOpen] = useState(false);
  const lines = Array.isArray(body) ? body : [body];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${doctorUi.info}: ${title}`}
        hitSlop={10}
        onPress={() => setOpen(true)}
        style={styles.info}
      >
        <Icon name="info" size={18} color={t.muted} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={title}>
        <View style={styles.sheetBody}>
          {lines.map((line) => (
            <Text key={line} style={t.value}>
              {line}
            </Text>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

/** Lỗi tải + Thử lại (StateView). */
export function DoctorRetry({ error, onRetry }: { error: string; onRetry: () => void }) {
  if (!error) return null;
  return <StateView kind="error" compact title={error} actionLabel={doctorUi.retry} onAction={onRetry} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { textTransform: "uppercase", letterSpacing: 0.6 },
  sectionRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  stat: { textTransform: "none" },
  avatar: { alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: radius.panel, padding: spacing.lg, gap: spacing.sm },
  cardHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.field,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: 4,
  },
  kv: { gap: 0 },
  kvRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kvLabel: { flex: 1, paddingTop: 2 },
  kvValue: { flex: 1.3, textAlign: "right" },
  clamp: { gap: 4 },
  info: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  sheetBody: { gap: spacing.md, paddingBottom: spacing.md },
});
