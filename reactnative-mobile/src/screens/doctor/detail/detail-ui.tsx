import { useEffect, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { RoCard, RowSkeletons } from "@/screens/coach/readonly/ro-ui";
import { ActionButton, TEXT, useDelayedFlag } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { fighter } from "@/i18n/fighter";

/**
 * Khối dựng đơn giản cho chi tiết Doctor (giao diện tạm, dễ chỉnh):
 * SectionCard = thẻ có tiêu đề + trạng thái tải/lỗi/rỗng riêng.
 */
export function SectionCard({
  title,
  badge,
  loading,
  error,
  onRetry,
  empty,
  emptyText,
  tone,
  children,
}: {
  title: string;
  badge?: ReactNode;
  loading: boolean;
  error: string;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  tone?: "error";
  children?: ReactNode;
}) {
  const p = useFighterPalette();
  const skeleton = useDelayedFlag(loading, 300);
  return (
    <RoCard tone={tone}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={[TEXT.cardTitle, { color: p.ink, flexShrink: 1 }]} accessibilityRole="header">
          {title}
        </Text>
        {badge}
      </View>
      {loading ? (
        skeleton ? <RowSkeletons count={1} height={48} /> : null
      ) : error ? (
        <View style={{ gap: 8 }}>
          <Text style={[TEXT.body, { color: p.danger }]}>{error}</Text>
          <ActionButton label={fighter.common.retry} variant="secondary" icon="retry" onPress={onRetry} />
        </View>
      ) : empty ? (
        <Text style={[TEXT.body, { color: p.ink }]}>{emptyText}</Text>
      ) : (
        children
      )}
    </RoCard>
  );
}

/** Hàng chip lọc cuộn ngang, mỗi chip cao 48dp. */
export function FilterChips<T extends string>({ items, value, onChange, label }: { items: readonly { key: T; label: string }[]; value: T; onChange: (k: T) => void; label: string }) {
  const p = useFighterPalette();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 16 }} accessibilityLabel={label}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(it.key)}
            hitSlop={{ top: 6, bottom: 6 }}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 18, justifyContent: "center", borderWidth: 1, borderColor: on ? p.accentSoft : p.line, backgroundColor: on ? p.accentSoft : p.surface }}
          >
            <Text style={{ fontSize: 14, lineHeight: 20, fontWeight: on ? "700" : "400", color: on ? p.link : p.ink }}>{it.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Thanh 3 tab của chi tiết; tab có thể mang số đếm (badge). */
export function DetailTabs<T extends string>({ tabs, value, onChange }: { tabs: readonly { key: T; label: string; badge?: number; a11y?: string }[]; value: T; onChange: (k: T) => void }) {
  const p = useFighterPalette();
  const keyboard = useKeyboardModality();
  const [focusKey, setFocusKey] = useState<T | null>(null);
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 12, backgroundColor: p.surface2 }}>
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={tab.a11y ?? tab.label}
            onPress={() => onChange(tab.key)}
            onFocus={() => setFocusKey(tab.key)}
            onBlur={() => setFocusKey((k) => (k === tab.key ? null : k))}
            style={({ pressed }: { pressed: boolean }) => ({
              flex: 1, minHeight: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6,
              backgroundColor: on ? p.surface : pressed ? p.surface : "transparent",
              // web: ẩn viền mặc định; tự vẽ vòng 2px màu nhấn, cách 2px, chỉ khi focus bằng bàn phím (:focus-visible).
              ...(Platform.OS === "web"
                ? ((keyboard && focusKey === tab.key
                    ? { outlineStyle: "solid", outlineWidth: 2, outlineColor: p.accent, outlineOffset: 2 }
                    : { outlineStyle: "none" }) as object)
                : null),
            })}
          >
            <Text style={[on ? TEXT.bodyBold : TEXT.body, { color: on ? p.link : p.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {tab.label}
            </Text>
            {tab.badge ? (
              <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: tab.badge > 9 ? 4 : 0, backgroundColor: p.accent, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ fontSize: 11, lineHeight: 14, fontWeight: "700", color: "#FFFFFF" }}>{badgeLabel(tab.badge)}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function badgeLabel(n: number): string {
  return n > 9 ? "9+" : String(n);
}

/**
 * Kiểu nhập gần nhất trên web (giống :focus-visible): true sau phím, false sau chuột/chạm.
 * Native luôn false (không vẽ vòng focus thêm).
 */
export function useKeyboardModality(): boolean {
  const [kb, setKb] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.altKey && !e.ctrlKey) setKb(true);
    };
    const onPointer = () => setKb(false);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("touchstart", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("touchstart", onPointer, true);
    };
  }, []);
  return kb;
}

/** Dòng phụ trong thẻ (nhãn đậm + nội dung). */
export function Line({ label, children }: { label?: string; children: ReactNode }) {
  const p = useFighterPalette();
  return (
    <Text style={[TEXT.detail, { color: p.ink }]}>
      {label ? <Text style={{ fontWeight: "700" }}>{label}: </Text> : null}
      {children}
    </Text>
  );
}
