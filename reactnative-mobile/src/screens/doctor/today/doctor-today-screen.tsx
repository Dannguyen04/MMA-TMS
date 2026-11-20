import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { LiveRefreshControl, useLiveRefresh } from "@/components/live-refresh";
import { CountUp, LeavingRow } from "@/components/motion-kit";
import { hapticSuccess } from "@/components/motion";
import { FadeInView } from "@/components/motion";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { campApi, type Suspension } from "@/features/fight-camp/api";
import { doctorRoApi } from "@/api/doctor/doctor-ro";
import { scheduleApi, type DoctorScheduleItem } from "@/api/doctor/schedule";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/motion";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { dateKey } from "@/components/schedule/week-model";
import { doctorToday as t } from "@/i18n/doctor-today";
import { useSource, type Source } from "@/screens/coach/today/coach-today-screen";
import { useDoctorRoster } from "@/screens/doctor/redesign/doctor-roster";
import { Action, Frame } from "@/shared/ui/camp-ui";
import { campError } from "@/features/fight-camp/logic/camp-rules";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { doctorVideoHref } from "@/screens/doctor/redesign/doctor-paths";
import { DoctorBell } from "./doctor-bell";
import { aiRows, nameOf, pendingClearances, reviewRows, todayGroups, URGENT_WAIT, watchRows, type Pending, type Row, type TodayKind } from "./doctor-today-model";

export const DOCTOR_TODAY_WIDE_MIN = 744;
const FIGHTER = "/(doctor)/vo-si/chi-tiet";
type Sheet = { kind: "pending" } | { kind: "today"; which: TodayKind } | { kind: "ai" | "watch" | "review" } | { kind: "confirm"; pending: Pending } | null;

/**
 * Doctor "Hôm nay" (redesign 2026-11-11): one card that leads with clearances waiting for the doctor (quick confirm),
 * then today's follow-ups / expiries / weigh-ins as three tiles; under it AI alerts, fighters to watch and coach review
 * requests. Each source loads and fails on its own.
 */
export function DoctorTodayScreen() {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDemo } = useSession();
  const roster = useDoctorRoster();
  const window = useWindowDimensions();
  const nav = useNavKind();
  const [measured, setMeasured] = useState(0);
  const wide = (measured || window.width - navSideWidth(nav)) >= DOCTOR_TODAY_WIDE_MIN;
  const [sheet, setSheet] = useState<Sheet>(null);
  // Confirmed rows leave at once (optimistic) and the list keeps its last data while it reloads, so the row can slide
  // out and the count tick down instead of the card flashing a spinner.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState("");
  const today = dateKey(new Date());

  const names = useMemo(() => new Map(roster.items.map(f => [f.id, nameOf(f)])), [roster.items]);
  const [susp, reloadSusp, refreshSusp] = useSource<Suspension[]>(() => isDemo ? Promise.resolve([]) : campApi.suspensions().then(p => p.data), isDemo);
  const [sched, reloadSched, refreshSched] = useSource<DoctorScheduleItem[]>(() => isDemo ? Promise.resolve([]) : scheduleApi.doctor(today, today).then(r => r.items), `${isDemo}-${today}`);
  const [ai, reloadAi, refreshAi] = useSource(() => isDemo ? Promise.resolve([]) : doctorRoApi.listImpairments(), isDemo);
  const [reviews, reloadReviews, refreshReviews] = useSource(() => isDemo ? Promise.resolve({ items: [], truncated: false }) : scheduleApi.doctorReviews(), isDemo);

  const live$ = useLiveRefresh(() => Promise.all([refreshSusp(), refreshSched(), refreshAi(), refreshReviews(), Promise.resolve(roster.refresh?.()).catch(() => undefined)]));
  const lastSusp = useRef<Suspension[] | null>(null);
  if (susp.state === "ok") lastSusp.current = susp.data;
  const suspData = susp.state === "ok" ? susp.data : lastSusp.current;
  const pending = suspData ? pendingClearances(suspData, names, today).filter(p => !hidden.has(p.suspension.id)) : [];
  const groups = sched.state === "ok" ? todayGroups(sched.data, today) : { follow: [], expire: [], weigh: [] };
  const aiList = ai.state === "ok" ? aiRows(ai.data, names) : [];
  const watch = watchRows(roster.items);
  const watchSrc: Source<Row[]> = !roster.loaded && !roster.error ? { state: "loading" } : roster.error && !roster.items.length ? { state: "error", message: roster.error } : { state: "ok", data: watch };
  const reviewList = reviews.state === "ok" ? reviewRows(reviews.data.items) : [];

  const openFighter = (id: string) => { setSheet(null); router.push({ pathname: FIGHTER, params: { id } } as never); };
  const openRow = (r: Row) => { setSheet(null); if (r.jobId) router.push(doctorVideoHref(r.jobId) as never); else openFighter(r.fighterId); };

  const card = <Frame tone="accent" pad={18}>
    <View testID="pending-card" style={{ gap: 2 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(19), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{t.pendingTitle}</Text>
        {suspData ? <CountUp testID="pending-count" value={pending.length} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(32), color: c.ink }}/> : <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(32), color: c.ink }}>–</Text>}
      </View>
      {notice ? <Text accessibilityLiveRegion="polite" style={{ ...readableTextStyle(13.5, true), color: c.success, paddingVertical: 4 }}>{notice}</Text> : null}
      {susp.state === "loading" && !suspData ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 14 }}/> : null}
      {susp.state === "error" ? <RetryLine onRetry={reloadSusp}/> : null}
      {suspData && !pending.length ? <Text style={{ ...readableTextStyle(14, true), color: c.ink, paddingVertical: 10 }}>{t.nonePending}</Text> : null}
      {pending.slice(0, wide ? 3 : 2).map(p => <LeavingRow key={p.suspension.id}><PendingRow p={p} onConfirm={() => setSheet({ kind: "confirm", pending: p })}/></LeavingRow>)}
      {pending.length > (wide ? 3 : 2) ? <TextLink label={t.seeAll(pending.length)} onPress={() => setSheet({ kind: "pending" })}/> : null}
      <View style={{ borderTopColor: c.line, borderTopWidth: 1, marginTop: 10, paddingTop: 12, gap: 8 }}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(15), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink }}>{t.today}</Text>
        {sched.state === "error" ? <RetryLine onRetry={reloadSched}/> : <View testID="today-tiles" style={{ flexDirection: "row", gap: 6 }}>
          {(["follow", "expire", "weigh"] as const).map(k => <CountTile key={k} label={t.counts[k]} n={sched.state === "ok" ? groups[k].length : null} onPress={() => setSheet({ kind: "today", which: k })}/>)}
        </View>}
      </View>
    </View>
  </Frame>;

  const sections = <View>
    <FadeInView index={1}><SummaryRow testID="doctor-ai" title={t.sections.ai} src={ai} reload={reloadAi} count={aiList.length} zero={t.zero.ai} top={aiList[0]} onOpen={() => setSheet({ kind: "ai" })}/></FadeInView>
    <FadeInView index={2}><SummaryRow testID="doctor-watch" title={t.sections.watch} src={watchSrc} reload={roster.reload} count={watch.length} zero={t.zero.watch} top={watch[0]} onOpen={() => setSheet({ kind: "watch" })}/></FadeInView>
    <FadeInView index={3}><SummaryRow testID="doctor-review" title={t.sections.review} src={reviews} reload={reloadReviews} count={reviewList.length} zero={t.zero.review} top={reviewList[0]} onOpen={() => setSheet({ kind: "review" })}/></FadeInView>
  </View>;

  const listRow = (r: Row) => <ItemRow key={r.key} title={r.title} line={r.line} danger={r.danger} onPress={() => openRow(r)}/>;
  const sheetTitle = !sheet ? "" : sheet.kind === "confirm" ? t.confirmTitle : sheet.kind === "pending" ? t.pendingTitle : sheet.kind === "today" ? t.sheetToday[sheet.which] : t.sections[sheet.kind];
  const sheetBody = !sheet ? null
    : sheet.kind === "confirm" ? <ConfirmClearance p={sheet.pending} onCancel={() => setSheet(null)} onDone={(name) => { hapticSuccess(); setHidden(h => new Set(h).add(sheet.pending.suspension.id)); setSheet(null); setNotice(t.confirmed(name)); reloadSusp(); }}/>
    : sheet.kind === "pending" ? pending.map(p => <PendingRow key={p.suspension.id} p={p} onConfirm={() => setSheet({ kind: "confirm", pending: p })}/>)
    : sheet.kind === "today" ? (groups[sheet.which].length ? groups[sheet.which].map(x => <ItemRow key={`${x.kind}-${x.refId}`} title={x.fighterName} line={x.label ?? ""} onPress={() => openFighter(x.fighterId)}/>) : <Empty/>)
    : (sheet.kind === "ai" ? aiList : sheet.kind === "watch" ? watch : reviewList).map(listRow);

  return <View testID="doctor-today" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}/>
      <Text accessibilityRole="header" style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.title}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}><DoctorBell/></View>
    </View>
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<LiveRefreshControl refreshing={live$.refreshing} onRefresh={live$.onRefresh}/>} contentContainerStyle={{ paddingHorizontal: wide ? 28 : 22, paddingTop: 16, paddingBottom: 16 }}>
      {wide ? <View style={{ flexDirection: "row", gap: 26, alignItems: "flex-start" }}><FadeInView index={0} style={{ flex: 1 }}>{card}</FadeInView><View style={{ flex: 1 }}>{sections}</View></View>
        : <View style={{ gap: 14 }}><FadeInView index={0}>{card}</FadeInView>{sections}</View>}
    </ScrollView>
    <SlideSheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheetTitle}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>{sheetBody}</View>
    </SlideSheet>
  </View>;
}

/** Name + urgent wait tag on line 1, "KO · hết 08/11" on line 2; both one line (owner 2026-11-11). */
function PendingRow({ p, onConfirm }: { p: Pending; onConfirm: () => void }) {
  const { colors: c } = useThemePreference();
  return <View testID={`pending-${p.suspension.id}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Text numberOfLines={1} style={{ ...readableTextStyle(15.5, true), color: c.ink, flexShrink: 1 }}>{p.name}</Text>
        {p.wait >= URGENT_WAIT ? <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}><Text aria-hidden style={{ ...readableTextStyle(12.5, true), color: c.danger }}>!</Text><Text style={{ ...readableTextStyle(12.5, true), color: c.danger }}>{t.wait(p.wait)}</Text></View> : null}
      </View>
      <Text numberOfLines={1} style={{ ...readableTextStyle(13), color: c.inkMuted }}>{p.line}</Text>
    </View>
    <View style={{ width: 112 }}><Action label={t.confirm} onPress={onConfirm}/></View>
  </View>;
}

/** Number on top, label under; a tile with items is a lit, bordered button; 0 is dim and disabled (owner 2026-11-11). */
function CountTile({ label, n, onPress }: { label: string; n: number | null; onPress: () => void }) {
  const { colors: c, resolvedScheme } = useThemePreference() as ReturnType<typeof useThemePreference> & { resolvedScheme?: string };
  const [size, setSize] = useState({ w: 0, h: 0 });
  const on = !!n;
  const dark = resolvedScheme === "dark";
  // An SVG id must be a plain token: "tile-Tái khám" (a space) made url(#…) invalid and the tile fell back to black fill.
  const gid = `tile-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const { w, h } = size; const k = 8;
  const shape = (i: number) => `M${i} ${i}H${w - k - i * 0.4}L${w - i} ${k + i * 0.4}V${h - i}H${k + i * 0.4}L${i} ${h - k - i * 0.4}Z`;
  return <PressableScale scaleTo={0.97} disabled={!on} testID={`tile-${label}`} accessibilityRole="button" accessibilityLabel={t.countA11y(label, n ?? 0)} accessibilityState={{ disabled: !on }} onPress={onPress}
    onLayout={e => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    style={{ flex: 1, minWidth: 0, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6, paddingHorizontal: 4 }}>
    {w ? <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill} aria-hidden={true}>
      <Defs><LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={on ? (dark ? "#24242B" : "#FFFFFF") : c.surface}/><Stop offset="0.55" stopColor={c.surface}/><Stop offset="1" stopColor={on ? (dark ? "#121216" : "#ECECEF") : c.surface}/>
      </LinearGradient></Defs>
      {/* The edge is a stroked shape, so it follows the cut corners. */}
      <Path d={shape(0.5)} fill={`url(#${gid})`} stroke={on ? c.controlBorder : c.line} strokeWidth={1}/>
    </Svg> : null}
    {n === null ? <ActivityIndicator size="small" color={c.inkSubtle}/> : <CountUp value={n} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(28), color: on ? c.ink : c.inkSubtle }}/>}
    {/* Two lines: "Cân chính thức" does not fit a third of a phone width on one line. */}
    <Text numberOfLines={2} style={{ ...readableTextStyle(12.5, true), textAlign: "center", color: on ? c.ink : c.inkSubtle, opacity: on ? 1 : 0.7 }}>{label}</Text>
  </PressableScale>;
}

function SummaryRow({ testID, title, src, reload, count, zero, top, onOpen }: { testID: string; title: string; src: Source<unknown>; reload: () => void; count: number; zero: string; top?: Row; onOpen: () => void }) {
  const { colors: c } = useThemePreference();
  const ok = src.state === "ok";
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1 };
  const body = <>
    {ok ? <CountUp value={count} style={{ width: 48, fontFamily: fonts.displayExtraBold, fontSize: fz(38), lineHeight: lh(42), color: count ? c.ink : c.inkSubtle }}/> : <Text style={{ width: 48, fontFamily: fonts.displayExtraBold, fontSize: fz(38), lineHeight: lh(42), color: c.inkSubtle }}>–</Text>}
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      {src.state === "loading" ? <ActivityIndicator size="small" color={c.inkSubtle} style={{ alignSelf: "flex-start" }}/> : null}
      {src.state === "error" ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.danger }}>{t.loadFailed}</Text> : null}
      {ok ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, !!top?.danger), color: top?.danger ? c.danger : c.ink }}>{top ? `${top.title} · ${top.line}` : zero}</Text> : null}
    </View>
  </>;
  // "Thử lại" keeps its own column and never wraps (owner 2026-11-11).
  if (src.state === "error") return <View testID={testID} style={row}>{body}<TextLink label={t.retry} onPress={reload}/></View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t.openSheet(title, ok ? count : 0)} disabled={!ok} onPress={onOpen} style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
    {body}<Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

/** Quick confirm: a required note (3–500, backend rule) with tap-to-fill phrases; compacts while the keyboard is up. */
function ConfirmClearance({ p, onCancel, onDone }: { p: Pending; onCancel: () => void; onDone: (name: string) => void }) {
  const { colors: c } = useThemePreference();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const kb = useKeyboardUp();
  const ok = note.trim().length >= 3;
  const reason = t.reasonFull[p.suspension.reason] ?? p.suspension.reason;
  const ended = `${p.suspension.endsOn.slice(8, 10)}/${p.suspension.endsOn.slice(5, 7)}/${p.suspension.endsOn.slice(0, 4)}`;
  async function submit() {
    if (!ok || pending) return;
    setPending(true); setError("");
    try { await campApi.clear(p.suspension.id, note.trim()); onDone(p.name); }
    catch (e) { setError(campError(e)); } finally { setPending(false); }
  }
  const fact = (label: string, value: string) => <View key={label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 9, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    <Text style={{ ...readableTextStyle(14), color: c.inkMuted }}>{label}</Text><Text style={{ ...readableTextStyle(14, true), color: c.ink }}>{value}</Text></View>;
  return <View testID="confirm-clearance" style={{ gap: 10 }}>
    {kb ? <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink }}>{p.name} <Text style={{ ...readableTextStyle(14), color: c.inkMuted }}>· {p.line}</Text></Text>
      : <View>{fact(t.fighter, p.name)}{fact(t.suspension, reason)}{fact(t.endedOn, ended)}</View>}
    <Text style={{ ...readableTextStyle(14, true), color: c.ink }}>{t.noteLabel}</Text>
    <ScrollView horizontal={kb} scrollEnabled={kb} showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: "row", flexWrap: kb ? "nowrap" : "wrap", gap: 8 }}>
      {t.picks.map(x => <PressableScale key={x} scaleTo={0.97} accessibilityRole="button" onPress={() => setNote(x)} style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: c.controlBorder }}>
        <Text style={{ ...readableTextStyle(13.5, true), color: c.ink }}>{x}</Text>
      </PressableScale>)}
    </ScrollView>
    <TextInput testID="clearance-note" accessibilityLabel={t.noteLabel} value={note} onChangeText={setNote} maxLength={500} multiline placeholder={t.notePlaceholder} placeholderTextColor={c.inkSubtle} editable={!pending}
      style={{ ...readableTextStyle(15), color: c.ink, minHeight: kb ? 64 : 88, padding: 10, borderWidth: 1, borderColor: c.controlBorder, backgroundColor: c.bg, textAlignVertical: "top", ...(Platform.OS === "web" ? { outlineStyle: "none" } as object : {}) }}/>
    <Text style={{ ...readableTextStyle(12.5), color: c.inkMuted, textAlign: "right" }}>{t.noteCount(note.length)}</Text>
    {error ? <Text accessibilityRole="alert" style={{ ...readableTextStyle(13.5, true), color: c.danger }}>{`${t.confirmFailed}: ${error}`}</Text> : null}
    <Action label={t.confirmGo} disabled={!ok} pending={pending} onPress={() => void submit()}/>
    {kb ? null : <Action label={t.later} secondary onPress={onCancel}/>}
  </View>;
}

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const a = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setUp(true));
    const b = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setUp(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  return up;
}

function ItemRow({ title, line, danger, onPress }: { title: string; line: string; danger?: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={line ? `${title}, ${line}` : title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 8, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.ink }}>{title}</Text>
      {line ? <Text numberOfLines={1} style={{ ...readableTextStyle(13, !!danger), color: danger ? c.danger : c.inkMuted }}>{line}</Text> : null}
    </View>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}
function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", flexShrink: 0, opacity: pressed ? 0.7 : 1 })}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: c.lotus }}>{label}</Text>
  </Pressable>;
}
function RetryLine({ onRetry }: { onRetry: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.danger, flex: 1 }}>{t.loadFailed}</Text><TextLink label={t.retry} onPress={onRetry}/>
  </View>;
}
function Empty(): ReactNode {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(14, true), color: c.ink, paddingVertical: 12 }}>—</Text>;
}
