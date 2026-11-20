import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LiveRefreshControl, useLiveRefresh } from "@/components/live-refresh";
import { FadeInView } from "@/components/motion";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { coachTodayApi, TODO_PHASES, type CoachTodo, type ReadinessRow, type TodoItem } from "@/api/coach/coach-today";
import { campApi, type CampBout, type CampDetail, type CursorPage } from "@/features/fight-camp/api";
import { listFighters } from "@/api/fighters/fighters";
import { Icon } from "@/components/icon";
import { navSideWidth, useNavKind } from "@/components/nav-rail";
import { SlideSheet } from "@/components/ui/slide-sheet";
import { todayText as t } from "@/i18n/coach-today";
import { CoachBell } from "@/screens/coach/nav/coach-unread";
import { Action, Frame } from "@/shared/ui/camp-ui";
import { previewBout } from "@/features/fight-camp/state/camp-preview";
import { campError, dateLabel, statusLabel } from "@/features/fight-camp/logic/camp-rules";
import { useSession } from "@/session/session-context";
import { SlipRow } from "@/screens/fighter/redesign/tab-page";
import { fonts, useThemePreference } from "@/theme";
import { readableTextStyle, fz, lh } from "@/theme/typography";
import {
  attentionRows, countdown, liveBouts, paperworkFact, readyRows, shortDate, sortTodo, stageAction, todoText, URGENT, weightFact,
  type FighterLite, type PersonRow, type Stage,
} from "./today-model";

/** Two columns from the same width as Fight Camp (744 content width). */
export const TODAY_TWO_COLUMN_MIN = 744;
const BOUT_PATH = "/(coach)/fight-camp/bout";
const CAMP_LIST_PATH = "/(coach)/fight-camp";
const FIGHTER_PATH = "/(coach)/fighters/chi-tiet";

export type Source<T> = { state: "loading" } | { state: "error"; message: string } | { state: "ok"; data: T };
/** One source: loads on its own and fails on its own (row-level retry). */
export function useSource<T>(load: () => Promise<T>, key: unknown): [Source<T>, () => void, () => Promise<void>] {
  const [src, setSrc] = useState<Source<T>>({ state: "loading" });
  const seq = useRef(0);
  const run = useCallback(() => {
    const id = ++seq.current;
    setSrc({ state: "loading" });
    load().then(
      data => { if (id === seq.current) setSrc({ state: "ok", data }); },
      (e: unknown) => { if (id === seq.current) setSrc({ state: "error", message: campError(e) }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => { run(); return () => { seq.current++; }; }, [run]);
  /** Quiet refetch (focus, pull): keeps what is on screen; a failure leaves loaded data as it was. Never rejects. */
  const refresh = useCallback(() => {
    const id = ++seq.current;
    return load().then(
      data => { if (id === seq.current) setSrc({ state: "ok", data }); },
      (e: unknown) => { if (id === seq.current) setSrc(prev => prev.state === "ok" ? prev : { state: "error", message: campError(e) }); },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [src, run, refresh];
}

type Sheet = "todo" | "ready" | "attention" | null;

/** Coach "Hôm nay": the nearest live bout as the one spotlight, other bouts, then three one-row sections. */
export function CoachTodayScreen() {
  const { colors: c } = useThemePreference();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isDemo } = useSession();
  const window = useWindowDimensions();
  const nav = useNavKind();
  const [measured, setMeasured] = useState(0);
  const wide = (measured || window.width - navSideWidth(nav)) >= TODAY_TWO_COLUMN_MIN;
  const [sheet, setSheet] = useState<Sheet>(null);

  const [bouts, reloadBouts, refreshBouts] = useSource<CursorPage<CampBout>>(
    () => isDemo ? Promise.resolve({ data: [previewBout], hasNextPage: false, nextCursor: null }) : campApi.list({ limit: 20, order: "desc" }),
    isDemo,
  );
  const live = bouts.state === "ok" ? liveBouts(bouts.data.data) : [];
  const spot = live[0] ?? null;
  const [detail, , refreshDetail] = useSource<CampDetail | null>(
    () => !spot ? Promise.resolve(null) : isDemo ? Promise.resolve(structuredClone(previewBout)) : campApi.detail(spot.id),
    `${isDemo}-${spot?.id ?? ""}`,
  );
  const [todo, reloadTodo, refreshTodo] = useSource<CoachTodo>(() => isDemo ? Promise.resolve({ items: [], truncated: false }) : coachTodayApi.todo(), isDemo);
  const [readiness, reloadReadiness, refreshReadiness] = useSource<ReadinessRow[]>(() => isDemo ? Promise.resolve([]) : coachTodayApi.readiness(), isDemo);
  const [fighters, reloadFighters, refreshFighters] = useSource<FighterLite[]>(
    () => isDemo ? Promise.resolve([]) : listFighters({ page: 1, limit: 100 }).then(p => p.data.map(f => ({ id: f.id, name: `${f.firstName} ${f.lastName}`.trim(), medicalStatus: f.currentMedicalStatus }))),
    isDemo,
  );

  const live$ = useLiveRefresh(() => Promise.all([refreshBouts(), refreshDetail(), refreshTodo(), refreshReadiness(), refreshFighters()]));

  const names = new Map<string, string>();
  if (fighters.state === "ok") for (const f of fighters.data) names.set(f.id, f.name);
  if (readiness.state === "ok") for (const r of readiness.data) names.set(r.fighterId, r.fighterName);
  const nameOf = (id: string) => names.get(id) ?? t.fighterFallback;

  const openBout = (id: string, stage: Stage = "DETAIL") => {
    setSheet(null);
    const view = stage === "WEIGH" ? "weigh" : stage === "CORNER" ? "corner" : undefined;
    router.push({ pathname: BOUT_PATH, params: { id, preview: isDemo ? "1" : "0", ...(view ? { view } : {}) } } as never);
  };
  const openFighter = (id: string) => { setSheet(null); router.push({ pathname: FIGHTER_PATH, params: { id } } as never); };

  const todoItems = todo.state === "ok" ? sortTodo(todo.data.items) : [];
  const ready = readiness.state === "ok" ? readyRows(readiness.data, fighters.state === "ok" ? fighters.data : null) : [];
  const attention = attentionRows(readiness.state === "ok" ? readiness.data : null, fighters.state === "ok" ? fighters.data : null);
  const attentionSrc: Source<PersonRow[]> = readiness.state === "loading" || fighters.state === "loading" ? { state: "loading" }
    : readiness.state === "error" && fighters.state === "error" ? { state: "error", message: readiness.message }
    : { state: "ok", data: attention };

  const boutColumn = <View style={{ gap: 14 }}>
    {bouts.state === "loading" ? <Loading/> : null}
    {bouts.state === "error" ? <Frame tone="danger" pad={18}>
      <Body strong color={c.danger}>{t.boutsFailed}</Body>
      <Action label={t.retry} secondary onPress={reloadBouts}/>
    </Frame> : null}
    {bouts.state === "ok" && !spot ? <Frame pad={18}>
      <Body>{t.noBouts}</Body>
      <Action label={t.boutList} secondary onPress={() => router.push(CAMP_LIST_PATH as never)}/>
    </Frame> : null}
    {spot ? <Spotlight bout={spot} name={nameOf(spot.fighterId)} detail={detail.state === "ok" ? detail.data : null} onOpen={() => openBout(spot.id)} onStage={() => openBout(spot.id, stageAction(spot.status, countdown(spot).overdue))}/> : null}
    {live.length > 1 ? <View testID="today-other-bouts">
      {live.slice(1, 3).map((b, k, all) => <SlipRow key={b.id} testID={`today-bout-${b.id}`} icon="martialArts" title={b.eventName} line={`${statusLabel[b.status]} · ${shortDate(b.boutAt)}`}
        a11y={`${b.eventName}, ${statusLabel[b.status]}, ${dateLabel(b.boutAt)}`} last={k === all.length - 1} onPress={() => openBout(b.id)}/>)}
    </View> : null}
    {spot ? <TextLink label={bouts.state === "ok" && bouts.data.hasNextPage ? t.seeAllMore : t.seeAll(live.length)} onPress={() => router.push(CAMP_LIST_PATH as never)}/> : null}
  </View>;

  const topTodo = todoItems[0];
  const sections = <View>
    {wide ? null : <FadeInView index={1}><SummaryRow testID="today-todo" title={t.sections.todo} src={todo} reload={reloadTodo}
      count={todoItems.length} zero={t.zero.todo}
      line={topTodo ? `${todoText(topTodo)} · ${nameOf(topTodo.fighterId)}` : ""} urgent={!!topTodo && URGENT.has(topTodo.source)}
      onOpen={() => setSheet("todo")}/></FadeInView>}
    <FadeInView index={2}><SummaryRow testID="today-ready" title={t.sections.ready} src={readiness} reload={reloadReadiness}
      count={ready.length} zero={t.zero.ready} line={ready.map(r => r.name).join(", ")} onOpen={() => setSheet("ready")}/></FadeInView>
    <FadeInView index={3}><SummaryRow testID="today-attention" title={t.sections.attention} src={attentionSrc} reload={() => { reloadReadiness(); reloadFighters(); }}
      count={attention.length} zero={t.zero.attention}
      line={attention[0] ? `${attention[0].name} · ${(attention[0].why ?? "").toLowerCase()}` : ""} onOpen={() => setSheet("attention")}/></FadeInView>
  </View>;

  const todoList = (items: TodoItem[]) => <View>
    {TODO_PHASES.map(phase => {
      const rows = items.filter(i => i.phase === phase);
      if (!rows.length) return null;
      return <View key={phase}>
        <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(15), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, paddingTop: 14, paddingBottom: 4 }}>{t.phase[phase]}</Text>
        {rows.map(i => <ItemRow key={`${i.boutId}-${i.source}`} title={todoText(i)} sub={`${nameOf(i.fighterId)} · ${i.eventName}`} danger={URGENT.has(i.source)} onPress={() => openBout(i.boutId)}/>)}
      </View>;
    })}
    {todo.state === "ok" && todo.data.truncated ? <Body muted>{t.truncated}</Body> : null}
  </View>;

  return <View testID="coach-today" onLayout={e => setMeasured(Math.round(e.nativeEvent.layout.width))} style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
    <View style={{ minHeight: 54, flexDirection: "row", alignItems: "center", paddingHorizontal: 10, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <View style={{ width: 56 }}/>
      <Text accessibilityRole="header" numberOfLines={1} style={{ flex: 1, textAlign: "center", fontFamily: fonts.display, fontSize: fz(20), lineHeight: lh(27), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{t.title}</Text>
      <View style={{ width: 56, alignItems: "flex-end" }}><CoachBell/></View>
    </View>
    {/* Sized to fit one 412×915 phone screen without scrolling; the scroll view only catches very small windows or large text. */}
    <ScrollView showsVerticalScrollIndicator={false} refreshControl={<LiveRefreshControl refreshing={live$.refreshing} onRefresh={live$.onRefresh}/>} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 16, paddingBottom: 16 }}>
      {wide ? <View testID="today-columns" style={{ flexDirection: "row", gap: 26, alignItems: "flex-start", width: "100%", maxWidth: 1040, alignSelf: "center" }}>
        <FadeInView index={0} style={{ flex: 1, minWidth: 0 }}>{boutColumn}</FadeInView>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          {sections}
          <View testID="today-todo-full">
            <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(20), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, paddingTop: 12 }}>
              {`${t.sections.todo} · ${todo.state === "ok" ? todoItems.length : "–"}`}
            </Text>
            {todo.state === "loading" ? <Loading/> : null}
            {todo.state === "error" ? <RetryLine message={t.loadFailed} onRetry={reloadTodo}/> : null}
            {todo.state === "ok" ? todoItems.length ? todoList(todoItems) : <Body muted>{t.zero.todo}</Body> : null}
          </View>
        </View>
      </View> : <View style={{ gap: 14 }}><FadeInView index={0}>{boutColumn}</FadeInView>{sections}</View>}
    </ScrollView>
    <SlideSheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheet ? t.sections[sheet] : ""}>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        {sheet === "todo" ? todoItems.length ? todoList(todoItems) : <Body muted>{t.zero.todo}</Body> : null}
        {sheet === "ready" ? ready.length ? ready.map(r => <ItemRow key={r.fighterId} title={r.name} sub={r.why} onPress={() => openFighter(r.fighterId)}/>) : <Body muted>{t.zero.ready}</Body> : null}
        {sheet === "attention" ? attention.length ? attention.map(r => <ItemRow key={r.fighterId} title={r.name} sub={r.why} danger={r.tone === "danger"} onPress={() => openFighter(r.fighterId)}/>) : <Body muted>{t.zero.attention}</Body> : null}
      </View>
    </SlideSheet>
  </View>;
}

function Spotlight({ bout: b, name, detail, onOpen, onStage }: { bout: CampBout; name: string; detail: CampDetail | null; onOpen: () => void; onStage: () => void }) {
  const { colors: c } = useThemePreference();
  const cd = countdown(b);
  const facts = [weightFact(b, detail), paperworkFact(detail)].filter(f => f !== null);
  const stage = stageAction(b.status, cd.overdue);
  return <View testID="today-spotlight">
    <Frame tone="accent" pad={18}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${name} ${t.vs} ${b.opponentName || t.opponentTbd}, ${b.eventName}`} accessibilityHint={t.openBout} onPress={onOpen}>
        <Text style={{ ...readableTextStyle(17, true), color: c.ink }}>
          {name} <Text style={{ fontWeight: "400", color: c.inkMuted }}>{t.vs}</Text> {b.opponentName || t.opponentTbd}
        </Text>
        <Text style={{ ...readableTextStyle(13.5), color: c.inkMuted, marginTop: 2 }}>{b.eventName} · {statusLabel[b.status]}</Text>
      </Pressable>
      {/* Big numeral and its two-line label share one centre line. */}
      <View testID="today-countdown" accessible accessibilityLabel={cd.overdue ? t.overdueA11y(cd.days, cd.what) : t.daysA11y(cd.days, cd.what)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 2 }}>
        {cd.overdue ? <>
          <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(76), lineHeight: lh(72), color: c.danger }}>{cd.days}</Text>
          <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(24), lineHeight: lh(33), color: c.danger, textTransform: "uppercase" }}>{t.overdue[cd.what]}</Text>
        </> : cd.days === 0 ? <>
          <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(52), lineHeight: lh(71), color: c.ink, textTransform: "uppercase" }}>{t.today}</Text>
          <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(24), lineHeight: lh(33), color: c.ink, textTransform: "uppercase" }}>{t.todayIs[cd.what]}</Text>
        </> : <>
          <Text style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(76), lineHeight: lh(72), color: c.ink }}>{cd.days}</Text>
          <Text style={{ fontFamily: fonts.displaySemi, fontSize: fz(24), lineHeight: lh(33), color: c.ink, textTransform: "uppercase" }}>{t.daysTo[cd.what]}</Text>
        </>}
      </View>
      {facts.length ? <View style={{ marginTop: 8 }}>
        {facts.map(f => <View key={f.label} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10, borderTopColor: c.line, borderTopWidth: 1 }}>
          <Text style={{ ...readableTextStyle(14), color: c.inkMuted }}>{f.label}</Text>
          <Text style={{ ...readableTextStyle(14, true), color: f.tone === "danger" ? c.danger : f.tone === "success" ? c.success : c.ink, flexShrink: 1, textAlign: "right" }}>{f.value}</Text>
        </View>)}
      </View> : null}
      <View style={{ marginTop: 12 }}><Action label={t.action[stage]} onPress={onStage}/></View>
    </Frame>
  </View>;
}

function SummaryRow({ testID, title, src, reload, count, zero, line, urgent, onOpen }: {
  testID: string; title: string; src: Source<unknown>; reload: () => void; count: number; zero: string; line: string; urgent?: boolean; onOpen: () => void;
}) {
  const { colors: c } = useThemePreference();
  const ok = src.state === "ok";
  const body = <>
    <Text style={{ width: 52, fontFamily: fonts.displayExtraBold, fontSize: fz(38), lineHeight: lh(42), color: ok && count ? (urgent ? c.danger : c.ink) : c.inkSubtle }}>{ok ? count : "–"}</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.ink }}>{title}</Text>
      {src.state === "loading" ? <ActivityIndicator size="small" color={c.inkSubtle} style={{ alignSelf: "flex-start", marginTop: 2 }}/> : null}
      {src.state === "error" ? <Text style={{ ...readableTextStyle(13.5), color: c.danger }}>{t.loadFailed}</Text> : null}
      {ok ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{count ? line : zero}</Text> : null}
    </View>
  </>;
  const row = { flexDirection: "row" as const, alignItems: "center" as const, gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1 };
  if (src.state === "error") return <View testID={testID} style={row}>{body}<TextLink label={t.retry} onPress={reload}/></View>;
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={t.openSheet(title, ok ? count : 0)} disabled={!ok} onPress={onOpen} style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1 }]}>
    {body}
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

function ItemRow({ title, sub, danger, onPress }: { title: string; sub: string | null; danger?: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={sub ? `${title}, ${sub}` : title} onPress={onPress} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingVertical: 8, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text style={{ ...readableTextStyle(14, true), color: danger ? c.danger : c.ink }}>{title}</Text>
      {sub ? <Text numberOfLines={1} style={{ ...readableTextStyle(13), color: c.ink }}>{sub}</Text> : null}
    </View>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
    <Text style={{ ...readableTextStyle(14, true), color: c.lotus }}>{label}</Text>
  </Pressable>;
}

function RetryLine({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
    <Text style={{ ...readableTextStyle(13.5), color: c.danger, flex: 1 }}>{message}</Text>
    <TextLink label={t.retry} onPress={onRetry}/>
  </View>;
}

function Body({ children, muted, strong, color }: { children: ReactNode; muted?: boolean; strong?: boolean; color?: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(14, strong), color: color ?? (muted ? c.inkMuted : c.ink) }}>{children}</Text>;
}

function Loading() {
  const { colors: c } = useThemePreference();
  return <View style={{ paddingVertical: 32 }}><ActivityIndicator color={c.lotus}/></View>;
}
