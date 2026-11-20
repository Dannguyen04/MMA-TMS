import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { addTrainingPlanExercise, createTrainingPlan, listExercises, removeTrainingPlanExercise, updateTrainingPlan, updateTrainingPlanExercise } from "@/api";
import { coachApi } from "@/api/coach/coach";
import { EXERCISE_CATEGORIES, type Exercise, type ExerciseCategory, type PlanMilestone, type TrainingPlanPhase } from "@/api/types";
import { Icon } from "@/components/icon";
import { PressableScale } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { fighter as fighterCopy } from "@/i18n/fighter";
import { coachPlans as t } from "@/i18n/coach-plans";
import { muscleQuery, musclesLine } from "@/i18n/server-text";
import { coachErrorMessage, coachProfileId, todayDateOnly } from "@/screens/coach/coach-error";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { Action, Choices, Field } from "@/shared/ui/camp-ui";
import { ConfirmSheet } from "@/screens/one-tap/sheets";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { useSession } from "@/session/session-context";
import { planPhaseOptions, planPhaseWord } from "@/training/plan-phase";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { coachPlanHref, coachPlanSubHref, fromVnDate, parseIntField, toVnDate } from "./plan-model";

const MILESTONE_TITLE_MAX = 255;
const NOTES_MAX = 500;
const PHASES = planPhaseOptions().map(o => ({ value: o.value, label: planPhaseWord(o.value) }));

function useParam(name: string) {
  const params = useLocalSearchParams<Record<string, string>>();
  const v = params[name];
  return typeof v === "string" ? v : "";
}
function useBack(planId: string) {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : planId ? router.replace(coachPlanHref(planId)) : router.replace("/(coach)/plans" as never));
}
function ErrorLine({ text }: { text: string }) {
  const { colors: c } = useThemePreference();
  return text ? <Text testID="form-error" accessibilityLiveRegion="polite" style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{text}</Text> : null;
}
function Title({ children, line }: { children: string; line?: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 2 }}>
    <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(22), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{children}</Text>
    {line ? <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{line}</Text> : null}
  </View>;
}

/**
 * Tạo giáo án / Sửa giáo án (redesign step 17): fighter (new only, from a sheet), phase chips, name, dates as
 * dd/mm/yyyy, description and goals. The save button is pinned in the footer; a new plan opens its page.
 */
export function CoachPlanFormScreen({ edit = false }: { edit?: boolean }) {
  const router = useRouter();
  const { user, isDemo } = useSession();
  const { colors: c } = useThemePreference();
  const planId = useParam("id");
  const presetFighter = useParam("fighterId");
  const back = useBack(edit ? planId : "");
  const [fighterId, setFighterId] = useState(presetFighter);
  const [title, setTitle] = useState("");
  const [phase, setPhase] = useState<TrainingPlanPhase | null>(null);
  const [start, setStart] = useState(edit ? "" : toVnDate(todayDateOnly()));
  const [end, setEnd] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  useToastMessage(done, "success");
  const lock = useRef(false);

  const [fighters, reloadFighters] = useSource(() => edit ? Promise.resolve([]) : coachApi.listFighters({ limit: 50 }).then(p => p.data), `ff|${edit}`);
  const [plan, reloadPlan] = useSource(() => edit && planId ? coachApi.getPlan(planId) : Promise.resolve(null), `pf|${edit}|${planId}`);
  useEffect(() => {
    if (plan.state !== "ok" || !plan.data) return;
    const p = plan.data;
    setTitle(p.title); setPhase(p.phase); setStart(toVnDate(p.startDate)); setEnd(toVnDate(p.endDate));
    setDescription(p.description ?? ""); setGoals(p.goals ?? "");
  }, [plan]);

  const list = fighters.state === "ok" ? fighters.data : [];

  const submit = () => {
    if (lock.current || saving) return;
    const coachId = coachProfileId(user);
    if (!edit && (!coachId || isDemo)) return setError(t.noProfile);
    if (!edit && !fighterId) return setError(t.needFighter);
    if (!phase) return setError(t.needPhase);
    if (!title.trim()) return setError(t.needName);
    const s = fromVnDate(start);
    const e = end.trim() ? fromVnDate(end) : null;
    if (!s || (end.trim() && !e)) return setError(t.badDate);
    if (e && e < s) return setError(t.endBeforeStart);
    lock.current = true; setSaving(true); setError("");
    const body = { title: title.trim(), phase, startDate: s, description: description.trim() || null, goals: goals.trim() || null };
    const run = edit
      ? updateTrainingPlan(planId, { ...body, endDate: e }).then(() => { setDone(t.saved); back(); })
      : createTrainingPlan({ ...body, fighterId, coachId: coachId!, ...(e ? { endDate: e } : {}), description: body.description ?? undefined, goals: body.goals ?? undefined })
        .then(p => { setDone(t.created); router.replace(coachPlanHref(p.id)); });
    run.catch((x: unknown) => setError(coachErrorMessage(x))).finally(() => { lock.current = false; setSaving(false); });
  };

  const loading = edit ? plan.state === "loading" : false;
  return <RolePage testID="coach-plan-form" title={edit ? t.formEdit : t.formNew} onBack={back}
    footer={<Action label={saving ? t.saving : edit ? t.saveEdit : t.saveNew} pending={saving} disabled={loading} onPress={submit}/>}>
    {edit && plan.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reloadPlan}/> : null}
    {loading ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : <>
      {!edit ? <FighterPick testID="plan-pick-fighter" label={t.fighter} placeholder={t.pickFighter} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
        state={fighters.state} fighters={list} value={fighterId} onChange={id => { setFighterId(id); setError(""); }} onRetry={reloadFighters}/> : null}
      <Choices chips label={t.phase} options={PHASES} value={phase} onChange={v => { setPhase(v); setError(""); }}/>
      <Field label={t.name} value={title} onChangeText={v => { setTitle(v); setError(""); }} placeholder={t.namePlaceholder} maxLength={200}/>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label={t.start} value={start} onChangeText={v => { setStart(v); setError(""); }} placeholder={t.datePlaceholder} keyboardType="numbers-and-punctuation" maxLength={10}/></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label={t.end} value={end} onChangeText={v => { setEnd(v); setError(""); }} placeholder={t.optional} keyboardType="numbers-and-punctuation" maxLength={10}/></View>
      </View>
      <Field label={t.description} value={description} onChangeText={setDescription} placeholder={t.optional} multiline maxLength={2000}/>
      <Field label={t.goals} value={goals} onChangeText={setGoals} placeholder={t.optional} multiline maxLength={2000}/>
      <ErrorLine text={error}/>
    </>}
  </RolePage>;
}

type Draft = { key: string; id?: string; title: string; isCompleted: boolean; completedAt?: string; notes: string };
let draftSeq = 0;

/** Cột mốc (redesign step 17): every milestone's name and note, remove, add; one save for the list (as before). */
export function CoachPlanMilestonesScreen() {
  const planId = useParam("id");
  const adding = useParam("add") === "1";
  const back = useBack(planId);
  const { colors: c } = useThemePreference();
  const [plan, reload] = useSource(() => planId ? coachApi.getPlan(planId) : Promise.resolve(null), `pm|${planId}`);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  useToastMessage(done, "success");

  useEffect(() => {
    if (plan.state !== "ok" || !plan.data || drafts) return;
    const rows: Draft[] = plan.data.milestones.map(m => ({ key: m.id ?? `d${++draftSeq}`, id: m.id, title: m.title, isCompleted: !!m.isCompleted, completedAt: m.completedAt, notes: m.notes ?? "" }));
    setDrafts(adding ? [...rows, { key: `d${++draftSeq}`, title: "", isCompleted: false, notes: "" }] : rows);
  }, [plan, drafts, adding]);

  const patch = (key: string, p: Partial<Draft>) => { setDrafts(d => d?.map(x => x.key === key ? { ...x, ...p } : x) ?? d); setError(""); };
  const save = () => {
    if (!drafts || saving) return;
    if (drafts.some(d => !d.title.trim())) return setError(t.needMilestoneName);
    const body: PlanMilestone[] = drafts.map(d => ({ ...(d.id ? { id: d.id } : {}), title: d.title.trim(), isCompleted: d.isCompleted,
      ...(d.isCompleted ? { completedAt: d.completedAt ?? new Date().toISOString() } : {}), notes: d.notes.trim() || null }));
    setSaving(true); setError("");
    updateTrainingPlan(planId, { milestones: body }).then(() => { setDone(t.saved); back(); }, (x: unknown) => setError(coachErrorMessage(x))).finally(() => setSaving(false));
  };

  return <RolePage testID="coach-plan-milestones" title={t.milestonesTitle} onBack={back}
    footer={drafts ? <Action label={saving ? t.saving : t.saveMilestones} pending={saving} onPress={save}/> : undefined}>
    {plan.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {plan.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {plan.state === "ok" && !plan.data ? <EmptyLine title={t.notFound} line={t.notFoundLine}/> : null}
    {plan.state === "ok" && plan.data ? <Title>{plan.data.title}</Title> : null}
    {drafts?.map((d, i) => <View key={d.key} testID={`milestone-draft-${i}`} style={{ gap: 10, paddingTop: 12, borderTopColor: c.line, borderTopWidth: 1 }}>
      <Field label={t.milestoneName} value={d.title} onChangeText={v => patch(d.key, { title: v })} placeholder={t.milestonePlaceholder} maxLength={MILESTONE_TITLE_MAX} autoFocus={adding && i === drafts.length - 1}/>
      <Field label={t.milestoneNotes} value={d.notes} onChangeText={v => patch(d.key, { notes: v })} placeholder={t.optional} multiline maxLength={NOTES_MAX}/>
      <Pressable accessibilityRole="button" accessibilityLabel={`${t.removeMilestone}: ${d.title || t.milestoneName}`} onPress={() => setDrafts(x => x?.filter(y => y.key !== d.key) ?? x)}
        style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
        <Text style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{t.removeMilestone}</Text>
      </Pressable>
    </View>)}
    {drafts ? <Pressable testID="milestone-add" accessibilityRole="button" onPress={() => setDrafts(x => [...(x ?? []), { key: `d${++draftSeq}`, title: "", isCompleted: false, notes: "" }])}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1, opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 40, alignItems: "center" }}><Icon name="add" size={24} color={c.lotus}/></View>
      <Text style={{ ...readableTextStyle(15, true), color: c.lotus }}>{t.addMilestone}</Text>
    </Pressable> : null}
    <ErrorLine text={error}/>
  </RolePage>;
}

/** Bài tập trong giáo án (redesign step 17): order, sets, reps, time, RPE, note; remove asks first. */
export function CoachPlanExerciseScreen() {
  const planId = useParam("id");
  const rowId = useParam("row");
  const name = useParam("name");
  const back = useBack(planId);
  const { colors: c } = useThemePreference();
  const [src, reload] = useSource(() => planId ? coachApi.listPlanExercises(planId).then(r => r.find(x => x.id === rowId) ?? null) : Promise.resolve(null), `pe|${planId}|${rowId}`);
  const [order, setOrder] = useState(""); const [sets, setSets] = useState(""); const [reps, setReps] = useState("");
  const [duration, setDuration] = useState(""); const [rpe, setRpe] = useState(""); const [notes, setNotes] = useState("");
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false); const [removing, setRemoving] = useState(false);
  const [done, setDone] = useState("");
  useToastMessage(done, "success");
  const row = src.state === "ok" ? src.data : null;
  useEffect(() => {
    if (!row) return;
    const s = (n: number | null | undefined) => (n == null ? "" : String(n));
    setOrder(String(row.orderIndex)); setSets(s(row.sets)); setReps(s(row.reps)); setDuration(s(row.durationSeconds)); setRpe(s(row.targetRpe)); setNotes(row.coachNotes ?? "");
  }, [row]);
  const edit = (set: (v: string) => void) => (v: string) => { set(v); setError(""); };

  const save = () => {
    if (!row || saving) return;
    const o = parseIntField(order, 0);
    if (o == null) return setError(t.badOrder);
    const st = parseIntField(sets, 1), rp = parseIntField(reps, 1), du = parseIntField(duration, 1);
    if (st === undefined || rp === undefined || du === undefined) return setError(t.badInt);
    const r = parseIntField(rpe, 1);
    if (r === undefined || (r !== null && r > 10)) return setError(t.badRpe);
    setSaving(true); setError("");
    updateTrainingPlanExercise(planId, row.id, { orderIndex: o, sets: st, reps: rp, durationSeconds: du, targetRpe: r, coachNotes: notes.trim() || null })
      .then(() => { setDone(t.saved); back(); }, (x: unknown) => setError(coachErrorMessage(x))).finally(() => setSaving(false));
  };
  const remove = () => {
    if (!row) return;
    setRemoving(true);
    removeTrainingPlanExercise(planId, row.id).then(() => { setAsking(false); setDone(t.removed); back(); }, (x: unknown) => { setAsking(false); setError(coachErrorMessage(x)); }).finally(() => setRemoving(false));
  };

  const pair = (a: ReactNode, b: ReactNode) => <View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1, minWidth: 0 }}>{a}</View><View style={{ flex: 1, minWidth: 0 }}>{b}</View></View>;
  return <RolePage testID="coach-plan-exercise" title={t.exerciseTitle} onBack={back}
    footer={row ? <Action label={saving ? t.saving : t.saveExercise} pending={saving} onPress={save}/> : undefined}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {src.state === "ok" && !row ? <EmptyLine title={t.notFound}/> : null}
    {row ? <>
      <Title>{name || t.exerciseFallback}</Title>
      {pair(<Field label={t.order} value={order} onChangeText={edit(setOrder)} keyboardType="number-pad" maxLength={3}/>,
        <Field label={t.rpe} value={rpe} onChangeText={edit(setRpe)} keyboardType="number-pad" placeholder={t.rpePlaceholder} maxLength={2}/>)}
      {pair(<Field label={t.sets} value={sets} onChangeText={edit(setSets)} keyboardType="number-pad" placeholder={t.optional} maxLength={3}/>,
        <Field label={t.reps} value={reps} onChangeText={edit(setReps)} keyboardType="number-pad" placeholder={t.optional} maxLength={4}/>)}
      <Field label={t.duration} value={duration} onChangeText={edit(setDuration)} keyboardType="number-pad" placeholder={t.optional} maxLength={5}/>
      <Field label={t.notes} value={notes} onChangeText={setNotes} placeholder={t.optional} multiline maxLength={NOTES_MAX}/>
      <ErrorLine text={error}/>
      <Pressable testID="plan-ex-remove" accessibilityRole="button" onPress={() => setAsking(true)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ ...readableTextStyle(15, true), color: c.danger }}>{t.removeExercise}</Text>
      </Pressable>
    </> : null}
    <ConfirmSheet visible={asking} title={t.removeConfirm} body={name || ""} confirmLabel={t.removeYes} danger sending={removing} forbidden=""
      onCancel={() => setAsking(false)} onConfirm={remove}/>
  </RolePage>;
}

const groupLabel = (g: ExerciseCategory) => fighterCopy.exerciseCategory[g] ?? g;
const exerciseLine = (e: Exercise) => [groupLabel(e.category), musclesLine(e.targetMuscleGroups)].filter(Boolean).join(" · ");

/**
 * Thêm bài tập (redesign step 17): the fighter's library (one search for names and muscles, group chips). A tap adds
 * the exercise at the end of the plan, then opens its page to set the dose.
 */
export function CoachPlanAddExerciseScreen() {
  const router = useRouter();
  const planId = useParam("id");
  const back = useBack(planId);
  const { colors: c } = useThemePreference();
  const [text, setText] = useState(""); const [q, setQ] = useState("");
  const [group, setGroup] = useState<ExerciseCategory | null>(null);
  const [rows, setRows] = useState<Exercise[]>([]);
  const [page, setPage] = useState(1); const [hasNext, setHasNext] = useState(false);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [more, setMore] = useState(false);
  const [adding, setAdding] = useState("");
  const [error, setError] = useState("");
  const seq = useRef(0);
  useEffect(() => { const id = setTimeout(() => setQ(text.trim()), 350); return () => clearTimeout(id); }, [text]);

  const load = useCallback((next: number) => {
    const id = ++seq.current;
    if (next === 1) setState("loading"); else setMore(true);
    const base = { page: next, limit: 20, ...(group ? { category: group } : {}) };
    const byName = listExercises({ ...base, ...(q ? { search: q } : {}) });
    const byMuscle = next === 1 && q ? listExercises({ ...base, targetMuscle: muscleQuery(q) }).catch(() => null) : Promise.resolve(null);
    void Promise.all([byName, byMuscle]).then(([a, b]) => {
      if (id !== seq.current) return;
      setRows(prev => {
        const merged = next === 1 ? [...a.data] : [...prev, ...a.data];
        for (const e of b?.data ?? []) if (!merged.some(x => x.id === e.id)) merged.push(e);
        return merged;
      });
      setPage(next); setHasNext(a.hasNextPage); setState("ok");
    }, () => { if (id === seq.current && next === 1) { setRows([]); setState("error"); } }).finally(() => { if (id === seq.current) setMore(false); });
  }, [group, q]);
  useEffect(() => { load(1); }, [load]);

  const add = (e: Exercise) => {
    if (adding) return;
    setAdding(e.id); setError("");
    coachApi.listPlanExercises(planId)
      .then(list => addTrainingPlanExercise(planId, { exerciseId: e.id, orderIndex: list.reduce((m, r) => Math.max(m, r.orderIndex + 1), 0) }))
      .then(r => router.replace(coachPlanSubHref("bai-tap", { id: planId, row: r.id, name: e.name })), (x: unknown) => setError(coachErrorMessage(x) || t.addFailed))
      .finally(() => setAdding(""));
  };

  return <RolePage testID="coach-plan-library" title={t.libraryTitle} onBack={back}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, minHeight: 48, paddingHorizontal: 12, borderWidth: 1.5, borderColor: c.controlBorder }}>
      <Icon name="search" size={20} color={c.inkMuted}/>
      <TextInput testID="plan-library-search" value={text} onChangeText={setText} placeholder={t.search} placeholderTextColor={c.inkSubtle} accessibilityLabel={t.search}
        autoCapitalize="none" autoCorrect={false} returnKeyType="search" maxLength={100} style={{ ...readableTextStyle(15), flex: 1, minWidth: 0, color: c.ink, paddingVertical: 10 }}/>
    </View>
    <Choices chips value={group} onChange={setGroup} options={[{ value: null, label: t.all }, ...EXERCISE_CATEGORIES.map(x => ({ value: x as ExerciseCategory | null, label: groupLabel(x) }))]}/>
    <ErrorLine text={error}/>
    <View>
      {state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
      {state === "error" ? <RetryRow message={t.libraryFailed} retry={t.retry} onRetry={() => load(1)}/> : null}
      {state === "ok" && !rows.length ? <EmptyLine title={q || group ? t.noResults : t.libraryEmpty}/> : null}
      {state === "ok" ? rows.map((e, i) => <PressableScale key={e.id} testID={`plan-library-${e.id}`} scaleTo={0.99} accessibilityRole="button" accessibilityLabel={t.addA11y(e.name)}
        disabled={!!adding} onPress={() => add(e)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 60, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, ...(i === rows.length - 1 ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
        <View style={{ width: 40, alignItems: "center" }}>{adding === e.id ? <ActivityIndicator color={c.lotus}/> : <Icon name="add" size={24} color={c.lotus}/>}</View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.ink }}>{e.name}</Text>
          <Text numberOfLines={1} style={{ ...readableTextStyle(13.5), color: c.ink }}>{exerciseLine(e)}</Text>
        </View>
        <Icon name="chevron" size={18} color={c.inkSubtle}/>
      </PressableScale>) : null}
      {state === "ok" && hasNext ? <Pressable accessibilityRole="button" disabled={more} onPress={() => load(page + 1)} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
        {more ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(15, true), color: c.lotus }}>{t.more}</Text>}
      </Pressable> : null}
    </View>
  </RolePage>;
}
