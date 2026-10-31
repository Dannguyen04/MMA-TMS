import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastMessage } from "@/components/toast/app-toast";

import {
  ACCENT_SWATCHES,
  appearanceSummary,
  DEFAULT_APPEARANCE_DRAFT,
  draftsEqual,
  PREVIEW_FIXTURE,
  previewPalette,
  resetAppearanceGroup,
  TYPE_SCALE,
  type AppearanceDraft,
  type DisplayMode,
  type ReadingSupport,
  type ThemeId,
  type TypeSize,
} from "@/screens/fighter/redesign/appearance-model";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { FighterStack } from "@/screens/fighter/redesign/shell";
import { APPEARANCE_SAVE_ERROR } from "@/theme/fighter-appearance";
import { useAppearanceActions, useAppearanceState } from "@/theme";

type Tab = "customize" | "preview";

export function FighterAppearanceEditor() {
  const colors = useFighterPalette();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fighterApplied } = useAppearanceState();
  const { applyFighterAppearance } = useAppearanceActions();
  const [tab, setTab] = useState<Tab>("customize");
  const [draft, setDraft] = useState<AppearanceDraft>(fighterApplied);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useToastMessage(error, "error");
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    if (!dirtyRef.current) setDraft(fighterApplied);
  }, [fighterApplied]);

  const change = (next: AppearanceDraft) => {
    dirtyRef.current = !draftsEqual(next, fighterApplied);
    setDraft(next);
    setError(null);
  };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (event, gesture) => {
        if (event.nativeEvent.pageX < 28) return false;
        return Math.abs(gesture.dx) > 24 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6;
      },
      onPanResponderRelease: (_event, gesture) => {
        if (gesture.dx <= -48 && tabRef.current === "customize") setTab("preview");
        if (gesture.dx >= 48 && tabRef.current === "preview") setTab("customize");
      },
    }),
  ).current;

  const cancel = () => {
    if (savingRef.current) return;
    dirtyRef.current = false;
    setDraft(fighterApplied);
    router.back();
  };

  const apply = () => {
    if (savingRef.current || draftsEqual(draft, fighterApplied)) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    void applyFighterAppearance(draft)
      .then(() => {
        dirtyRef.current = false;
      })
      .catch(() => {
        setError(APPEARANCE_SAVE_ERROR);
      })
      .finally(() => {
        savingRef.current = false;
        setSaving(false);
      });
  };

  const clean = draftsEqual(draft, fighterApplied);
  const applyDisabled = saving || clean;

  return (
    <FighterStack
      footer={
        <View style={[styles.bar, { backgroundColor: colors.bg, borderTopColor: colors.line, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Text style={[styles.note, { color: colors.muted }]}>Lưu trên điện thoại này. Không đồng bộ lên máy chủ.</Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Hủy"
              disabled={saving}
              onPress={cancel}
              style={[styles.cancel, { borderColor: colors.line, opacity: saving ? 0.5 : 1 }]}
            >
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "600" }}>Hủy</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: applyDisabled, busy: saving }}
              accessibilityLabel={saving ? "Đang lưu" : "Áp dụng"}
              disabled={applyDisabled}
              onPress={apply}
              style={[styles.apply, { backgroundColor: applyDisabled ? colors.surface2 : colors.accent }]}
            >
              <Text style={{ color: applyDisabled ? colors.muted : colors.onAccent, fontWeight: "600", fontSize: 14 }}>
                {saving ? "Đang lưu…" : "Áp dụng"}
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      <View style={styles.nav}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={cancel} style={styles.back}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
          Giao diện
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mặc định"
          onPress={() => change(DEFAULT_APPEARANCE_DRAFT)}
          style={styles.reset}
        >
          <Text style={{ color: colors.accent, fontWeight: "600", fontSize: 13 }}>Mặc định</Text>
        </Pressable>
      </View>
      <View style={styles.tabsPad}>
        <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: colors.surface2 }]}>
          <TabButton label="Tùy chỉnh" selected={tab === "customize"} onPress={() => setTab("customize")} />
          <TabButton label="Xem trước" selected={tab === "preview"} onPress={() => setTab("preview")} />
        </View>
        <Text style={[styles.hint, { color: colors.muted }]}>Chạm tab hoặc vuốt ngang để chuyển</Text>
      </View>
      <View {...pan.panHandlers}>
        {tab === "customize" ? (
          <Customize draft={draft} onChange={change} />
        ) : (
          <Preview draft={draft} />
        )}
      </View>
    </FighterStack>
  );
}

function Customize({
  draft,
  onChange,
}: {
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
}) {
  const colors = useFighterPalette();
  return (
    <View style={styles.pad}>
      <Text style={[styles.label, { color: colors.ink }]}>Chế độ hiển thị</Text>
      <View style={styles.row}>
        <ModeChoice mode="light" icon="white-balance-sunny" label="Sáng" draft={draft} onChange={onChange} />
        <ModeChoice mode="dark" icon="moon-waning-crescent" label="Tối" draft={draft} onChange={onChange} />
      </View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.ink }]}>Chủ đề</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Đặt lại chủ đề" onPress={() => onChange(resetAppearanceGroup(draft, "theme"))}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>Đặt lại mục này</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <ThemeCard id="default" label="Mặc định" swatch="#D9492F" wash="#F6F6F8" draft={draft} onChange={onChange} />
        <ThemeCard id="paper" label="Giấy" swatch="#8D6B48" wash="#F0E7D6" draft={draft} onChange={onChange} />
        <ThemeCard id="mint" label="Bạc hà" swatch="#408369" wash="#E0EEE7" draft={draft} onChange={onChange} />
      </View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.ink }]}>Màu nhấn</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>{ACCENT_SWATCHES.find((item) => item.id === draft.accent)?.label}</Text>
      </View>
      <View style={styles.swatches}>
        {ACCENT_SWATCHES.map((item) => {
          const selected = draft.accent === item.id;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => onChange({ ...draft, accent: item.id })}
              style={[
                styles.swatchHit,
                { borderColor: selected ? item.hex : "transparent" },
              ]}
            >
              <View style={[styles.swatch, { backgroundColor: item.hex }]}>
                {selected ? <Text style={styles.check}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.ink }]}>Kiểu chữ & cỡ chữ</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>Inter</Text>
      </View>
      <View style={[styles.sizes, { backgroundColor: colors.surface2 }]}>
        {(["small", "medium", "large"] as const).map((size) => (
          <SizeChoice key={size} size={size} draft={draft} onChange={onChange} />
        ))}
      </View>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.ink }]}>Hỗ trợ đọc</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Đặt lại hỗ trợ đọc" onPress={() => onChange(resetAppearanceGroup(draft, "reading"))}>
          <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "500" }}>Đặt lại mục này</Text>
        </Pressable>
      </View>
      <View style={styles.row}>
        <ReadChoice id="standard" label="Tiêu chuẩn" draft={draft} onChange={onChange} />
        <ReadChoice id="highContrast" label="Tương phản cao" draft={draft} onChange={onChange} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
        {appearanceSummary(draft)}
        {"\n"}
        Thay đổi trong tab Xem trước. Áp dụng để dùng trên cả ứng dụng.
      </Text>
    </View>
  );
}

function Preview({ draft }: { draft: AppearanceDraft }) {
  const sample = previewPalette(draft);
  const scale = TYPE_SCALE[draft.typeSize];
  const modeLabel = draft.mode === "dark" ? "Tối" : "Sáng";
  const themeLabel = draft.theme === "paper" ? "Giấy" : draft.theme === "mint" ? "Bạc hà" : "Mặc định";
  const sizeLabel = draft.typeSize === "small" ? "nhỏ" : draft.typeSize === "large" ? "lớn" : "vừa";
  return (
    <View style={{ backgroundColor: sample.bg, paddingBottom: 20 }}>
      <View style={[styles.banner, { backgroundColor: sample.accentSoft }]}>
        <MaterialCommunityIcons name="eye-outline" size={16} color={sample.accent} />
        <Text style={{ flex: 1, color: sample.accent, fontSize: 12 * scale }}>
          Màn hình mẫu · {themeLabel} · {modeLabel}
        </Text>
        <Text style={{ color: sample.accent, fontSize: 12 * scale }}>Inter {sizeLabel}</Text>
      </View>
      <View style={styles.sample}>
        <Text style={{ color: sample.muted, fontSize: 12 * scale, fontWeight: "600" }}>{PREVIEW_FIXTURE.academy}</Text>
        <Text style={{ color: sample.ink, fontSize: 22 * scale, fontWeight: "700", lineHeight: 28 * scale }}>
          {PREVIEW_FIXTURE.title}
        </Text>
        <View style={styles.athlete}>
          <View style={[styles.avatar, { backgroundColor: sample.surface2 }]}>
            <Text style={{ color: sample.ink, fontWeight: "700", fontSize: 16 * scale }}>{PREVIEW_FIXTURE.initials}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: sample.ink, fontSize: 17 * scale, fontWeight: "700" }}>{PREVIEW_FIXTURE.name}</Text>
            <Text style={{ color: sample.muted, fontSize: 12 * scale }}>{PREVIEW_FIXTURE.meta}</Text>
          </View>
        </View>
        <View style={[styles.card, { backgroundColor: sample.surface, borderColor: sample.line }]}>
          <View style={styles.head}>
            <Text style={{ color: sample.accent, fontSize: 12 * scale, fontWeight: "600" }}>{PREVIEW_FIXTURE.sessionKind}</Text>
            <Text style={{ color: sample.muted, fontSize: 12 * scale }}>{PREVIEW_FIXTURE.time}</Text>
          </View>
          <Text style={{ color: sample.ink, fontSize: 19 * scale, fontWeight: "700" }}>{PREVIEW_FIXTURE.sessionTitle}</Text>
          <Text style={{ color: sample.muted, fontSize: 13 * scale }}>{PREVIEW_FIXTURE.place}</Text>
        </View>
        <View style={styles.head}>
          <Text style={{ color: sample.ink, fontSize: 14 * scale, fontWeight: "600" }}>{PREVIEW_FIXTURE.weekLabel}</Text>
          <Text style={{ color: sample.accent, fontSize: 23 * scale, fontWeight: "700" }}>{PREVIEW_FIXTURE.weekValue}</Text>
        </View>
        <View style={styles.bars}>
          {Array.from({ length: PREVIEW_FIXTURE.weekTotal }, (_, index) => (
            <View
              key={index}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: index < PREVIEW_FIXTURE.weekDone ? sample.accent : sample.surface2,
              }}
            />
          ))}
        </View>
        <Text style={{ color: sample.muted, fontSize: 12 * scale }}>{PREVIEW_FIXTURE.disclaimer}</Text>
        <View style={[styles.reminder, { borderTopColor: sample.line }]}>
          <MaterialCommunityIcons name="bell-outline" size={18} color={sample.accent} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: sample.ink, fontSize: 13 * scale, fontWeight: "600" }}>{PREVIEW_FIXTURE.reminderTitle}</Text>
            <Text style={{ color: sample.muted, fontSize: 13 * scale, lineHeight: 19 * scale }}>{PREVIEW_FIXTURE.reminder}</Text>
          </View>
        </View>
        <Text style={{ color: sample.muted, fontSize: 12 * scale, lineHeight: 18 * scale }}>{PREVIEW_FIXTURE.sync}</Text>
      </View>
    </View>
  );
}

function TabButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useFighterPalette();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.tab, selected ? { backgroundColor: colors.bg } : null]}
    >
      <Text style={{ color: selected ? colors.accent : colors.muted, fontWeight: selected ? "700" : "500", fontSize: 14 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ModeChoice({
  mode,
  icon,
  label,
  draft,
  onChange,
}: {
  mode: DisplayMode;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
}) {
  const colors = useFighterPalette();
  const selected = draft.mode === mode;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => onChange({ ...draft, mode })}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surface2,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={colors.ink} />
      <Text style={{ flex: 1, color: colors.ink, fontWeight: selected ? "600" : "500" }}>{label}</Text>
      {selected ? <MaterialCommunityIcons name="check" size={16} color={colors.accent} /> : null}
    </Pressable>
  );
}

function ThemeCard({
  id,
  label,
  swatch,
  wash,
  draft,
  onChange,
}: {
  id: ThemeId;
  label: string;
  swatch: string;
  wash: string;
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
}) {
  const colors = useFighterPalette();
  const selected = draft.theme === id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => onChange({ ...draft, theme: id })}
      style={[
        styles.themeCard,
        {
          backgroundColor: selected ? colors.accentSoft : colors.bg,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <View style={[styles.palette, { backgroundColor: wash }]}>
        <View style={{ width: 20, height: 14, borderRadius: 3, backgroundColor: swatch }} />
        <View style={{ flex: 1, height: 5, borderRadius: 2, backgroundColor: swatch, opacity: 0.25 }} />
      </View>
      <View style={styles.head}>
        <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{label}</Text>
        {selected ? <MaterialCommunityIcons name="check" size={14} color={colors.accent} /> : null}
      </View>
    </Pressable>
  );
}

function SizeChoice({
  size,
  draft,
  onChange,
}: {
  size: TypeSize;
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
}) {
  const colors = useFighterPalette();
  const selected = draft.typeSize === size;
  const label = size === "small" ? "Nhỏ" : size === "large" ? "Lớn" : "Vừa";
  const fontSize = size === "small" ? 12 : size === "large" ? 16 : 14;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => onChange({ ...draft, typeSize: size })}
      style={[
        styles.size,
        {
          backgroundColor: selected ? colors.accentSoft : "transparent",
          borderColor: selected ? colors.accent : "transparent",
        },
      ]}
    >
      <Text style={{ color: selected ? colors.accent : colors.muted, fontSize, fontWeight: selected ? "600" : "400" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function ReadChoice({
  id,
  label,
  draft,
  onChange,
}: {
  id: ReadingSupport;
  label: string;
  draft: AppearanceDraft;
  onChange: (next: AppearanceDraft) => void;
}) {
  const colors = useFighterPalette();
  const selected = draft.reading === id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={() => onChange({ ...draft, reading: id })}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? colors.accentSoft : colors.bg,
          borderColor: selected ? colors.accent : colors.line,
        },
      ]}
    >
      <Text style={{ flex: 1, color: colors.ink, fontSize: 13, fontWeight: selected ? "600" : "400" }}>{label}</Text>
      {selected ? <MaterialCommunityIcons name="check" size={15} color={colors.accent} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  nav: { height: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  back: { width: 40, height: 44, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 24, fontWeight: "700" },
  reset: { height: 44, paddingHorizontal: 8, justifyContent: "center" },
  tabsPad: { paddingHorizontal: 20, gap: 6, marginBottom: 8 },
  tabs: { flexDirection: "row", borderRadius: 12, padding: 3, height: 44 },
  tab: { flex: 1, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 12, textAlign: "center", lineHeight: 20 },
  pad: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", gap: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 24 },
  choice: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  themeCard: { flex: 1, height: 76, borderRadius: 12, borderWidth: 1, padding: 8, gap: 7 },
  palette: { height: 26, borderRadius: 5, padding: 6, flexDirection: "row", alignItems: "center", gap: 4 },
  swatches: { flexDirection: "row", gap: 14 },
  swatchHit: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  swatch: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  check: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  sizes: { flexDirection: "row", borderRadius: 12, padding: 3, height: 44, gap: 3 },
  size: { flex: 1, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  banner: { height: 36, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 7 },
  sample: { paddingHorizontal: 20, paddingTop: 22, gap: 16 },
  athlete: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 },
  bars: { flexDirection: "row", gap: 5 },
  reminder: { flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14 },
  bar: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, paddingHorizontal: 20, gap: 8 },
  note: { fontSize: 12, textAlign: "center" },
  actions: { flexDirection: "row", gap: 12 },
  cancel: { width: 108, height: 46, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  apply: { flex: 1, height: 46, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
});
