import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import type { CampDetail } from "@/api/fight-camp";
import { roleMayReadMeasurements } from "@/api/role-contracts";
import { fighterTran as t } from "@/i18n/fighter-tran";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { isToday, kg, statusLabel } from "@/screens/fight-camp/camp-rules";
import { Action, CampShell } from "@/screens/fight-camp/camp-ui";
import { StaggerList } from "@/components/motion";
import { dmLocal } from "@/screens/fighter/health/health-model";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { gateView, GUIDE, limitOf, loadTran, overBy, paperLine, paperOk, paperParts, suspensionRow, SUSPENSIONS, weighedLine, weightWord, WEIGH, when, type Tone, type TranData } from "./bout-model";
import { WeightChart } from "./weight-chart";

type Tab = "bout" | "papers";

/**
 * Fighter Trận (redesign step 12): the bout on the page (Trang chủ owns the framed countdown), the weight and its
 * chart with the one action, then tabs Trận đấu · Hồ sơ thi đấu, then rows Đình chỉ and Cách giảm cân an toàn.
 */
export function FighterBoutV2() {
  const router = useRouter();
  const { user, isDemo } = useSession();
  const profileId = (user?.profile as { id?: string } | null | undefined)?.id;
  const canRead = roleMayReadMeasurements(user?.role);
  const [src, reload, refresh] = useSource<TranData>(() => loadTran(profileId, !!isDemo, canRead), `${profileId}-${isDemo}-${canRead}`);
  const first = useRef(true);
  // Back from Ghi cân: refetch quietly so the new weight shows.
  useFocusEffect(useCallback(() => { if (first.current) { first.current = false; return; } void refresh(); }, [refresh]));
  const { colors: c } = useThemePreference();
  const d = src.state === "ok" ? src.data : null;

  return <CampShell title={t.title} onBack={() => router.canGoBack() ? router.back() : router.replace("/")} preview={!!isDemo} onRefresh={refresh}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.failed} retry={t.retry} onRetry={reload}/> : null}
    {d ? <StaggerList testID="fighter-bout-v2" gap={14}>
      {/* BoutBody / NoBout / More return fragments: keep the 14 gap inside each staggered block. */}
      <View style={{ gap: 14 }}>{d.bout ? <BoutBody d={d} bout={d.bout}/> : <NoBout d={d}/>}</View>
      <View style={{ gap: 14 }}><More d={d}/></View>
    </StaggerList> : null}
  </CampShell>;
}

function toneColor(c: ReturnType<typeof useThemePreference>["colors"], tone: Tone) {
  return tone === "ok" ? c.success : tone === "warn" ? c.danger : tone === "lim" ? c.lotus : c.inkSubtle;
}

/** Big kg, the weight word, and when it was weighed. */
function WeightLine({ value, word, tone, line }: { value: number | null; word: string; tone: Tone; line: string }) {
  const { colors: c } = useThemePreference();
  return <View testID="bout-weight" accessible accessibilityLabel={t.weighA11y(kg(value), word, line)}
    style={{ flexDirection: "row", alignItems: "flex-end", gap: 12, paddingTop: 12, borderTopColor: c.line, borderTopWidth: 1 }}>
    <View style={{ flexDirection: "row", alignItems: "baseline" }}>
      <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(56), lineHeight: lh(56), color: value == null ? c.inkSubtle : c.ink }}>{value == null ? "–" : kg(value)}</Text>
      {value != null ? <Text style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(26), color: c.ink, marginLeft: 3 }}>{t.kg}</Text> : null}
    </View>
    <View style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.5, textTransform: "uppercase", color: toneColor(c, tone) }}>{word}</Text>
      {line ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{line}</Text> : null}
    </View>
  </View>;
}

function RedLines({ lines, testID }: { lines: string[]; testID?: string }) {
  const { colors: c } = useThemePreference();
  return <View testID={testID} accessibilityRole="alert" style={{ paddingBottom: 4 }}>
    {lines.map((l, k) => <Text key={k} style={{ ...readableTextStyle(15, k === 0), color: c.danger }}>{l}</Text>)}
  </View>;
}

function BoutBody({ d, bout }: { d: TranData; bout: CampDetail }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [tab, setTab] = useState<Tab>("bout");
  const track = d.track;
  const logged = isToday(track?.latestOn);
  const w = track ? weightWord(track) : null;
  const over = track ? overBy(track) : null;
  const gate = gateView(bout);
  const opponent = bout.opponentName ? t.vs(bout.opponentName, dmLocal(bout.boutAt)) : t.noOpponent(dmLocal(bout.boutAt));

  return <>
    <View testID="bout-head" accessible accessibilityRole="header" accessibilityLabel={`${statusLabel[bout.status]}. ${bout.eventName}. ${opponent}`}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(15), lineHeight: lh(21), letterSpacing: 0.9, textTransform: "uppercase", color: c.lotus }}>{statusLabel[bout.status]}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(41), textTransform: "uppercase", color: c.ink }}>{bout.eventName}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(15), color: c.ink }}>{opponent}</Text>
    </View>
    {track && w ? <>
      <WeightLine value={track.latestKg} word={w.word} tone={w.tone} line={weighedLine(track.latestOn)}/>
      {over ? <RedLines testID="bout-over" lines={[t.overBy(over), t.tellCoach]}/> : null}
      <WeightChart points={track.points} path={track.referencePath} limit={track.limitKg} over={!!over}/>
    </> : null}
    <Action label={logged ? t.edit : t.log} secondary={logged} onPress={() => router.push(WEIGH)}/>
    <CampTabs alertLabel={t.tabAlert} value={tab} onChange={setTab} tabs={[
      { key: "bout", label: t.tabs.bout },
      { key: "papers", label: gate.count ? t.tabs.papersCount(gate.count) : t.tabs.papers, alert: gate.count > 0 },
    ]}/>
    {tab === "bout" ? <View testID="bout-facts">
      <Fact label={t.facts.weighIn} value={when(bout.weighInAt)}/>
      <Fact label={t.facts.bout} value={when(bout.boutAt)}/>
      <Fact label={t.facts.venue} value={bout.venue || t.facts.unknown}/>
      <Fact label={t.facts.limit} value={`${kg(limitOf(bout))} ${t.kg}`} last/>
    </View> : <View testID="bout-papers">
      {gate.lines.length ? <RedLines lines={gate.lines}/> : null}
      {bout.requirements.length ? bout.requirements.map((r, k) => {
        const ok = paperOk(r.status) && !gate.blocking.has(r.code);
        const line = paperLine(r);
        const { word, rest } = paperParts(r);
        return <SlipRow key={r.code} testID={`paper-${r.code}`} lead={ok ? "✓" : "!"} leadTone={ok ? "ok" : "warn"} title={r.label} word={word} wordTone={ok ? undefined : "warn"} line={rest}
          a11y={`${r.label}. ${line}`} last={k === bout.requirements.length - 1}/>;
      }) : <Text style={{ ...readableTextStyle(15, true), color: c.ink, paddingVertical: 12 }}>{t.papersNone}</Text>}
    </View>}
  </>;
}

function NoBout({ d }: { d: TranData }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const logged = isToday(d.latest?.on);
  return <>
    <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(41), textTransform: "uppercase", color: c.ink }}>{t.noBout}</Text>
    {d.latest ? <WeightLine value={d.latest.kg} word={t.weight.latest} tone="dim" line={logged ? t.today : dmLocal(d.latest.on)}/> : null}
    <Action label={logged ? t.edit : t.log} secondary={logged} onPress={() => router.push(WEIGH)}/>
  </>;
}

function More({ d }: { d: TranData }) {
  const router = useRouter();
  const s = suspensionRow(d.suspensions);
  return <View>
    <SlipRow testID="bout-suspensions" icon="clearance" title={t.rows.suspensions} {...(s.warn ? { word: s.line, wordTone: "warn" as const } : { line: s.line })} a11y={`${t.rows.suspensions}. ${s.line}`} onPress={() => router.push(SUSPENSIONS)}/>
    <SlipRow testID="bout-guide" icon="exercise" title={t.rows.guide} a11y={t.rows.guide} onPress={() => router.push(GUIDE)} last/>
  </View>;
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}
