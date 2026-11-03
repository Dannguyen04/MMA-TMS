import { useEffect, useRef, useState } from "react";
import { useNavigation, useRouter } from "expo-router";
import { Text, View } from "react-native";

import { ArenaFrame } from "@/components/arena/arena-frame";
import { showAppToast } from "@/components/toast/app-toast";
import { Action, CampShell, Choices, Copy } from "@/screens/fight-camp/camp-ui";
import { useAppearanceActions, useAppearanceState } from "@/theme";
import { appearanceEqual, DEFAULT_APPEARANCE, NUMERIC_RANGES, type AppliedAppearance, type NumericSettingKey } from "@/theme/appearance/settings";
import { simplifyAppearance } from "@/theme/appearance/readability-policy";
import { buildColors, buildTypography } from "@/theme/appearance/tokens";
import { contentTextStyle } from "@/theme/typography";
import { TrackSlider } from "./controls";

const labels: Record<NumericSettingKey, string> = { fontScale: "Kích cỡ chữ", letterSpacing: "Khoảng cách ký tự", lineHeight: "Khoảng cách dòng" };

/** A single small editor shared by Fighter, Coach, Doctor and Admin. */
export function AppearanceScreen() {
  const { applied, systemScheme, osFontScale } = useAppearanceState();
  const { applyAppearance } = useAppearanceActions();
  const [draft, setDraft] = useState(() => simplifyAppearance(applied));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    if (dirtyRef.current) { event.preventDefault(); setError("Còn thay đổi chưa áp dụng. Áp dụng hoặc chọn Hủy thay đổi trước khi quay lại."); }
  }), [navigation]);
  const update = (patch: Partial<AppliedAppearance["settings"]>) => {
    setError(""); setDraft(d => simplifyAppearance({ ...d, settings: { ...d.settings, ...patch } }));
  };
  const save = async () => {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const saved = await applyAppearance(simplifyAppearance(draft));
      if (!mounted.current) return;
      if (saved) showAppToast("Đã lưu giao diện trên thiết bị này.", "success");
      else setError("Không lưu được giao diện. Thử áp dụng lại.");
    } catch { if (mounted.current) setError("Không lưu được giao diện. Thử áp dụng lại."); }
    finally { if (mounted.current) setSaving(false); }
  };
  const palette = buildColors(draft.settings, systemScheme).colors;
  const text = contentTextStyle("body", buildTypography(draft.settings, osFontScale, true));
  return <CampShell title="Giao diện" subtitle="Áp dụng cho mọi màn hình của tài khoản trên thiết bị này." onBack={() => router.back()}>
    <View pointerEvents={saving ? "none" : "auto"} style={{ gap: 22 }}>
      <Choices label="Chế độ màu" value={draft.settings.mode} onChange={mode => update({ mode })}
        options={[{ value: "light", label: "Sáng" }, { value: "dark", label: "Tối" }, { value: "system", label: "Hệ thống" }]}/>
      <Copy muted>{draft.settings.mode === "system" ? `Đang theo thiết bị: ${systemScheme === "dark" ? "Tối" : "Sáng"}.` : "Màu sắc và khung hiển thị dùng chung cho toàn app."}</Copy>
      {(["fontScale", "letterSpacing", "lineHeight"] as const).map(key => <TrackSlider key={key} label={labels[key]} value={draft.settings[key]}
        {...NUMERIC_RANGES[key]} onChange={value => update({ [key]: value })}
        formatValue={value => key === "lineHeight" ? `${value.toFixed(2)}×` : `${Math.round(value * 100)}%`}/>)}
      <View style={{ gap: 10 }}><Copy strong>Xem trước</Copy>
        <ArenaFrame><View style={{ padding: 14, gap: 12, backgroundColor: palette.bg }}>
          <Text style={[text, { color: palette.ink }]}>Hiệp sau: giữ khoảng cách, ra đòn rõ ràng và nghe chỉ dẫn của HLV.</Text>
          <Text style={[text, { color: palette.inkMuted }]}>Nguyễn Thành Long · Hạng 60 kg</Text>
        </View></ArenaFrame>
      </View>
      {error ? <View accessibilityRole="alert"><Copy>{error}</Copy></View> : null}
      <Action label="Áp dụng" pending={saving} disabled={!dirty} onPress={() => { void save(); }}/>
      {dirty ? <Action label="Hủy thay đổi" secondary disabled={saving} onPress={() => { setDraft(simplifyAppearance(applied)); setError(""); }}/>: null}
      <Action label="Khôi phục mặc định" secondary disabled={saving} onPress={() => { setDraft(DEFAULT_APPEARANCE); setError(""); }}/>
    </View>
  </CampShell>;
}
