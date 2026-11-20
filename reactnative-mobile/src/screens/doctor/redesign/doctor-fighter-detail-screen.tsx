import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor/doctor-ro";
import type { MedicalDossier, PublicFighter } from "@/api/types";
import { Icon } from "@/components/icon";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { doctorRest as r } from "@/i18n/doctor/doctor-rest";
import { doctorRo } from "@/i18n/doctor/doctor-ro";
import { ot } from "@/i18n/common/one-tap";
import { fighterLine, statusMark } from "@/screens/coach/fighters/fighter-model";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { CampTabs } from "@/shared/ui/camp-lit";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/shared/use-load";
import { AiTab, useFighterAi } from "@/screens/doctor/detail/ai-tab";
import { detailError, headerFacts } from "@/screens/doctor/detail/detail-format";
import { ExamsTab, HistoryTab, OverviewTab } from "@/screens/doctor/detail/doctor-detail-tabs";
import { useEndAssignment, useOptionalSession } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { useDoctorRoster } from "./doctor-roster";

const t = doctorRo.detail2;
type TabKey = "overview" | "exams" | "history" | "ai";
const TABS: readonly TabKey[] = ["overview", "exams", "history", "ai"];

/** Name, two lines (weight · gym; age · height · reach · stance · country), then the medical status as a mark and a word. */
function Top({ f, dossier }: { f: PublicFighter; dossier: MedicalDossier | null }) {
  const { colors: c } = useThemePreference();
  const facts = headerFacts(f);
  const second = [facts.line.replace(/ /g, " "), facts.nationality].filter(Boolean).join(" · ");
  const m = statusMark(f.currentMedicalStatus);
  const markColor = m.tone === "ok" ? c.success : m.tone === "warn" ? c.danger : m.tone === "dim" ? c.inkSubtle : c.ink;
  const wordColor = m.wordTone === "ok" ? c.success : m.wordTone === "warn" ? c.danger : c.ink;
  const injuries = dossier?.activeInjuries.length ?? 0;
  const reviews = dossier?.openReviewRequests.length ?? 0;
  const line = injuries ? r.injuriesLine(injuries) : reviews ? r.reviewsLine(reviews) : "";
  return <View style={{ gap: 12 }}>
    <View style={{ gap: 2 }}>
      <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(41), textTransform: "uppercase", color: c.ink }}>{fighterName(f)}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{fighterLine(f)}</Text>
      {second ? <Text numberOfLines={2} style={{ ...readableTextStyle(14), color: c.ink }}>{second}</Text> : null}
    </View>
    <View testID="doctor-fighter-status" accessible accessibilityLabel={line ? `${m.word}. ${line}` : m.word} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      {m.icon ? <View style={{ width: 40, alignItems: "center" }}><Icon name={m.icon} size={28} color={markColor}/></View>
        : <Text style={{ width: 40, textAlign: "center", fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(34), color: markColor }}>{m.lead ?? "–"}</Text>}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.5, textTransform: "uppercase", color: wordColor }}>{m.word}</Text>
        {line ? <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{line}</Text> : null}
      </View>
    </View>
  </View>;
}

/**
 * Doctor fighter page (redesign step 21): the coach page's top (name, two lines, status row), tabs Tổng quan · Khám ·
 * Hồ sơ · AI (open requests counted on Khám). The fighter comes from the roster (the doctor cannot GET /fighters/:id).
 * "⋯" keeps Kết thúc phụ trách for the doctor's own current assignment.
 */
export function DoctorFighterDetailScreen() {
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const fighterId = typeof id === "string" ? id : "";
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const roster = useDoctorRoster();
  const [tab, setTab] = useState<TabKey>(TABS.includes(tabParam as TabKey) ? (tabParam as TabKey) : "overview");
  const binds = useRef<Record<string, (() => Promise<unknown>) | null>>({});
  const bind = useCallback((key: string, fn: (() => Promise<unknown>) | null) => {
    binds.current[key] = fn;
  }, []);

  const loadDossier = useCallback(() => doctorRoApi.getDossier(fighterId), [fighterId]);
  const f = roster.items.find((row) => row.id === fighterId) ?? null;
  const enabled = roster.enabled && !!f;
  const dossier = useLoad(enabled, `dossier:${fighterId}`, loadDossier, { keepOnError: true });
  const waiting = !f && (!roster.loaded || roster.loading) && !roster.error;
  const missing = !f && !waiting && !roster.error;
  const openCount = dossier.data?.openReviewRequests.length ?? 0;
  const ai = useFighterAi(fighterId, enabled);
  const aiCount = ai.groups.reduce((n, g) => n + g.items.length, 0);

  const session = useOptionalSession();
  const loadAssign = useCallback(() => doctorRoApi.listDoctors(fighterId, { page: 1, limit: 50 }), [fighterId]);
  const assigns = useLoad(enabled, `own-assign:${fighterId}`, loadAssign, { keepOnError: true });
  const own = ownAssignment(assigns.data?.data ?? [], session.profileId, session.isDemo);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(doctor)/vo-si" as never));
  const end = useEndAssignment({ kind: "doctor", fighterId, own: true, onDone: () => back() });

  const refresh = useCallback(async () => {
    await Promise.all([roster.refresh(), dossier.refresh(), ai.data.refresh(), tab === "overview" || tab === "ai" ? null : binds.current[tab]?.()]);
  }, [roster, dossier, ai.data, tab]);

  return <RolePage testID="doctor-fighter-page" title={r.pageTitle} onBack={back} onRefresh={refresh}
    right={own ? <MoreMenu items={[{ key: "end", label: ot.endOwn, icon: "ban", danger: true, onPress: () => end.open(own.id, "") }]}/> : undefined}>
    {waiting ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {roster.error && !f ? <RetryRow message={detailError(roster.error)} retry={r.retry} onRetry={() => void roster.reload()}/> : null}
    {missing ? <View style={{ gap: 10 }}>
      <EmptyLine testID="doctor-fighter-missing" title={r.notFound} line={r.notFoundLine}/>
      <Pressable accessibilityRole="button" onPress={back} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{r.back}</Text>
      </Pressable>
    </View> : null}
    {f ? <>
      <Top f={f} dossier={dossier.data}/>
      <CampTabs alertLabel="" value={tab} onChange={(k) => setTab(k as TabKey)} tabs={[
        { key: "overview", label: t.tabs.overview },
        { key: "exams", label: t.tabs.exams, count: openCount || undefined, a11y: openCount ? t.tabBadge(t.tabs.exams, openCount) : undefined },
        { key: "history", label: t.tabs.history },
        { key: "ai", label: r.aiTab, count: aiCount || undefined, a11y: aiCount ? t.tabBadge(r.aiTab, aiCount) : undefined },
      ]}/>
      {tab === "overview" ? <OverviewTab fighterId={f.id} dossier={dossier} enabled={enabled} ai={ai} onSeeAllAi={() => setTab("ai")}/> : null}
      {tab === "exams" ? <ExamsTab fighterId={f.id} enabled={enabled} bind={bind}/> : null}
      {tab === "history" ? <HistoryTab fighterId={f.id} enabled={enabled} bind={bind}/> : null}
      {tab === "ai" ? <AiTab fighterId={f.id} enabled={enabled} bind={bind} ai={ai}/> : null}
    </> : null}
    {end.sheet}
  </RolePage>;
}

/** The doctor's own current assignment (demo: the first current one). */
export function ownAssignment<T extends { doctorId: string; endsAt: string | null }>(rows: readonly T[], me: string | null, demo: boolean): T | null {
  const current = rows.filter((x) => x.endsAt == null);
  return current.find((x) => x.doctorId === me) ?? (demo ? current[0] ?? null : null);
}
