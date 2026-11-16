import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  getAssignedApplication,
  listAssignedApplications,
  submitAssessment,
  type AssessmentConclusion,
  type AssessmentCriterion,
  type StaffApplication,
} from "@/api/admissions";
import { isApiError } from "@/api/errors";
import { BottomSheet } from "@/components/filter-sheet";
import { hapticSuccess, StaggerList } from "@/components/motion";
import { OptionPick } from "@/components/option-pick";
import { EmptyLine, RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { adm } from "@/i18n/admissions";
import { fighterName } from "@/screens/coach/readonly/ro-format";
import { Action, Choices, Field } from "@/screens/fight-camp/camp-ui";
import { RetryRow } from "@/screens/fighter/redesign/tab-page";
import { ConfirmSheet } from "@/screens/one-tap/sheets";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import { ApplicationRow } from "./admin-admissions";
import { applicantName, AssessmentBlock, CriterionRow, ProfileBlock, Sec, shortDay, StateLine, vnDay, weightWord, WhoHead } from "./adm-parts";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };
type Show = "WAITING" | "ALL";

export const SUMMARY_MAX = 4000;
export const CRITERIA_MAX = 30;
export const COACH_ADMISSIONS = "/danh-gia" as Href;
export const coachApplicationHref = (id: string) => `/danh-gia/${id}` as Href;

/** Waiting for this coach: still Đã nộp and not assessed yet. */
export const isWaiting = (a: Pick<StaffApplication, "status" | "assessment">) => a.status === "SUBMITTED" && !a.assessment;

/** Coach list row: Chờ đánh giá · nộp dd/mm, or Đạt / Không đạt · đánh giá dd/mm. */
function coachRowWord(a: StaffApplication): { word: string; tone?: "ok" | "warn"; line: string } {
  if (a.assessment) {
    const pass = a.assessment.conclusion === "PASS";
    return { word: pass ? adm.pass : adm.fail, tone: pass ? "ok" : "warn", line: adm.assessedOn(shortDay(a.assessment.assessedAt)) };
  }
  if (a.status === "SUBMITTED") return { word: adm.coach.waiting, line: adm.submittedOn(shortDay(a.submittedAt)) };
  return { word: adm.status[a.status], line: adm.submittedOn(shortDay(a.submittedAt)) };
}

/**
 * Coach Đánh giá nhập học (redesign step 24), `danh-gia`, opened from the coach's Tôi: the Hiển thị field (Chờ đánh giá
 * by default, or Tất cả) and one row per application given to this coach.
 */
export function CoachAdmissionsScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [show, setShow] = useState<Show>("WAITING");
  const [list, setList] = useState<Load<StaffApplication[]>>({ state: "loading" });
  const load = useCallback((quiet = false) => {
    if (!quiet) setList({ state: "loading" });
    return listAssignedApplications({ page: 1, limit: 100 }).then(p => setList({ state: "ok", data: p.items })).catch(() => setList({ state: "error" }));
  }, []);
  useEffect(() => { void load(); }, [load]);
  const rows = list.state === "ok" ? (show === "WAITING" ? list.data.filter(isWaiting) : list.data) : [];
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(coach)/me" as Href));

  return <RolePage testID="coach-admissions" title={adm.coach.title} onBack={back} onRefresh={() => load(true)}>
    <OptionPick testID="adm-show" label={adm.coach.filter} title={adm.coach.filter} value={show} onChange={setShow}
      options={[{ value: "WAITING", label: adm.coach.waiting }, { value: "ALL", label: adm.coach.all }]}/>
    {list.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
    {list.state === "error" ? <RetryRow message={adm.failedList} retry={adm.retry} onRetry={() => void load()}/> : null}
    {list.state === "ok" && !rows.length ? <EmptyLine testID="adm-empty" title={show === "WAITING" ? adm.coach.emptyWaiting : adm.coach.empty}/> : null}
    {rows.length ? <StaggerList testID="adm-list">
      {rows.map((a, k) => { const w = coachRowWord(a);
        return <ApplicationRow key={a.id} testID={`adm-row-${a.id}`} item={a} word={w.word} tone={w.tone} line={w.line} last={k === rows.length - 1} onPress={() => router.push(coachApplicationHref(a.id))}/>; })}
    </StaggerList> : null}
  </RolePage>;
}


type Draft = { name: string; method: string; observation: string; value: string; unit: string; note: string };
const EMPTY: Draft = { name: "", method: "", observation: "", value: "", unit: "", note: "" };
const toDraft = (c: AssessmentCriterion): Draft => ({ name: c.criterionName, method: c.method, observation: c.observation, value: c.value != null ? String(c.value).replace(".", ",") : "", unit: c.unit ?? "", note: c.note ?? "" });

/** A draft becomes a criterion, or an error line (missing name/method/observation, value not a number). */
export function criterionFromDraft(d: Draft): AssessmentCriterion | string {
  if (!d.name.trim() || !d.method.trim() || !d.observation.trim()) return adm.coach.criterionIncomplete;
  let value: number | null = null;
  if (d.value.trim()) {
    value = Number(d.value.trim().replace(",", "."));
    if (!Number.isFinite(value)) return adm.coach.valueInvalid;
  }
  return {
    criterionName: d.name.trim(), method: d.method.trim(), observation: d.observation.trim(),
    ...(value != null ? { value } : {}), ...(d.unit.trim() ? { unit: d.unit.trim() } : {}), ...(d.note.trim() ? { note: d.note.trim() } : {}),
  };
}

/**
 * Coach assessment page (redesign step 24), `danh-gia/[id]`: name, state line, then the form while it waits
 * (Kết luận Đạt / Không đạt, Tóm tắt, Tiêu chí rows; a row or "Thêm tiêu chí" opens the criterion sheet) with
 * "Gửi đánh giá" in the footer behind a confirm. Once sent, the assessment shows read only. Hồ sơ follows.
 */
export function CoachAdmissionScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const [item, setItem] = useState<Load<StaffApplication>>({ state: "loading" });
  const [conclusion, setConclusion] = useState<AssessmentConclusion | null>(null);
  const [summary, setSummary] = useState("");
  const [criteria, setCriteria] = useState<AssessmentCriterion[]>([]);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [draftError, setDraftError] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  const load = useCallback((quiet = false) => {
    if (!id) { setItem({ state: "error" }); return Promise.resolve(); }
    if (!quiet) setItem({ state: "loading" });
    return getAssignedApplication(id).then(d => setItem({ state: "ok", data: d })).catch(() => { if (!quiet) setItem({ state: "error" }); });
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const back = () => (router.canGoBack() ? router.back() : router.replace(COACH_ADMISSIONS));

  if (item.state !== "ok") {
    return <RolePage testID="coach-admission" title={adm.coach.pageTitle} onBack={back}>
      {item.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : <RetryRow message={adm.failedOne} retry={adm.retry} onRetry={() => void load()}/>}
    </RolePage>;
  }
  const data = item.data;
  const name = applicantName(data.applicant);
  const open = isWaiting(data);
  const me = user?.profile && "firstName" in user.profile ? fighterName(user.profile) : user?.email ?? adm.none;

  const openSheet = (k: number | "new") => { setDraft(k === "new" ? EMPTY : toDraft(criteria[k]!)); setDraftError(""); setEditing(k); };
  const saveDraft = () => {
    const out = criterionFromDraft(draft);
    if (typeof out === "string") { setDraftError(out); return; }
    setCriteria(cur => (editing === "new" ? [...cur, out] : cur.map((x, k) => (k === editing ? out : x))));
    setEditing(null);
  };
  const removeDraft = () => { if (typeof editing === "number") setCriteria(cur => cur.filter((_, k) => k !== editing)); setEditing(null); };
  const send = () => {
    if (busy || !conclusion || !summary.trim()) return;
    setBusy(true); setError("");
    submitAssessment(id, { conclusion, summary: summary.trim(), criteria })
      .then(() => { hapticSuccess(); setConfirm(false); setNotice(adm.coach.sent); void load(true); })
      .catch((x: unknown) => { setConfirm(false); setError(mapApiMessage(x)); if (isApiError(x) && x.status === 409) void load(true); })
      .finally(() => setBusy(false));
  };
  const set = (k: keyof Draft) => (v: string) => { setDraft(d => ({ ...d, [k]: v })); setDraftError(""); };

  return <RolePage testID="coach-admission" title={adm.coach.pageTitle} onBack={back} onRefresh={() => load(true)}
    footer={open ? <Action label={adm.coach.send} disabled={!conclusion || !summary.trim()} pending={busy} onPress={() => setConfirm(true)}/> : undefined}>
    <StaggerList gap={14}>
      <WhoHead name={name} line={`${weightWord(data.applicant.weightClass)} · ${adm.submittedOn(vnDay(data.submittedAt))}`}/>
      <StateLine testID="adm-state" status={data.assessment ? (data.assessment.conclusion === "PASS" ? "PASSED" : "FAILED") : data.status}
        line={open ? adm.state.coachYou : data.assessment ? adm.assessedOn(vnDay(data.assessment.assessedAt)) : adm.state.closed}/>
    </StaggerList>

    {open ? <View testID="adm-form" style={{ gap: 12 }}>
      <Sec title={adm.coach.conclusion}/>
      <Choices chips value={conclusion} onChange={setConclusion}
        options={[{ value: "PASS" as AssessmentConclusion, label: adm.pass, tone: "good" }, { value: "FAIL" as AssessmentConclusion, label: adm.fail, tone: "bad" }]}/>
      <Field label={adm.coach.summary} value={summary} onChangeText={setSummary} placeholder={adm.coach.summaryHint} maxLength={SUMMARY_MAX} multiline/>
      <Sec title={adm.coach.criterion} aside={criteria.length ? String(criteria.length) : undefined}/>
      {criteria.length ? <View>{criteria.map((cr, k) => <CriterionRow key={`${cr.criterionName}-${k}`} c={cr} index={k} last={k === criteria.length - 1} onPress={() => openSheet(k)}/>)}</View> : null}
      {criteria.length < CRITERIA_MAX
        ? <Pressable testID="adm-add-criterion" accessibilityRole="button" onPress={() => openSheet("new")} style={({ pressed }) => ({ minHeight: 44, justifyContent: "center", alignSelf: "flex-start", opacity: pressed ? 0.7 : 1 })}>
          <Text numberOfLines={1} style={{ ...readableTextStyle(15, true), color: c.lotus }}>{adm.coach.addCriterion}</Text>
        </Pressable>
        : <Text style={{ ...readableTextStyle(14.5), color: c.ink }}>{adm.coach.criteriaMax}</Text>}
    </View> : null}

    {!open && data.assessment ? <AssessmentBlock s={data.assessment} coachName={me}/> : null}
    {!open && !data.assessment ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{adm.coach.closed}</Text> : null}
    <ProfileBlock a={data.applicant}/>

    <BottomSheet visible={editing !== null} onClose={() => setEditing(null)} title={adm.coach.criterion}
      footer={<View style={{ gap: 4, paddingTop: 10 }}>
        <Action label={adm.coach.saveCriterion} onPress={saveDraft}/>
        {typeof editing === "number" ? <Pressable testID="adm-remove-criterion" accessibilityRole="button" onPress={removeDraft} style={({ pressed }) => ({ minHeight: 48, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
          <Text style={{ ...readableTextStyle(15, true), color: c.danger }}>{adm.coach.removeCriterion}</Text>
        </Pressable> : null}
      </View>}>
      <View style={{ gap: 12, paddingBottom: 8 }}>
        <Field label={adm.coach.name} value={draft.name} onChangeText={set("name")} maxLength={150}/>
        <Field label={adm.coach.method} value={draft.method} onChangeText={set("method")} maxLength={300}/>
        <Field label={adm.coach.observation} value={draft.observation} onChangeText={set("observation")} maxLength={1000} multiline/>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}><Field label={adm.coach.value} value={draft.value} onChangeText={set("value")} keyboardType="decimal-pad" maxLength={12} placeholder={adm.form.optional}/></View>
          <View style={{ flex: 1, minWidth: 0 }}><Field label={adm.coach.unit} value={draft.unit} onChangeText={set("unit")} maxLength={30} placeholder={adm.form.optional}/></View>
        </View>
        <Field label={adm.coach.note} value={draft.note} onChangeText={set("note")} maxLength={1000} placeholder={adm.form.optional}/>
        {draftError ? <Text testID="adm-criterion-error" style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{draftError}</Text> : null}
      </View>
    </BottomSheet>
    <ConfirmSheet visible={confirm} title={adm.coach.sendAsk} body={adm.coach.sendBody} confirmLabel={adm.coach.send} sending={busy} forbidden=""
      onCancel={() => setConfirm(false)} onConfirm={send}/>
  </RolePage>;
}
