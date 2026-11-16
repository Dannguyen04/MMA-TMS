import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { getExercise, updateTrainingPlan } from "@/api";
import { coachApi } from "@/api/coach";
import type { PlanStatusValue } from "@/api/one-tap.types";
import type { PlanMilestone, TrainingPlan, TrainingPlanExercise } from "@/api/types";
import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { dateKey } from "@/components/schedule/week-model";
import { coachPlans as t } from "@/i18n/coach-plans";
import { fighterName, planPct } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { sentences } from "@/screens/fight-camp/camp-ui";
import { dm, dose, planWeek } from "@/screens/fighter/plans/plans-model";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { usePlanActions } from "@/screens/one-tap/status-actions";
import { MoreMenu } from "@/screens/one-tap/video-actions";
import { planPhaseWord } from "@/training/plan-phase";
import { coachNewSessionHref } from "@/screens/coach/schedule/session-model";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { coachPlanSubHref, statusWord, toggledMilestones, toVnDate } from "./plan-model";

type TabKey = "exercises" | "goals" | "info";
const MAX_WEEK_TICKS = 16;
const UNDO_MS = 5000;

async function loadPlan(id: string) {
  const plan = await coachApi.getPlan(id);
  const fighter = await coachApi.getFighter(plan.fighterId).catch(() => null);
  return { plan, fighter: fighter ? fighterName(fighter) : "" };
}

/**
 * Giáo án (redesign step 17): the one plan page for the coach. It replaced the read-only `chi-tiet` and the edit
 * page `[id]`. Top: title, status word · fighter · phase, three numbers and the week ticks. Tabs Bài tập · Mục tiêu ·
 * Thông tin as on the fighter's plan page. A milestone toggles on tap and saves at once (undo for 5 s); editing,
 * the exercise rows and adding exercises open their own pages. "⋯" changes the status (one-tap sheets).
 */
export function CoachPlanPage() {
  const router = useRouter();
  const lotus = useThemePreference().colors.lotus;
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const planId = typeof id === "string" ? id : "";
  const [tab, setTab] = useState<TabKey>(tabParam === "goals" || tabParam === "info" ? tabParam : "exercises");
  const [src, reload, refresh] = useSource(() => planId ? loadPlan(planId) : Promise.resolve(null), `plan|${planId}`);
  const [rows, reloadRows, refreshRows] = useSource(() => planId ? coachApi.listPlanExercises(planId) : Promise.resolve([] as TrainingPlanExercise[]), `rows|${planId}`);
  const [override, setOverride] = useState<Partial<TrainingPlan> | null>(null);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/plans" as never));

  // Coming back from the form, milestones or an exercise page shows what was saved there.
  const seen = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!seen.current) { seen.current = true; return; }
    setOverride(null); void refresh(); void refreshRows();
  }, [refresh, refreshRows]));

  const loaded = src.state === "ok" ? src.data : null;
  const plan = loaded ? { ...loaded.plan, ...override } as TrainingPlan : null;
  const actions = usePlanActions({
    planId,
    status: (plan?.status ?? "DRAFT") as PlanStatusValue,
    onChanged: status => setOverride(o => ({ ...o, status })),
    onReload: () => { setOverride(null); reload(); },
  });
  const pull = () => Promise.all([refresh(), refreshRows()]).then(() => setOverride(null));

  const notFound = !planId || (src.state === "ok" && !loaded);
  return <RolePage testID="coach-plan-page" title={t.page} onBack={back} onRefresh={planId ? pull : undefined}
    right={plan ? <MoreMenu items={actions.more}/> : undefined}>
    {src.state === "loading" && planId ? <ActivityIndicator color={lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {notFound ? <EmptyLine title={t.notFound} line={t.notFoundLine}/> : null}
    {plan && loaded ? <>
      <Top plan={plan} fighter={loaded.fighter}/>
      <CampTabs tabs={[{ key: "exercises", label: t.tabs.exercises }, { key: "goals", label: t.tabs.goals }, { key: "info", label: t.tabs.info }]}
        value={tab} onChange={setTab} alertLabel=""/>
      {tab === "exercises" ? <Exercises planId={plan.id} rows={rows} onRetry={reloadRows}/> : null}
      {tab === "goals" ? <Goals plan={plan} onMilestones={m => setOverride(o => ({ ...o, milestones: m }))}/> : null}
      {tab === "info" ? <Info plan={plan} fighter={loaded.fighter}/> : null}
    </> : null}
    {actions.sheets}
  </RolePage>;
}

function Top({ plan, fighter }: { plan: TrainingPlan; fighter: string }) {
  const { colors: c } = useThemePreference();
  const w = statusWord(plan.status);
  const week = planWeek(plan, dateKey(new Date()));
  const pr = plan.progress;
  const rest = [fighter, planPhaseWord(plan.phase)].filter(Boolean).join(" · ");
  const stats: [string, string, string][] = [
    [String(planPct(plan)), "%", t.progress],
    [pr ? String(pr.completedSessions) : "–", pr ? `/${pr.totalSessions}` : "", t.sessions],
    [week ? String(week.now) : "–", week ? `/${week.total}` : "", t.weeks],
  ];
  return <View style={{ gap: 12 }}>
    <View style={{ gap: 3 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{plan.title}</Text>
      <Text testID="plan-line" numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: w.tone === "ok" ? c.success : w.tone === "warn" ? c.danger : c.ink }}>{w.word}</Text>{rest ? ` · ${rest}` : ""}
      </Text>
    </View>
    <View testID="plan-stats" style={{ flexDirection: "row", borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      {stats.map(([v, u, l], k) => <View key={l} accessible accessibilityLabel={`${l}: ${v}${u}`} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, ...(k ? { borderLeftColor: c.line, borderLeftWidth: 1 } : null) }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), color: c.ink }}>{v}{u ? <Text style={{ fontSize: fz(14) }}>{u}</Text> : null}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink, marginTop: 2 }}>{l}</Text>
      </View>)}
    </View>
    {week && week.total <= MAX_WEEK_TICKS ? <View accessible={false} style={{ flexDirection: "row", gap: 4 }}>
      {Array.from({ length: week.total }, (_, k) => <View key={k} style={{ flex: 1, height: 6, backgroundColor: k + 1 < week.now ? c.inkMuted : k + 1 === week.now ? c.lotus : c.surfaceMuted }}/>)}
    </View> : null}
  </View>;
}

/** Exercise names come from the library page plus one-by-one lookups for the rest. */
function useExerciseNames(rows: readonly TrainingPlanExercise[] | null) {
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = rows ? [...new Set(rows.map(r => r.exerciseId))].sort().join(",") : "";
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    void coachApi.listExercises({ limit: 100 }).then(p => p.data, () => []).then(async lib => {
      const next: Record<string, string> = {};
      for (const e of lib) next[e.id] = e.name;
      const missing = ids.split(",").filter(x => !next[x]);
      const pairs = await Promise.all(missing.map(x => getExercise(x).then(e => [x, e.name] as const, () => null)));
      for (const p of pairs) if (p) next[p[0]] = p[1];
      if (alive) setNames(next);
    });
    return () => { alive = false; };
  }, [ids]);
  return names;
}

function AddRow({ label, onPress, testID, top = true }: { label: string; onPress: () => void; testID: string; top?: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomColor: c.line, borderBottomWidth: 1, ...(top ? { borderTopColor: c.line, borderTopWidth: 1 } : null), opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 40, alignItems: "center" }}><Icon name="add" size={24} color={c.lotus}/></View>
    <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.lotus }}>{label}</Text>
  </Pressable>;
}

function Exercises({ planId, rows, onRetry }: { planId: string; rows: ReturnType<typeof useSource<TrainingPlanExercise[]>>[0]; onRetry: () => void }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const ordered = rows.state === "ok" ? [...rows.data].sort((a, b) => a.orderIndex - b.orderIndex) : [];
  const names = useExerciseNames(rows.state === "ok" ? rows.data : null);
  const add = <AddRow testID="plan-add-exercise" label={t.addExercise} top={!ordered.length} onPress={() => router.push(coachPlanSubHref("them-bai-tap", { id: planId }))}/>;
  if (rows.state === "loading") return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/>;
  if (rows.state === "error") return <RetryRow message={t.partFailed} retry={t.retry} onRetry={onRetry}/>;
  if (!ordered.length) return <View style={{ gap: 12 }}><EmptyLine testID="plan-exercises-empty" title={t.noExercises}/>{add}</View>;
  return <View>
    <StaggerList testID="plan-exercises">
      {ordered.map((r, i) => {
        const name = names[r.exerciseId] ?? t.exerciseFallback;
        const d = dose(r);
        return <PressableScale key={r.id} testID={`plan-ex-${r.id}`} scaleTo={0.99} accessibilityRole="button"
          accessibilityLabel={[`${i + 1}. ${name}`, d, r.coachNotes ? t.coachNote(r.coachNotes) : null].filter(Boolean).join(". ")}
          onPress={() => router.push(coachPlanSubHref("bai-tap", { id: planId, row: r.id, name }))}
          style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1 }}>
          <Text style={{ width: 40, textAlign: "center", fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(32), color: c.inkSubtle }}>{i + 1}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{name}</Text>
            {d ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{d}</Text> : null}
            {r.coachNotes ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{t.coachNote(r.coachNotes)}</Text> : null}
          </View>
          <Icon name="chevron" size={18} color={c.inkSubtle}/>
        </PressableScale>;
      })}
    </StaggerList>
    <View style={{ borderTopColor: c.line, borderTopWidth: 1 }}>{add}</View>
  </View>;
}

function Prose({ text }: { text: string }) {
  const { colors: c } = useThemePreference();
  // Owner 2026-11-11: one sentence per line.
  return <View style={{ gap: 6 }}>{sentences(text).map((line, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{line}</Text>)}</View>;
}

function SectionHead({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(22), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink, marginTop: 6 }}>{children}</Text>;
}

/** Goals, then milestones that toggle on tap and save at once; the undo line stays for 5 s. */
function Goals({ plan, onMilestones }: { plan: TrainingPlan; onMilestones: (m: PlanMilestone[]) => void }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<{ text: string; prev: PlanMilestone[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const save = (next: PlanMilestone[], prev: PlanMilestone[], text: string | null) => {
    setBusy(true); setFailed(false); onMilestones(next);
    if (timer.current) clearTimeout(timer.current);
    updateTrainingPlan(plan.id, { milestones: next }).then(saved => {
      onMilestones(saved.milestones ?? next);
      if (text) { setUndo({ text, prev }); timer.current = setTimeout(() => setUndo(null), UNDO_MS); } else setUndo(null);
    }, () => { onMilestones(prev); setUndo(null); setFailed(true); }).finally(() => setBusy(false));
  };
  const toggle = (i: number) => {
    if (busy) return;
    const prev = plan.milestones;
    save(toggledMilestones(prev, i, new Date().toISOString()), prev, prev[i]?.isCompleted ? t.markedOpen : t.markedDone);
  };

  return <View style={{ gap: 10 }}>
    {plan.goals ? <Prose text={plan.goals}/> : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noGoals}</Text>}
    <SectionHead>{t.milestones}</SectionHead>
    <View testID="plan-milestones">
      {plan.milestones.map((m, i) => <Pressable key={m.id ?? i} testID={`milestone-${i}`} accessibilityRole="checkbox" accessibilityState={{ checked: !!m.isCompleted, busy }}
        aria-checked={!!m.isCompleted} accessibilityLabel={t.milestoneA11y(m.title, !!m.isCompleted)} disabled={busy} onPress={() => toggle(i)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 6, borderTopColor: c.line, borderTopWidth: 1, opacity: pressed ? 0.75 : 1 })}>
        <View style={{ width: 40, alignItems: "center" }}><Icon name={m.isCompleted ? "check" : "circle"} size={24} color={m.isCompleted ? c.success : c.inkSubtle}/></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{m.title}</Text>
          {m.isCompleted && m.completedAt ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5, true), color: c.success }}>{t.milestoneDone(dm(m.completedAt))}</Text> : null}
        </View>
      </Pressable>)}
      <AddRow testID="plan-add-milestone" label={t.addMilestone} onPress={() => router.push(coachPlanSubHref("cot-moc", { id: plan.id, add: "1" }))}/>
      {plan.milestones.length ? <AddRowPlain testID="plan-edit-milestones" label={t.editMilestones} onPress={() => router.push(coachPlanSubHref("cot-moc", { id: plan.id }))}/> : null}
    </View>
    {failed ? <Text testID="milestone-failed" style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{t.markFailed}</Text> : null}
    {undo ? <View testID="milestone-undo" accessibilityLiveRegion="polite" style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 48, paddingLeft: 14, paddingRight: 4, backgroundColor: c.ink }}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.bg, flexShrink: 1 }}>{undo.text}</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => save(undo.prev, plan.milestones, null)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.undo}</Text>
      </Pressable>
    </View> : null}
  </View>;
}

function AddRowPlain({ label, onPress, testID }: { label: string; onPress: () => void; testID: string }) {
  const { colors: c } = useThemePreference();
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 40, alignItems: "center" }}><Icon name="edit" size={22} color={c.ink}/></View>
    <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink, flex: 1 }}>{label}</Text>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </Pressable>;
}

function FactRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{value}</Text>
  </View>;
}

function Info({ plan, fighter }: { plan: TrainingPlan; fighter: string }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 14 }}>
    <View testID="plan-facts">
      {fighter ? <FactRow label={t.fighter} value={fighter}/> : null}
      <FactRow label={t.phase} value={planPhaseWord(plan.phase)}/>
      <FactRow label={t.start} value={toVnDate(plan.startDate)}/>
      <FactRow label={t.end} value={plan.endDate ? toVnDate(plan.endDate) : t.noEnd} last/>
    </View>
    {plan.description ? <Prose text={plan.description}/> : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.noNotes}</Text>}
    <StaggerList>
      <SlipRow testID="plan-edit" icon="edit" title={t.edit} line={t.editLine} a11y={t.edit} onPress={() => router.push(coachPlanSubHref("sua", { id: plan.id }))}/>
      <SlipRow testID="plan-new-session" icon="add" title={t.newSession} line={t.newSessionLine} a11y={t.newSession} last
        onPress={() => router.push(coachNewSessionHref({ fighterId: plan.fighterId, planId: plan.id }))}/>
    </StaggerList>
  </View>;
}
