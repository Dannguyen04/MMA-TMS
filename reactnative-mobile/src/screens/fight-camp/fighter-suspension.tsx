import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { campApi, type Suspension } from "@/api/fight-camp";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { Copy, CampIcon, Frame, Notice } from "./camp-ui";
import { previewSuspensionCases } from "./camp-preview";
import { allowedTodayLine, allowedTypes, gradedSteps, intensityTiers, sessionNames, strictestSuspension, suspensionHeadline, suspensionReasonLabel, tierTypesText } from "./camp-rules";
import { campText } from "@/i18n/fight-camp";

/** Safety stop for paging (50 per page): the list is per fighter, so this is far above real use. */
const MAX_PAGES = 20;
/** 1A: no `active` filter (T-049 J1); read every page and select on the device. */
export async function loadAllSuspensions(fighterId?: string): Promise<Suspension[]> {
  const out: Suspension[] = []; let cursor: string | undefined;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await campApi.suspensions({ cursor, fighterId });
    out.push(...page.data);
    if (!page.hasNextPage || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}
/** Read-only context: a failure gives `error`, never throws into the screen that hosts the card. */
export function useFighterSuspensions(enabled = true) {
  const { user, isDemo } = useSession();
  const [items, setItems] = useState<Suspension[] | null>(null); const [error, setError] = useState(false);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    const v = ++generation.current; setError(false);
    try { const list = isDemo ? previewSuspensionCases.active : await loadAllSuspensions(); if (v === generation.current) setItems(list); }
    catch { if (v === generation.current) { setItems(null); setError(true); } }
  }, [isDemo, user?.id]);
  useEffect(() => { if (enabled) void reload(); return () => { generation.current++; }; }, [reload, enabled]);
  return { items, error, reload };
}

/** Phase 5 B: a tier is ticked from the gate-truth list; a free list that blocks part of a tier names only what is open. */
function Ladder({ allowed }: { allowed: readonly string[] }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 6 }} testID="suspension-ladder">
    {intensityTiers.map(t => {
      const open = t.types.filter(x => allowed.includes(x)); const ok = open.length > 0; const part = ok && open.length < t.types.length;
      const text = part ? campText.fighterSuspension.motPhan(open.map(x => sessionNames[x]).join(", ")) : tierTypesText(t);
      return <View key={t.tier} accessible accessibilityLabel={campText.fighterSuspension.bac(t.tier, t.group, text, ok ? part ? campText.fighterSuspension.duocTapMotPhan : campText.fighterSuspension.duocTap : campText.fighterSuspension.chuaDuocTap)} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start", opacity: ok ? 1 : 0.62 }}>
        <View style={{ paddingTop: 1 }}><CampIcon name={ok ? "check" : "minus"} color={ok ? c.success : c.inkMuted} size={18}/></View>
        <Copy small strong={ok} muted={!ok}>{t.group} · {text}</Copy>
      </View>;
    })}
  </View>;
}
function Steps({ g }: { g: NonNullable<Suspension["gradedReturn"]> }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 6 }} testID="graded-steps">
    {gradedSteps(g).map((s, i) => <View key={i} accessible accessibilityLabel={`${s.date}: ${s.text}${s.current ? campText.fighterSuspension.homNay : ""}`} style={{ flexDirection: "row", gap: 10, paddingVertical: 6, paddingHorizontal: 10, borderLeftWidth: 3, borderLeftColor: s.current ? c.lotus : c.line, backgroundColor: s.current ? c.surface : undefined }}>
      <Copy small strong={s.current}>{s.date}</Copy><Copy small strong={s.current}>{s.text}{s.current ? campText.fighterSuspension.homNay2 : ""}</Copy>
    </View>)}
  </View>;
}

/** T-048 card (2C, 4A, 5B, 6B): the strictest suspension only, read only, one link to the full list. */
export function FighterSuspensionCard({ items, error, onRetry }: { items: Suspension[] | null; error: boolean; onRetry: () => void }) {
  const router = useRouter(); const { colors: c } = useThemePreference();
  if (error) return <Pressable accessibilityRole="button" accessibilityLabel={campText.fighterSuspension.chuaTaiDuocTrangThai} onPress={onRetry} style={{ minHeight: 44, justifyContent: "center" }}>
    <Copy small color={c.danger}>{campText.fighterSuspension.chuaTaiDuocTrangThai2}</Copy>
  </Pressable>;
  const pick = items ? strictestSuspension(items) : null;
  if (!pick) return null;
  const s = pick.main; const upcoming = s.status === "UPCOMING"; const allowed = allowedTodayLine(s);
  const link = <Pressable accessibilityRole="link" onPress={() => router.push("/(fighter)/tran/dinh-chi" as never)} style={{ minHeight: 44, justifyContent: "center" }}>
    <Copy strong color={c.lotus}>{campText.fighterSuspension.xemLichSuDinhChi}</Copy>
  </Pressable>;
  if (upcoming) return <View testID="suspension-card" style={{ gap: 2 }}>
    <Copy strong>{suspensionHeadline(s)} · {suspensionReasonLabel[s.reason] ?? UNKNOWN_VALUE}</Copy>
    {pick.others ? <Copy small muted>{campText.fighterSuspension.va}{pick.others} {campText.fighterSuspension.dinhChiKhac}</Copy> : null}
    {link}
  </View>;
  return <View testID="suspension-card"><Frame tone="danger" pad={16}>
    <Copy large strong color={c.danger}>{suspensionHeadline(s)}</Copy>
    <Copy muted>{campText.fighterSuspension.lyDo}{suspensionReasonLabel[s.reason] ?? UNKNOWN_VALUE}</Copy>
    {allowed ? <Copy strong>{allowed}</Copy> : null}
    <Ladder allowed={allowedTypes(s) ?? []}/>
    {s.gradedReturn ? <Steps g={s.gradedReturn}/> : null}
    {pick.others ? <Copy small muted>{campText.fighterSuspension.va2}{pick.others} {campText.fighterSuspension.dinhChiKhac2}</Copy> : null}
    {link}
  </Frame></View>;
}
