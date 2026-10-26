import { createContext, useContext, type ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { Icon, type IconName } from "@/components/icon";
import { ActionButton, CardSkeleton, SPEC, TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterScreen } from "@/screens/fighter/screen";
import { coachRo } from "@/i18n/coach-ro";
import { initials, toneColors, type ChipSpec } from "./ro-format";

/** Nút đặt ở góc phải header của các màn gốc (không có nút back), vd. chuông thông báo của Coach. */
export const RoHeaderAction = createContext<ReactNode>(null);

/** Khung màn Coach chỉ đọc: tiêu đề 24/32, lề 16, không có thanh tab Fighter. */
export function RoScreen({
  title,
  back,
  onRefresh,
  refreshing,
  children,
  trailing,
  wide,
  stickyHeaderIndices,
}: {
  title: string;
  /** Tuỳ chọn: ghim con trực tiếp khi cuộn. */
  stickyHeaderIndices?: number[];
  trailing?: ReactNode;
  /** Dùng hết bề ngang trên tablet (màn tự chia cột), bỏ giới hạn cột đọc. */
  wide?: boolean;
  back?: boolean;
  onRefresh?: () => Promise<unknown> | unknown;
  refreshing?: boolean;
  children: ReactNode;
}) {
  const headerAction = useContext(RoHeaderAction);
  return (
    <FighterScreen title={title} onBack={back} onRefresh={onRefresh} refreshing={refreshing} specLayout tabBar={false} trailing={trailing ?? (back ? null : headerAction)} wide={wide} stickyHeaderIndices={stickyHeaderIndices}>
      {children}
    </FighterScreen>
  );
}

/** Mở một đường dẫn không dùng route động ([id]) — id đi qua query. */
export function useGo() {
  const router = useRouter();
  return (pathname: string, id: string) => router.push({ pathname, params: { id } } as never);
}

export function Avatar({ name, uri, size = 48 }: { name: string; uri?: string | null; size?: number }) {
  const p = useFighterPalette();
  if (uri) {
    return <Image source={{ uri }} accessibilityLabel={name} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.surface2 }} />;
  }
  return (
    <View
      accessibilityLabel={name}
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: p.accentSoft }]}
    >
      <Text style={[TEXT.bodyBold, { color: p.activeInk, fontSize: size >= 56 ? 20 : 16 }]}>{initials(name)}</Text>
    </View>
  );
}

/** Chip trạng thái: biểu tượng + chữ, nền nhạt cùng sắc thái, đạt ≥ 4,5:1. */
export function StatusChip({ spec }: { spec: ChipSpec }) {
  const p = useFighterPalette();
  const c = toneColors(p, spec.tone);
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }]} accessibilityLabel={spec.label}>
      <Icon name={spec.icon as IconName} size={16} color={c.fg} />
      <Text style={[TEXT.captionBold, { color: c.fg }]} numberOfLines={1}>
        {spec.label}
      </Text>
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  const p = useFighterPalette();
  return (
    <Text accessibilityRole="header" style={[TEXT.cardTitle, { color: p.ink }]}>
      {children}
    </Text>
  );
}

export function RoCard({ title, children, tone }: { title?: string; children: ReactNode; tone?: "error" }) {
  const p = useFighterPalette();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: p.surface, borderColor: tone === "error" ? p.danger : p.line, borderWidth: tone === "error" ? 2 : 1 },
      ]}
    >
      {title ? <SectionTitle>{title}</SectionTitle> : null}
      {children}
    </View>
  );
}

export function InfoLine({ label, value }: { label: string; value: string }) {
  const p = useFighterPalette();
  return (
    <View style={styles.infoLine} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[TEXT.caption, { color: p.ink }]}>{label}</Text>
      <Text style={[TEXT.body, { color: p.ink }]}>{value}</Text>
    </View>
  );
}

/** Hàng danh sách chạm được (≥ 72dp) với chevron. */
export function RoRow({
  leading,
  title,
  lines,
  chip,
  onPress,
  children,
  label,
}: {
  leading?: ReactNode;
  title: string;
  lines?: string[];
  chip?: ChipSpec;
  onPress?: () => void;
  children?: ReactNode;
  label?: string;
}) {
  const p = useFighterPalette();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label ?? [title, ...(lines ?? []), chip?.label].filter(Boolean).join(", ")}
      onPress={onPress}
      style={({ pressed, focused }: { pressed: boolean; focused?: boolean }) => [
        styles.row,
        {
          backgroundColor: p.surface,
          borderColor: focused ? p.ring : p.line,
          borderWidth: focused ? 2 : 1,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      {leading}
      <View style={styles.rowBody}>
        <Text style={[TEXT.bodyBold, { color: p.ink }]} numberOfLines={2}>
          {title}
        </Text>
        {(lines ?? []).map((l, i) => (
          <Text key={i} style={[TEXT.detail, { color: p.ink }]} numberOfLines={2}>
            {l}
          </Text>
        ))}
        {chip ? (
          <View style={styles.rowChip}>
            <StatusChip spec={chip} />
          </View>
        ) : null}
        {children}
      </View>
      {onPress ? <Icon name="chevron" size={24} color={p.ink} /> : null}
    </Pressable>
  );
}

export function RowSkeletons({ count = 4, height = 96 }: { count?: number; height?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} height={height} />
      ))}
    </View>
  );
}

export function LoadMore({ onPress, loading }: { onPress: () => void; loading: boolean }) {
  return <ActionButton label={coachRo.schedule.loadMore} variant="secondary" icon="chevronDown" loading={loading} onPress={onPress} />;
}

/** Thanh tìm kiếm 48dp có viền focus 2px. */
export function SearchBar({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const p = useFighterPalette();
  return (
    <View style={[styles.search, { backgroundColor: p.surface, borderColor: p.line }]}>
      <Icon name="search" size={24} color={p.ink} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={p.ink}
        accessibilityLabel={placeholder}
        returnKeyType="search"
        maxLength={100}
        autoCorrect={false}
        style={[TEXT.body, styles.searchInput, { color: p.ink }]}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa" onPress={() => onChangeText("")} style={styles.clear}>
          <Icon name="close" size={24} color={p.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Thanh tab trong màn (Tổng quan / Cân nặng / Lịch tập / Y tế); mục đang chọn có nền nhấn + chữ đậm.
 * Nhãn không bao giờ bị cắt: mỗi tab rộng theo chữ (đệm ngang 6) và giãn đều khi đủ chỗ;
 * thiếu chỗ thì thanh cuộn ngang.
 */
export function SegmentTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  const p = useFighterPalette();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      testID="segment-tabs"
      style={styles.segmentScroll}
      contentContainerStyle={styles.segment}
    >
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(tab.key)}
            style={({ focused }: { pressed: boolean; focused?: boolean }) => [
              styles.segItem,
              {
                // Như chip lọc của Doctor: nền accentSoft, chữ link, không viền đỏ.
                backgroundColor: on ? p.accentSoft : p.surface,
                borderColor: focused ? p.ring : on ? p.accentSoft : p.line,
                borderWidth: focused ? 2 : 1,
              },
            ]}
          >
            <Text style={[on ? TEXT.bodyBold : TEXT.body, { color: on ? p.link : p.ink }]} numberOfLines={1}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ProgressBar({ pct }: { pct: number }) {
  const p = useFighterPalette();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
      style={[styles.track, { backgroundColor: p.surface2, borderColor: p.line }]}
    >
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: p.activeInk }]} />
    </View>
  );
}

export function Stack({ children, gap = SPEC.gap }: { children: ReactNode; gap?: number }) {
  return <View style={{ gap }}>{children}</View>;
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 8, minHeight: 24, paddingVertical: 4 },
  card: { borderRadius: SPEC.radius, padding: SPEC.card, gap: SPEC.gap, alignSelf: "stretch" },
  infoLine: { gap: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: SPEC.radius, padding: SPEC.card, minHeight: 72, alignSelf: "stretch" },
  rowBody: { flex: 1, gap: 4 },
  rowChip: { marginTop: 4 },
  stack: { gap: SPEC.gap },
  search: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: SPEC.radius, borderWidth: 1, paddingHorizontal: 12, minHeight: SPEC.button },
  searchInput: { flex: 1, minHeight: SPEC.button, paddingVertical: 0 },
  clear: { width: 48, height: 48, alignItems: "center", justifyContent: "center", marginRight: -12 },
  segmentScroll: { flexGrow: 0 },
  segment: { flexGrow: 1, flexDirection: "row", gap: 6 },
  segItem: { flexGrow: 1, flexShrink: 0, minHeight: SPEC.button, borderRadius: SPEC.radius, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  track: { height: 8, borderRadius: 4, overflow: "hidden", borderWidth: 1 },
  fill: { height: "100%", borderRadius: 4 },
});
