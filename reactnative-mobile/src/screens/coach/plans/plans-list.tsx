import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import { coachApi } from "@/api/coach";
import { TRAINING_PLAN_STATUSES, type TrainingPlan, type TrainingPlanStatus } from "@/api/types";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { coachPlans as t } from "@/i18n/coach-plans";
import { Action } from "@/shared/ui/camp-ui";
import { RoHeaderAction } from "@/screens/coach/readonly/ro-ui";
import { planPct } from "@/screens/coach/readonly/ro-format";
import { useCoachEnabled, useFighterNames } from "@/screens/coach/readonly/use-coach";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { FilterChips } from "@/screens/coach/fighters/fighters-list";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { planPhaseWord } from "@/training/plan-phase";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";
import { coachPlanHref, planLead, statusWord } from "./plan-model";

const ORDER: TrainingPlanStatus[] = ["ACTIVE", "DRAFT", "COMPLETED", "CANCELLED"];
type Progress = TrainingPlan["progress"];

/**
 * `GET /training-plans` sends no progress, so active rows fetch their plan (which does) four at a time.
 * Results are kept per plan id and `updatedAt`; a failed fetch leaves the row on "–".
 */
function useListProgress(items: readonly TrainingPlan[]) {
  const [got, setGot] = useState<Record<string, Progress>>({});
  const asked = useRef(new Set<string>());
  const done = useRef(new Set<string>());
  useEffect(() => {
    const todo = items.filter(p => p.status === "ACTIVE" && !p.progress && !asked.current.has(`${p.id}|${p.updatedAt}`));
    if (!todo.length) return;
    let live = true;
    for (const p of todo) asked.current.add(`${p.id}|${p.updatedAt}`);
    void (async () => {
      for (let i = 0; i < todo.length && live; i += 4) {
        const part = todo.slice(i, i + 4);
        const batch = await Promise.all(part.map(p => coachApi.getPlan(p.id).then(full => [p.id, full.progress] as const, () => null)));
        if (!live) return;
        for (const p of part) done.current.add(`${p.id}|${p.updatedAt}`);
        setGot(prev => { const next = { ...prev }; for (const r of batch) if (r?.[1]) next[r[0]] = r[1]; return next; });
      }
    })();
    return () => { live = false; for (const p of todo) if (!done.current.has(`${p.id}|${p.updatedAt}`)) asked.current.delete(`${p.id}|${p.updatedAt}`); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
  return got;
}

/**
 * Giáo án (redesign step 17): the lit "Tạo giáo án" button first, status chips that apply on tap, then one row per plan:
 * progress %, title, status word · fighter · phase. Only Hoàn thành and Đã hủy are coloured.
 */
export function CoachPlansListScreen() {
  const enabled = useCoachEnabled();
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const bell = useContext(RoHeaderAction);
  const names = useFighterNames(enabled);
  const [status, setStatus] = useState<TrainingPlanStatus | "">("");
  const list = usePagedList(enabled, `cp|${status}`, page => coachApi.listPlans({ page, limit: 20, status: status || undefined }));
  const progress = useListProgress(list.items);
  const chips = useMemo(() => [{ value: "" as const, label: t.all }, ...ORDER.filter(s => (TRAINING_PLAN_STATUSES as readonly string[]).includes(s)).map(s => ({ value: s, label: t.status[s] }))], []);

  const firstLoad = !list.loaded || (list.loading && list.items.length === 0 && !list.error);
  const empty = list.loaded && !list.loading && !list.error && list.items.length === 0;

  return <RolePage testID="coach-plans" title={t.title} right={bell} onRefresh={list.refresh}>
    <Action label={t.create} onPress={() => router.push("/(coach)/plans/new" as never)}/>
    <FilterChips testID="plan-status" label={t.statusGroup} options={chips} value={status} onChange={setStatus}/>

    {list.error ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={() => void list.reload()}/> : null}
    {firstLoad && !list.error ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {empty ? <EmptyLine testID="plans-empty" title={status ? t.emptyFiltered : t.empty} line={status ? undefined : t.emptyLine}/> : null}

    {list.items.length ? <StaggerList testID="plans-list">
      {list.items.map((row, k) => {
        const p = !row.progress && progress[row.id] ? { ...row, progress: progress[row.id] } : row;
        const lead = planLead(p);
        const w = statusWord(p.status);
        const line = [names[p.fighterId], planPhaseWord(p.phase)].filter(Boolean).join(" · ");
        return <SlipRow key={p.id} testID={`plan-row-${p.id}`} lead={lead.lead} leadSub={lead.sub} leadTone={lead.tone} title={p.title}
          word={w.word} wordTone={w.tone} line={line} a11y={t.rowA11y(p.title, `${w.word}, ${line}`, planPct(p))}
          last={k === list.items.length - 1} onPress={() => router.push(coachPlanHref(p.id))}/>;
      })}
    </StaggerList> : null}
    {list.hasNext ? <Pressable accessibilityRole="button" onPress={list.loadMore} disabled={list.loadingMore} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
      {list.loadingMore ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.more}</Text>}
    </Pressable> : null}
  </RolePage>;
}
