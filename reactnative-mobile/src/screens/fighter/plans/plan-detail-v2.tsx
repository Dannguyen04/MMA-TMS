import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import type { TrainingPlan, TrainingPlanExercise } from "@/api/types";
import { Icon } from "@/components/icon";
import { PressableScale, StaggerList } from "@/components/motion/motion";
import { Swap } from "@/components/motion/motion-kit";
import { dateKey } from "@/components/schedule/week-model";
import { fighterPlans as t } from "@/i18n/fighter/fighter-plans";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/shared/ui/camp-lit";
import { CampShell, sentences } from "@/shared/ui/camp-ui";
import { getExercise, getTrainingPlan, listTrainingPlanExercises } from "@/screens/fighter/shared/api";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useFighterId } from "@/screens/fighter/shared/use-fighter-id";
import { planPhaseWord } from "@/training/plan-phase";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { dm, dose, planWeek } from "./plans-model";

type Tab = "exercises" | "goals" | "notes";

/**
 * Plan detail (redesign step 9): the plan name and phase stay on top with tabs Bài tập · Mục tiêu · Ghi chú, like the
 * bout screens. Exercises are numbered one-line rows with the dose; the coach's note sits on its own line.
 */
export function FighterPlanDetailV2() {
  const { colors: c } = useThemePreference();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = typeof id === "string" ? id : "";
  const { canFetch } = useFighterId();
  const [tab, setTab] = useState<Tab>("exercises");
  const [plan, reloadPlan] = useSource<TrainingPlan | null>(() => canFetch && planId ? getTrainingPlan(planId) : Promise.resolve(null), `${canFetch}-${planId}`);
  const [rows, reloadRows] = useSource<TrainingPlanExercise[]>(() => canFetch && planId ? listTrainingPlanExercises(planId) : Promise.resolve([]), `${canFetch}-${planId}`);
  const names = useExerciseNames(rows.state === "ok" ? rows.data : null);

  const p = plan.state === "ok" ? plan.data : null;
  const week = p ? planWeek(p, dateKey(new Date())) : null;
  const meta = p ? [week ? t.detailWeek(week.now, week.total) : null, p.progress?.totalSessions ? t.detailSessions(p.progress.completedSessions, p.progress.totalSessions) : null].filter(Boolean).join(" · ") : "";

  const top = p ? <View style={{ gap: 4 }}>
    <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: fz(22), lineHeight: lh(30), letterSpacing: 0.4, textTransform: "uppercase", color: c.ink }}>{p.title}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.inkMuted }}><Text style={{ ...readableTextStyle(14, true), color: c.ink }}>{planPhaseWord(p.phase)}</Text>{meta ? ` · ${meta}` : ""}</Text>
    <View style={{ marginTop: 6, marginHorizontal: -22 }}><CampTabs alertLabel={t.tabAlert} value={tab} onChange={setTab} tabs={[
      { key: "exercises", label: t.tabs.exercises }, { key: "goals", label: t.tabs.goals }, { key: "notes", label: t.tabs.notes },
    ]}/></View>
  </View> : undefined;

  const ordered = rows.state === "ok" ? [...rows.data].sort((a, b) => a.orderIndex - b.orderIndex) : [];
  const exercises = rows.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/>
    : rows.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reloadRows}/>
    : ordered.length ? <StaggerList>{ordered.map((r, i) => <ExerciseRow key={r.id} index={i + 1} row={r} name={names[r.exerciseId] ?? t.exerciseFallback}
        last={i === ordered.length - 1} onPress={() => router.push(`/giao-an/bai-tap/${r.exerciseId}` as Href)}/>)}</StaggerList>
    : <Plain>{t.noExercises}</Plain>;
  const goals = p ? <View style={{ gap: 4 }}>
    {p.goals ? <Prose>{p.goals}</Prose> : !p.milestones.length ? <Plain>{t.noGoals}</Plain> : null}
    {p.milestones.length ? <>
      <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), letterSpacing: 0.6, textTransform: "uppercase", color: c.ink, marginTop: p.goals ? 14 : 0, marginBottom: 2 }}>{t.milestones}</Text>
      {p.milestones.map((m, i) => <View key={m.id ?? i} accessible accessibilityLabel={t.milestoneA11y(m.title, !!m.isCompleted)}
        style={{ flexDirection: "row", gap: 10, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1 }}>
        <View style={{ width: 22, paddingTop: 2 }}><Icon name={m.isCompleted ? "check" : "circle"} size={18} color={m.isCompleted ? c.success : c.inkSubtle}/></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...readableTextStyle(15), color: c.ink }}>{m.title}</Text>
          {m.isCompleted && m.completedAt ? <Text style={{ ...readableTextStyle(13), color: c.inkMuted }}>{t.milestoneDone(dm(m.completedAt))}</Text> : null}
        </View>
      </View>)}
    </> : null}
  </View> : null;
  const notes = p ? p.description ? <Prose>{p.description}</Prose> : <Plain>{t.noNotes}</Plain> : null;

  return <CampShell title={t.detailTitle} top={top}>
    {plan.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {plan.state === "error" ? <RetryRow message={t.failed} retry={t.retry} onRetry={reloadPlan}/> : null}
    {plan.state === "ok" && !p ? <Plain>{t.notFound}</Plain> : null}
    {p ? <Swap swapKey={tab} testID={`plan-tab-${tab}`}>{tab === "exercises" ? exercises : tab === "goals" ? goals : notes}</Swap> : null}
  </CampShell>;
}

/** Exercise names come one by one (the plan rows carry only ids); a failed name keeps the fallback. */
function useExerciseNames(rows: readonly TrainingPlanExercise[] | null) {
  const [names, setNames] = useState<Record<string, string>>({});
  const ids = rows ? [...new Set(rows.map(r => r.exerciseId))].join(",") : "";
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    void Promise.all(ids.split(",").map(x => getExercise(x).then(e => [x, e.name] as const, () => null))).then(pairs => {
      if (!alive) return;
      const next: Record<string, string> = {};
      for (const pair of pairs) if (pair) next[pair[0]] = pair[1];
      setNames(next);
    });
    return () => { alive = false; };
  }, [ids]);
  return names;
}

function ExerciseRow({ index, row, name, last, onPress }: { index: number; row: TrainingPlanExercise; name: string; last: boolean; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  const d = dose(row);
  return <PressableScale testID={`plan-ex-${row.id}`} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={[`${index}. ${name}`, d, row.coachNotes ? t.coachNote(row.coachNotes) : null].filter(Boolean).join(". ")} onPress={onPress}
    style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text style={{ width: 34, fontFamily: fonts.displayExtraBold, fontSize: fz(28), lineHeight: lh(32), color: c.inkSubtle }}>{index}</Text>
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{name}</Text>
      {d ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{d}</Text> : null}
      {row.coachNotes ? <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{t.coachNote(row.coachNotes)}</Text> : null}
    </View>
    <Icon name="chevron" size={18} color={c.inkSubtle}/>
  </PressableScale>;
}

function Prose({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  // Owner 2026-11-11: one sentence per line.
  return <View style={{ gap: 6 }}>{sentences(children).map((line, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(23), color: c.ink }}>{line}</Text>)}</View>;
}
function Plain({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(15, true), color: c.ink, paddingVertical: 12 }}>{children}</Text>;
}
