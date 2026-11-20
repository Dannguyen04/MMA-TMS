import { useEffect, useRef, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { RolePage } from "@/components/role-page";
import { showAppToast } from "@/components/toast/app-toast";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { Action } from "@/shared/ui/camp-ui";
import { useAppearanceActions, useAppearanceState, useThemePreference } from "@/theme";
import { simplifyAppearance } from "@/theme/appearance/readability-policy";
import { appearanceEqual, DEFAULT_APPEARANCE, NUMERIC_RANGES, type AppearanceSettings, type NumericSettingKey } from "@/theme/appearance/settings";
import { buildColors, buildTypography, type TypographyTokens } from "@/theme/appearance/tokens";
import type { ColorTokens } from "@/theme/colors";
import { fonts, fz, fzWith, lh, lhWith, textStyleWith } from "@/theme/typography";
import { TrackSlider } from "./controls";

export const appearanceCopy = {
  title: "Giao diện",
  preview: "Xem trước",
  inUse: "Đang dùng",
  unsaved: "Chưa lưu",
  mode: "Chế độ màu",
  modes: { light: "Sáng", dark: "Tối", system: "Theo máy" },
  systemHint: (dark: boolean) => `Máy đang ở chế độ ${dark ? "Tối" : "Sáng"}.`,
  sliders: { fontScale: "Cỡ chữ", letterSpacing: "Khoảng cách chữ", lineHeight: "Khoảng cách dòng" } satisfies Record<NumericSettingKey, string>,
  reset: "Về mặc định",
  save: "Lưu",
  discard: "Bỏ thay đổi",
  saved: "Đã lưu. Cả app đã đổi theo.",
  saveFailed: "Không lưu được giao diện. Thử lại.",
  leaveTitle: "Bỏ thay đổi chưa lưu?",
  leaveDrop: "Bỏ",
  leaveStay: "Ở lại",
} as const;

type Mode = "light" | "dark" | "system";
const MODES: readonly Mode[] = ["light", "dark", "system"];
const KEYS: readonly NumericSettingKey[] = ["fontScale", "letterSpacing", "lineHeight"];
const formatValue = (key: NumericSettingKey, v: number) => key === "lineHeight" ? `${v.toFixed(2)}×` : `${Math.round(v * 100)}%`;

/**
 * One appearance page for Fighter, Coach, Doctor and Admin. The preview pinned under the header draws from the
 * unsaved draft; "Lưu" applies it to the whole app at once (every text size reads the applied typography live).
 */
export function AppearanceScreen() {
  const { applied, systemScheme, osFontScale } = useAppearanceState();
  const { applyAppearance } = useAppearanceActions();
  const { colors: c } = useThemePreference();
  const [draft, setDraft] = useState(() => simplifyAppearance(applied));
  const [saving, setSaving] = useState(false);
  const [leaveAction, setLeaveAction] = useState<null | (() => void)>(null);
  const latestApplied = useRef(applied);
  const mounted = useRef(true);
  const router = useRouter();
  const navigation = useNavigation();
  const dirty = !appearanceEqual(draft, simplifyAppearance(applied));
  const dirtyRef = useRef(dirty); dirtyRef.current = dirty;

  useEffect(() => {
    if (latestApplied.current !== applied) { latestApplied.current = applied; setDraft(simplifyAppearance(applied)); }
  }, [applied]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => navigation.addListener("beforeRemove", event => {
    if (!dirtyRef.current) return;
    event.preventDefault();
    setLeaveAction(() => () => { dirtyRef.current = false; navigation.dispatch(event.data.action); });
  }), [navigation]);

  const update = (patch: Partial<AppearanceSettings>) => setDraft(d => simplifyAppearance({ ...d, settings: { ...d.settings, ...patch } }));
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const saved = await applyAppearance(simplifyAppearance(draft));
      if (!mounted.current) return;
      showAppToast(saved ? appearanceCopy.saved : appearanceCopy.saveFailed, saved ? "success" : "error");
    } catch { if (mounted.current) showAppToast(appearanceCopy.saveFailed, "error"); }
    finally { if (mounted.current) setSaving(false); }
  };

  const mode: Mode = MODES.includes(draft.settings.mode as Mode) ? draft.settings.mode as Mode : "system";
  const palette = buildColors(draft.settings, systemScheme).colors;
  const typo = buildTypography(draft.settings, osFontScale, true);

  return <RolePage testID="appearance-screen" title={appearanceCopy.title} onBack={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    pinned={<Preview palette={palette} typo={typo} dirty={dirty}/>}
    footer={<View style={{ gap: 6 }}>
      <Action label={appearanceCopy.save} pending={saving} disabled={!dirty} onPress={() => { void save(); }}/>
      {dirty ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDraft(simplifyAppearance(applied))} hitSlop={4}
        style={({ pressed }) => ({ minHeight: 44, alignSelf: "center", justifyContent: "center", paddingHorizontal: 16, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: fz(15), lineHeight: lh(20), color: c.ink }}>{appearanceCopy.discard}</Text>
      </Pressable> : null}
    </View>}>
    <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 22 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: fz(15), lineHeight: lh(20), color: c.ink }}>{appearanceCopy.mode}</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel={appearanceCopy.mode} style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: c.line }}>
          {MODES.map(m => {
            const on = m === mode;
            return <Pressable key={m} testID={`appearance-mode-${m}`} accessibilityRole="radio" accessibilityLabel={appearanceCopy.modes[m]} accessibilityState={{ selected: on, checked: on }}
              onPress={() => update({ mode: m })}
              style={({ pressed }) => ({ flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderBottomWidth: 2, marginBottom: -1,
                borderBottomColor: on ? c.lotus : "transparent", opacity: pressed ? 0.6 : 1 })}>
              <Text numberOfLines={1} style={{ fontFamily: fonts.uiSemi, fontSize: fz(15), lineHeight: lh(20), color: on ? c.ink : c.inkMuted }}>{appearanceCopy.modes[m]}</Text>
            </Pressable>;
          })}
        </View>
        {mode === "system" ? <Text style={{ fontSize: fz(14), lineHeight: lh(20), color: c.inkMuted }}>{appearanceCopy.systemHint(systemScheme === "dark")}</Text> : null}
      </View>
      {KEYS.map(key => <TrackSlider key={key} label={appearanceCopy.sliders[key]} value={draft.settings[key]} {...NUMERIC_RANGES[key]}
        onChange={value => update({ [key]: value })} formatValue={v => formatValue(key, v)}/>)}
      <Pressable accessibilityRole="button" testID="appearance-reset" onPress={() => setDraft(DEFAULT_APPEARANCE)} hitSlop={4}
        style={({ pressed }) => ({ minHeight: 44, alignSelf: "flex-start", justifyContent: "center", opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ fontFamily: fonts.uiSemi, fontSize: fz(15), lineHeight: lh(20), color: c.lotus }}>{appearanceCopy.reset}</Text>
      </Pressable>
    </View>
    <ConfirmDialog visible={!!leaveAction} title={appearanceCopy.leaveTitle} cancelLabel={appearanceCopy.leaveStay} confirmLabel={appearanceCopy.leaveDrop}
      onCancel={() => setLeaveAction(null)} onConfirm={() => { const go = leaveAction; setLeaveAction(null); go?.(); }}/>
  </RolePage>;
}

/** A shrunken real screen (header, two fighter rows, one suspended, a sentence, the tab bar), painted from the draft. */
function Preview({ palette: p, typo, dirty }: { palette: ColorTokens; typo: TypographyTokens; dirty: boolean }) {
  const { colors: c } = useThemePreference();
  const size = (n: number) => fzWith(typo, n);
  const line = (n: number) => lhWith(typo, n);
  const track = (n: number) => Math.round(typo.letterSpacingEm * size(n) * 100) / 100;
  const display = (n: number, extra = 0.4) => ({ fontFamily: fonts.display, fontSize: size(n), lineHeight: line(Math.ceil(n * 1.2)), letterSpacing: extra + track(n), textTransform: "uppercase" as const, color: p.ink });
  const meta = { ...textStyleWith(typo, 12.5), color: p.inkMuted };
  const row = (mark: string, markColor: string, name: string, rest: string, note?: readonly string[]) =>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: p.line }}>
      <Text style={{ width: 30, textAlign: "center", fontFamily: fonts.displayExtraBold, fontSize: size(24), lineHeight: line(28), color: markColor }}>{mark}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={display(14.5, 0.4)}>{name}</Text>
        <Text numberOfLines={1} style={meta}><Text style={{ color: p.success, fontFamily: typo.faces.semibold }}>Khỏe</Text>{` · ${rest}`}</Text>
        {note?.map((n, i) => <Text key={i} style={{ ...meta, color: p.danger, fontFamily: i === 0 ? typo.faces.semibold : typo.faces.regular }}>{n}</Text>)}
      </View>
    </View>;
  return <View testID="appearance-preview" accessibilityLabel={appearanceCopy.preview} style={{ gap: 8 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
      <Text style={{ fontFamily: fonts.display, fontSize: fz(15), lineHeight: lh(21), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink }}>{appearanceCopy.preview}</Text>
      <Text testID="appearance-preview-state" style={{ fontFamily: dirty ? fonts.uiSemi : fonts.ui, fontSize: fz(12.5), lineHeight: lh(17), color: dirty ? c.lotus : c.inkMuted }}>
        {dirty ? appearanceCopy.unsaved : appearanceCopy.inUse}
      </Text>
    </View>
    <View style={{ backgroundColor: p.bg, borderWidth: 1, borderColor: p.line, borderTopRightRadius: 0, overflow: "hidden" }}>
      <Text style={{ ...display(16, 0.3), textAlign: "center", paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: p.line }}>Võ sĩ</Text>
      <View style={{ paddingHorizontal: 12 }}>
        {row("!", p.danger, "Anh Le", "Hạng rơm", ["Đang đình chỉ đến 25/11", "Hạ đo ván (KO)"])}
        {row("✓", p.success, "Kenji Morita", "Hạng lông")}
        <Text numberOfLines={3} style={{ ...textStyleWith(typo, 13.5), color: p.ink, paddingVertical: 8 }}>
          Hiệp sau: giữ khoảng cách, ra đòn rõ ràng và nghe chỉ dẫn của huấn luyện viên.
        </Text>
      </View>
      <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: p.line, paddingVertical: 5 }}>
        {["Hôm nay", "Võ sĩ", "Lịch", "Tôi"].map((t, i) => <Text key={t} numberOfLines={1}
          style={{ flex: 1, textAlign: "center", fontFamily: i === 1 ? typo.faces.semibold : typo.faces.regular, fontSize: Math.min(size(11), 13), lineHeight: Math.min(line(15), 17), color: i === 1 ? p.lotus : p.inkMuted }}>{t}</Text>)}
      </View>
    </View>
  </View>;
}
