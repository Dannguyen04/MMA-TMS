import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { createTrainingSession, updateTrainingSession } from "@/api";
import { coachApi } from "@/api/coach";
import { SESSION_TYPES, type SessionType } from "@/api/types";
import { RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { coachSchedule as t } from "@/i18n/coach-schedule";
import { coachErrorMessage, coachProfileId, localIsoFromDateTime, nowTimeHm, todayDateOnly } from "@/screens/coach/coach-error";
import { FighterPick } from "@/screens/coach/fighter-pick";
import { whenLine } from "@/screens/coach/fighters/fighter-model";
import { fromVnDate, parseIntField, toVnDate } from "@/screens/coach/plans/plan-model";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { Action, Choices, Field } from "@/screens/fight-camp/camp-ui";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { coachSessionHref, parseHm } from "./session-model";

const NOTES_MAX = 2000;
const TYPES = SESSION_TYPES.map(v => ({ value: v as SessionType | null, label: t.types[v] }));

function useParam(name: string) {
  const params = useLocalSearchParams<Record<string, string>>();
  const v = params[name];
  return typeof v === "string" ? v : "";
}
function ErrorLine({ text }: { text: string }) {
  const { colors: c } = useThemePreference();
  return text ? <Text testID="form-error" accessibilityLiveRegion="polite" style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{text}</Text> : null;
}

/** Sửa buổi tập (redesign step 18): the three things the old page let the coach change: type, RPE, notes. */
export function CoachSessionEditScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const sessionId = useParam("id");
  const back = () => (router.canGoBack() ? router.back() : router.replace(sessionId ? coachSessionHref(sessionId) : ("/(coach)/schedule" as never)));
  const [src, reload] = useSource(() => sessionId ? coachApi.getSession(sessionId) : Promise.resolve(null), `se|${sessionId}`);
  const [type, setType] = useState<SessionType | null>(null);
  const [rpe, setRpe] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  useToastMessage(done, "success");
  const filled = useRef(false);

  useEffect(() => {
    if (src.state !== "ok" || !src.data || filled.current) return;
    filled.current = true;
    setType(src.data.sessionType); setRpe(src.data.reportedRpe != null ? String(src.data.reportedRpe) : ""); setNotes(src.data.coachNotes ?? "");
  }, [src]);

  const s = src.state === "ok" ? src.data : null;
  const save = () => {
    if (!s || saving) return;
    const r = parseIntField(rpe, 1);
    if (r === undefined || (r != null && r > 10)) return setError(t.badRpe);
    setSaving(true); setError("");
    updateTrainingSession(s.id, { coachNotes: notes.trim() || null, reportedRpe: r, ...(type && type !== s.sessionType ? { sessionType: type } : {}) })
      .then(() => { setDone(t.saved); back(); }, (x: unknown) => setError(coachErrorMessage(x)))
      .finally(() => setSaving(false));
  };

  return <RolePage testID="coach-session-edit" title={t.editTitle} onBack={back}
    footer={<Action label={saving ? t.saving : t.save} pending={saving} disabled={!s} onPress={save}/>}>
    {src.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 40 }}/> : null}
    {src.state === "error" ? <RetryRow message={t.loadFailed} retry={t.retry} onRetry={reload}/> : null}
    {s ? <>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(22), lineHeight: lh(26), textTransform: "uppercase", color: c.ink }}>{s.title}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{whenLine(s.scheduledAt)}</Text>
      </View>
      <Choices chips label={t.type} options={TYPES} value={type} onChange={v => { setType(v); setError(""); }}/>
      <Field label={t.rpeField} value={rpe} onChangeText={v => { setRpe(v); setError(""); }} placeholder={t.rpePlaceholder} keyboardType="number-pad" maxLength={2}/>
      <Field label={t.notes} value={notes} onChangeText={setNotes} placeholder={t.optional} multiline maxLength={NOTES_MAX}/>
      <ErrorLine text={error}/>
    </> : null}
  </RolePage>;
}

/** Plan chips in one scrolling row: plan names are too long to wrap three across. */
function PlanChips({ options, value, onChange }: { options: readonly { value: string; label: string }[]; value: string; onChange: (v: string) => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 7 }}>
    <Text style={{ ...readableTextStyle(15, true), color: c.ink }}>{t.plan}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="radiogroup" accessibilityLabel={t.plan}
      style={{ flexGrow: 0, marginHorizontal: -22 }} contentContainerStyle={{ gap: 6, paddingHorizontal: 22 }}>
      {options.map(o => {
        const on = o.value === value;
        return <Pressable key={o.value || "none"} testID={`session-plan-${o.value || "none"}`} accessibilityRole="radio" accessibilityState={{ checked: on }} aria-checked={on} onPress={() => onChange(o.value)}
          style={({ pressed }) => ({ minHeight: 44, maxWidth: 260, paddingHorizontal: 14, justifyContent: "center", borderWidth: 1.5, borderColor: on ? c.ink : c.controlBorder, backgroundColor: on ? c.ink : "transparent", opacity: pressed ? 0.75 : 1 })}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(14, true), color: on ? c.bg : c.ink }}>{o.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

/**
 * Tạo buổi tập (redesign step 18): fighter from a sheet, the fighter's active plans as chips, name, date and time
 * side by side, type chips, place, minutes and rounds side by side, notes. The lit button is pinned; a new session
 * opens its page.
 */
export function CoachSessionFormScreen() {
  const router = useRouter();
  const { user, isDemo } = useSession();
  const presetFighter = useParam("fighterId");
  const presetPlan = useParam("planId");
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/schedule" as never));
  const [fighterId, setFighterId] = useState(presetFighter);
  const [planId, setPlanId] = useState(presetPlan);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(toVnDate(todayDateOnly()));
  const [time, setTime] = useState(nowTimeHm());
  const [type, setType] = useState<SessionType | null>("PAD_WORK");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("60");
  const [rounds, setRounds] = useState("0");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState("");
  useToastMessage(done, "success");
  const lock = useRef(false);

  const [fighters, reloadFighters] = useSource(() => coachApi.listFighters({ limit: 50 }).then(p => p.data), "sf|fighters");
  const [plans, reloadPlans] = useSource(
    () => fighterId ? coachApi.listPlans({ fighterId, isActive: true, limit: 50 }).then(p => p.data.filter(x => x.status === "ACTIVE" || x.id === presetPlan)) : Promise.resolve([]),
    `sf|plans|${fighterId}`,
  );
  const list = fighters.state === "ok" ? fighters.data : [];
  const planList = plans.state === "ok" ? plans.data : [];
  const planOptions = [{ value: "", label: t.noPlan }, ...planList.map(p => ({ value: p.id, label: p.title }))];
  const clear = () => setError("");

  const submit = () => {
    if (lock.current || saving) return;
    const coachId = coachProfileId(user);
    if (!coachId || isDemo) return setError(t.noProfile);
    if (!fighterId) return setError(t.needFighter);
    if (!title.trim()) return setError(t.needName);
    const day = fromVnDate(date);
    if (!day) return setError(t.badDate);
    const hm = parseHm(time);
    const at = hm ? localIsoFromDateTime(day, hm) : null;
    if (!at) return setError(t.badTime);
    const mins = parseIntField(duration, 0);
    const r = parseIntField(rounds, 0);
    if (mins === undefined || r === undefined) return setError(t.badNumber);
    lock.current = true; setSaving(true); setError("");
    const plan = planList.find(p => p.id === planId);
    createTrainingSession({
      fighterId, title: title.trim(), scheduledAt: at, sessionType: type ?? "PAD_WORK", coachId,
      ...(plan ? { planId: plan.id } : {}),
      ...(mins != null ? { plannedDurationSec: mins * 60 } : {}),
      roundCount: r ?? 0,
      ...(location.trim() ? { location: location.trim() } : {}),
      ...(notes.trim() ? { coachNotes: notes.trim() } : {}),
    }).then(created => { setDone(t.created); router.replace(coachSessionHref(created.id)); }, (x: unknown) => setError(coachErrorMessage(x)))
      .finally(() => { lock.current = false; setSaving(false); });
  };
  return <RolePage testID="coach-session-form" title={t.newTitle} onBack={back}
    footer={<Action label={saving ? t.saving : t.saveNew} pending={saving} onPress={submit}/>}>
    <FighterPick testID="session-pick-fighter" label={t.fighter} placeholder={t.pickFighter} empty={t.noFighters} failed={t.fightersFailed} retry={t.retry}
      state={fighters.state} fighters={list} value={fighterId} onRetry={reloadFighters}
      onChange={id => { if (id !== fighterId) setPlanId(""); setFighterId(id); clear(); }}/>
    {fighterId ? plans.state === "error" ? <RetryRow message={t.plansFailed} retry={t.retry} onRetry={reloadPlans}/>
      : <PlanChips options={planOptions} value={planList.some(p => p.id === planId) ? planId : ""} onChange={setPlanId}/> : null}
    <Field label={t.name} value={title} onChangeText={v => { setTitle(v); clear(); }} placeholder={t.namePlaceholder} maxLength={200}/>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Field label={t.date} value={date} onChangeText={v => { setDate(v); clear(); }} placeholder={t.datePlaceholder} keyboardType="numbers-and-punctuation" maxLength={10}/></View>
      <View style={{ flex: 1, minWidth: 0 }}><Field label={t.time} value={time} onChangeText={v => { setTime(v); clear(); }} placeholder={t.timePlaceholder} keyboardType="numbers-and-punctuation" maxLength={5}/></View>
    </View>
    <Choices chips label={t.type} options={TYPES} value={type} onChange={setType}/>
    <Field label={t.location} value={location} onChangeText={setLocation} placeholder={t.optional} maxLength={200}/>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0 }}><Field label={t.duration} value={duration} onChangeText={v => { setDuration(v); clear(); }} keyboardType="number-pad" maxLength={4}/></View>
      <View style={{ flex: 1, minWidth: 0 }}><Field label={t.roundsField} value={rounds} onChangeText={v => { setRounds(v); clear(); }} keyboardType="number-pad" maxLength={3}/></View>
    </View>
    <Field label={t.notesField} value={notes} onChangeText={setNotes} placeholder={t.optional} multiline maxLength={NOTES_MAX}/>
    <ErrorLine text={error}/>
  </RolePage>;
}
