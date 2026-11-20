import { useEffect, useState } from "react";
import { LiveRefreshControl, useLiveRefresh } from "@/components/live-refresh";
import { FadeInView } from "@/components/motion";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical } from "@/api";
import { campApi, type CampBout, type CampDetail } from "@/features/fight-camp/api";
import { getUnreadNotificationCount } from "@/api/notifications/notifications";
import type { TrainingSession } from "@/api/types";
import { videoAiApi } from "@/api/video/video-ai";
import { Icon } from "@/components/icon";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { addDays, dateKey, endOfDay, startOfDay } from "@/components/schedule/week-model";
import { fighterHome as t } from "@/i18n/fighter-home";
import { fighterHref } from "@/navigation/role-href";
import { FighterTabFrame } from "@/screens/fighter/tab-bar";
import { useSource, type Source } from "@/screens/coach/today/coach-today-screen";
import { countdown } from "@/screens/coach/today/today-model";
import { badgeText } from "@/screens/doctor/redesign/doctor-unread";
import { Action, Frame } from "@/shared/ui/camp-ui";
import { useFighterSuspensions } from "@/features/fight-camp/components/fighter-suspension";
import { listPlansForFighter, listSessionsForFighter } from "@/screens/fighter/api";
import { sessionTypeLabel } from "@/screens/fighter/format";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh, liveSheet } from "@/theme/typography";
import { healthLine, nearestBout, planLine, shortSession, upcoming, videoLine, weightLine } from "./fighter-home-model";

export const FIGHTER_HOME_WIDE_MIN = 744;
const CO_THE = "/(fighter)/co-the" as Href;
const GIAO_AN = "/(fighter)/giao-an" as Href;
const VIDEO = "/(fighter)/video" as Href;
const TAP = "/tap" as Href;

/**
 * Fighter home (redesign 2026-11-11): one adaptive spotlight (the bout while in a fight camp, otherwise today's next
 * session or a rest day), then three one-line rows: Sức khỏe, Giáo án hiện tại, Video / phản hồi AI. Mục tiêu is left
 * out until a goals API exists. Each source loads and fails on its own.
 */
export function FighterHomeV2() {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fighterId, profile, canFetch, isDemo } = useFighterId();
  const window = useWindowDimensions();
  const nav = useNavKind();
  const [measured, setMeasured] = useState(0);
  const wide = (measured || window.width - navSideWidth(nav)) >= FIGHTER_HOME_WIDE_MIN;
  const now = new Date();
  const today = dateKey(now);
  const key = `${canFetch}-${fighterId}`;

  const [bouts, reloadBouts, refreshBouts] = useSource<CampBout[]>(() => canFetch ? campApi.list({ limit: 20, order: "desc" }).then(p => p.data) : Promise.resolve([]), key);
  const bout = bouts.state === "ok" ? nearestBout(bouts.data) : null;
  const [detail, , refreshDetail] = useSource<CampDetail | null>(() => bout && canFetch ? campApi.detail(bout.id) : Promise.resolve(null), `${key}-${bout?.id ?? ""}`);
  const [sessions, reloadSessions, refreshSessions] = useSource<TrainingSession[]>(() => canFetch
    ? listSessionsForFighter({ page: 1, limit: 30, fromDate: startOfDay(today), toDate: endOfDay(addDays(today, 14)) }).then(p => p.data)
    : Promise.resolve([]), key);
  const susp = useFighterSuspensions(canFetch || isDemo);
  const [medical, reloadMedical, refreshMedical] = useSource(() => canFetch && fighterId ? getFighterMedical(fighterId) : Promise.resolve(null), key);
  const [plans, reloadPlans, refreshPlans] = useSource(() => canFetch && fighterId ? listPlansForFighter(fighterId, { page: 1, limit: 10 }).then(p => p.data) : Promise.resolve([]), key);
  const [jobs, reloadJobs, refreshJobs] = useSource(() => canFetch ? videoAiApi.listJobs() : Promise.resolve([]), key);

  const live$ = useLiveRefresh(() => Promise.all([refreshBouts(), refreshDetail(), refreshSessions(), susp.reload(), refreshMedical(), refreshPlans(), refreshJobs()]));

  const health = healthLine(susp.items, medical.state === "ok" && medical.data ? medical.data.eligibility.training?.eligible ?? null : null);
  const healthSrc: Source<unknown> = susp.items === null && !susp.error ? { state: "loading" } : susp.error && medical.state === "error" ? { state: "error", message: "" } : medical.state === "loading" ? { state: "loading" } : { state: "ok", data: null };
  const plan = plans.state === "ok" ? planLine(plans.data, today) : null;
  const video = jobs.state === "ok" ? videoLine(jobs.data, now) : { count: 0, line: null };

  const spotlight = <Frame tone="accent" pad={18}>
    {bouts.state === "loading" || ((sessions.state === "loading" || medical.state === "loading") && !bout) ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/>
      : bout ? <BoutSpot bout={bout} detail={detail.state === "ok" ? detail.data : null} today={today}
          onLog={() => router.push(fighterHref.boutWeighIn)} onOpen={() => router.push(fighterHref.bouts)}/>
      : medical.state === "ok" && medical.data?.eligibility.training?.eligible === false ? <BlockedSpot onOpen={() => router.push(CO_THE)}/>
      : <SessionSpot sessions={sessions.state === "ok" ? upcoming(sessions.data, now) : []} failed={sessions.state === "error" || bouts.state === "error"}
          doneToday={sessions.state === "ok" && sessions.data.some(s => s.status === "COMPLETED" && dateKey(s.scheduledAt) === today)}
          onRetry={() => { reloadBouts(); reloadSessions(); }} today={today}
          onOpen={id => router.push(`/tap/${id}` as Href)} onSchedule={() => router.push(TAP)}/>}
  </Frame>;

  const rows = <View>
    <FadeInView index={1}><Row testID="home-health" title={t.rows.health} src={healthSrc} reload={() => { void susp.reload(); reloadMedical(); }}
      lead={health ? (health.mark === "ok" ? "✓" : "!") : "–"} leadTone={health?.mark === "ok" ? "ok" : health ? "warn" : undefined}
      line={health?.line ?? ""} lineTone={health?.mark === "ok" ? "ok" : health ? "warn" : undefined} onPress={() => router.push(CO_THE)}/></FadeInView>
    <FadeInView index={2}><Row testID="home-plan" title={t.rows.plan} src={plans} reload={reloadPlans}
      lead={plan?.lead ?? "–"} line={plan?.line ?? t.noPlan} onPress={() => router.push(GIAO_AN)}/></FadeInView>
    <FadeInView index={3}><Row testID="home-video" title={t.rows.video} src={jobs} reload={reloadJobs}
      lead={String(video.count)} line={video.line ?? t.noVideo} onPress={() => router.push(VIDEO)}/></FadeInView>
  </View>;

  return <FighterTabFrame><View testID="fighter-home" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}/>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.hello(profile?.firstName ?? "")}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}><FighterBell enabled={canFetch}/></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<LiveRefreshControl refreshing={live$.refreshing} onRefresh={live$.onRefresh}/>} contentContainerStyle={{ paddingHorizontal: wide ? 28 : 22, paddingTop: 16, paddingBottom: 16 }}>
      {wide ? <View style={{ flexDirection: "row", gap: 26, alignItems: "flex-start" }}><FadeInView index={0} style={{ flex: 1 }}>{spotlight}</FadeInView><View style={{ flex: 1 }}>{rows}</View></View>
        : <View style={{ gap: 14 }}><FadeInView index={0}>{spotlight}</FadeInView>{rows}</View>}
    </ScrollView>
  </View></FighterTabFrame>;
}

function Kick({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ fontFamily: fonts.display, fontSize: fz(15), letterSpacing: 0.7, textTransform: "uppercase", color: c.inkMuted }}>{children}</Text>;
}
function Big({ value, label, a11y, tone }: { value: string; label: string; a11y?: string; tone?: string }) {
  const { colors: c } = useThemePreference();
  return <View accessible={!!a11y} accessibilityLabel={a11y} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, marginBottom: 4 }}>
    <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(68), lineHeight: lh(68), color: tone ?? c.ink }}>{value}</Text>
    <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{label}</Text>
  </View>;
}

function BoutSpot({ bout: b, detail, today, onLog, onOpen }: { bout: CampBout; detail: CampDetail | null; today: string; onLog: () => void; onOpen: () => void }) {
  const { colors: c } = useThemePreference();
  const cd = countdown(b);
  const limit = b.catchweightKg ?? b.weightLimitKg;
  const w = detail ? weightLine(detail.weight.latestKg, detail.weight.latestOn, limit, today) : null;
  const loggedToday = detail?.weight.latestOn === today;
  const canLog = b.status !== "WEIGHED_IN" && !loggedToday;
  return <View testID="home-bout" style={{ gap: 2 }}>
    <Kick>{t.boutKick}</Kick>
    <Text numberOfLines={1} style={{ ...readableTextStyle(16.5, true), color: c.ink, marginTop: 4 }}><Text style={{ ...readableTextStyle(16.5), color: c.inkMuted }}>{t.vs}</Text> {b.opponentName || t.opponentTbd}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>{b.eventName}</Text>
    {cd.days === 0 ? <Big value={t.today} label={t.todayIs[cd.what]} a11y={t.daysA11y(0, cd.what)}/> : <Big value={String(cd.days)} label={t.daysTo[cd.what]} a11y={t.daysA11y(cd.days, cd.what)}/>}
    {w ? <Fact label={w.label} value={w.value} danger={w.danger}/> : null}
    <Fact label={t.limit} value={`${limit.toFixed(1).replace(".", ",")} kg`}/>
    <View style={{ marginTop: 12 }}>{canLog ? <Action label={t.logWeight} onPress={onLog}/> : <Action label={t.openBout} onPress={onOpen}/>}</View>
  </View>;
}

/** The doctor has not cleared training: the card leads with that, not with the rest day or the next session. */
function BlockedSpot({ onOpen }: { onOpen: () => void }) {
  const { colors: c } = useThemePreference();
  return <View testID="home-blocked" style={{ gap: 2 }}>
    <Kick>{t.restKick}</Kick>
    <Big value="!" label={t.blockedSub} tone={c.danger} a11y={t.blockedA11y}/>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.danger, marginTop: 6 }}>{t.blockedLine}</Text>
    <View style={{ marginTop: 12 }}><Action label={t.openReason} onPress={onOpen}/></View>
  </View>;
}

function SessionSpot({ sessions, failed, doneToday, onRetry, today, onOpen, onSchedule }: { sessions: TrainingSession[]; failed: boolean; doneToday?: boolean; onRetry: () => void; today: string; onOpen: (id: string) => void; onSchedule: () => void }) {
  const { colors: c } = useThemePreference();
  if (failed) return <RetryLine onRetry={onRetry}/>;
  const first = sessions[0];
  const isToday = first && dateKey(first.scheduledAt) === today;
  if (isToday) {
    const next = sessions[1];
    const time = new Date(Date.parse(first.scheduledAt) + 7 * 3_600_000).toISOString().slice(11, 16);
    const meta = [sessionTypeLabel(first.sessionType), first.plannedDurationSec ? t.minutes(Math.round(first.plannedDurationSec / 60)) : null].filter(Boolean).join(" · ");
    return <View testID="home-session" style={{ gap: 2 }}>
      <Kick>{t.sessionKick}</Kick>
      <Big value={time} label={t.todayWord}/>
      <Text numberOfLines={1} style={{ ...readableTextStyle(16.5, true), color: c.ink }}>{first.title}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>{meta}</Text>
      <View style={{ marginTop: 12 }}><Action label={t.openSession} onPress={() => onOpen(first.id)}/></View>
      {next ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, true), color: c.ink, marginTop: 10 }}>{t.after} <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>· {shortSession(next, sessionTypeLabel)}</Text></Text> : null}
    </View>;
  }
  return <View testID={doneToday ? "home-done" : "home-rest"} style={{ gap: 2 }}>
    <Kick>{t.restKick}</Kick>
    {doneToday ? <Big value={t.done} label={t.doneSub} tone={c.success}/> : <Big value={t.rest} label={t.restSub}/>}
    <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, true), color: c.ink, marginTop: 6 }}>{first ? <>{t.nextSession} <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted }}>· {shortSession(first, sessionTypeLabel)}</Text></> : t.noUpcoming}</Text>
    <View style={{ marginTop: 12 }}><Action label={t.openSchedule} onPress={onSchedule}/></View>
  </View>;
}

function Fact({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9, borderTopColor: c.line, borderTopWidth: 1 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: danger ? c.danger : c.ink, flexShrink: 1 }}>{value}</Text>
  </View>;
}

function Row({ testID, title, src, reload, lead, leadTone, line, lineTone, onPress }: {
  testID: string; title: string; src: Source<unknown>; reload: () => void; lead: string; leadTone?: "ok" | "warn"; line: string; lineTone?: "ok" | "warn"; onPress: () => void;
}) {
  const { colors: c } = useThemePreference();
  const tone = (x?: "ok" | "warn") => (x === "ok" ? c.success : x === "warn" ? c.danger : undefined);
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1 };
  const ok = src.state === "ok";
  const body = <>
    <Text numberOfLines={1} style={{ width: 52, fontFamily: fonts.displayExtraBold, fontSize: fz(32), lineHeight: lh(36), color: ok ? tone(leadTone) ?? (lead === "0" ? c.inkSubtle : c.ink) : c.inkSubtle }}>{ok ? lead : "–"}</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      {src.state === "loading" ? <ActivityIndicator size="small" color={c.inkSubtle} style={{ alignSelf: "flex-start" }}/> : null}
      {src.state === "error" ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.danger }}>{t.loadFailed}</Text> : null}
      {ok ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, !!lineTone), color: tone(lineTone) ?? c.ink }}>{line}</Text> : null}
    </View>
  </>;
  if (src.state === "error") return <View testID={testID} style={row}>{body}<RetryLink onPress={reload}/></View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t.openRow(title)} onPress={onPress} style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
    {body}<Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

function RetryLink({ onPress }: { onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: "center", flexShrink: 0, paddingLeft: 8 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.lotus }}>{t.retry}</Text>
  </Pressable>;
}
function RetryLine({ onRetry }: { onRetry: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.danger, flex: 1 }}>{t.loadFailed}</Text><RetryLink onPress={onRetry}/>
  </View>;
}

/** Fighter bell (redesign 2026-11-11): unread count on load; badge up to "99+", hidden at 0. */
function FighterBell({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const p = useFighterPalette();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    getUnreadNotificationCount().then(r => { if (alive) setCount(Math.max(0, Number(r.count) || 0)); }, () => undefined);
    return () => { alive = false; };
  }, [enabled]);
  const badge = badgeText(count);
  return <Pressable testID="fighter-bell" accessibilityRole="button" accessibilityLabel={t.bell(count)} onPress={() => router.push(fighterHref.notifications)} style={({ pressed }) => [styles.bell, { opacity: pressed ? 0.7 : 1 }]}>
    <Icon name="notifications" size={24} color={p.ink}/>
    {badge ? <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[styles.badge, { backgroundColor: p.accent, borderColor: p.surface }]}>
      <Text style={[styles.badgeText, { color: p.onAccent }]} maxFontSizeMultiplier={1.2}>{badge}</Text>
    </View> : null}
  </Pressable>;
}
const styles = liveSheet(() => ({
  bell: { width: 48, height: 48, margin: -2, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, left: 24, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  badgeText: { fontSize: fz(11), fontWeight: "700", lineHeight: lh(14) },
}));
