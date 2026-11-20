import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listFighterMedicalHistory } from "@/api/medical";
import type { MedicalHistoryEntry } from "@/api/types";
import { describeSnapshot } from "@/components/medical/medical-format";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { fighterHealth as t } from "@/i18n/fighter-health";
import { CampShell } from "@/shared/ui/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { backToHealth, byMonth, historyRow } from "./health-model";

const PAGE = 30;

/**
 * Health history (redesign step 10): every record by month, newest first, the day as the big lead. An injury opens
 * its page; any other record opens its facts in a sheet. No filters (owner 2026-11-11).
 */
export function FighterHealthHistoryV2() {
  const { colors: c } = useThemePreference();
  const router = useRouter();
  const { fighterId, canFetch } = useFighterId();
  const [rows, setRows] = useState<MedicalHistoryEntry[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error" | "more">("loading");
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [open, setOpen] = useState<MedicalHistoryEntry | null>(null);
  const seq = useRef(0);

  const load = useCallback(async (n: number) => {
    if (!canFetch || !fighterId) { setRows([]); setHasNext(false); setState("ok"); return; }
    const id = ++seq.current;
    setState(n === 1 ? "loading" : "more"); setMoreFailed(false);
    try {
      const r = await listFighterMedicalHistory(fighterId, { page: n, limit: PAGE });
      if (id !== seq.current) return;
      setRows(cur => n === 1 ? r.data : [...cur, ...r.data]); setHasNext(r.hasNextPage); setPage(n); setState("ok");
    } catch {
      if (id !== seq.current) return;
      if (n === 1) setState("error"); else { setMoreFailed(true); setState("ok"); }
    }
  }, [canFetch, fighterId]);
  useEffect(() => { void load(1); return () => { seq.current++; }; }, [load]);

  const groups = byMonth(rows, new Date().getFullYear());
  const view = open ? describeSnapshot(open) : null;

  return <CampShell title={t.history.title} onBack={() => backToHealth(router)}>
    {state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {state === "error" ? <RetryRow message={t.history.failed} retry={t.retry} onRetry={() => void load(1)}/> : null}
    {state !== "loading" && state !== "error" && !rows.length ? <Text testID="history-none" style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{t.history.none}</Text> : null}
    {groups.map(g => <View key={g.key} testID={`history-${g.key}`}>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginTop: 6, marginBottom: 2 }}>{g.label}</Text>
      {g.items.map((e, k) => {
        const r = historyRow(e);
        const press = e.recordType === "INJURY" ? () => router.push(`/suc-khoe/chan-thuong/${e.recordId}` as Href) : () => setOpen(e);
        return <SlipRow key={`${e.recordId}:${e.revision}`} testID={`history-row-${e.recordId}-${e.revision}`} lead={r.day} leadTone={r.tone}
          title={r.title} line={r.line} a11y={`${r.day}. ${r.title}. ${r.line}`} onPress={press} last={k === g.items.length - 1}/>;
      })}
    </View>)}
    {moreFailed ? <RetryRow message={t.history.failed} retry={t.retry} onRetry={() => void load(page + 1)}/> : null}
    {state === "more" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 16 }}/> : null}
    {state === "ok" && hasNext && !moreFailed ? <Pressable accessibilityRole="button" onPress={() => void load(page + 1)} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ fontFamily: fonts.display, fontSize: fz(16), letterSpacing: 0.3, color: c.lotus }}>{t.history.more}</Text>
    </Pressable> : null}
    <SlideSheet visible={!!open} onClose={() => setOpen(null)} title={view?.title ?? ""}>
      <View testID="history-sheet" style={{ paddingBottom: 8 }}>
        {view?.lines.map(l => <View key={l.label} style={{ paddingVertical: 9, borderTopColor: c.line, borderTopWidth: 1, gap: 2 }}>
          <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>{l.label}</Text>
          <Text style={{ ...readableTextStyle(15, true), color: c.ink }}>{l.value}</Text>
        </View>)}
      </View>
    </SlideSheet>
  </CampShell>;
}
