import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import {
  assignApplicationCoach,
  decideApplication,
  getApplication,
  listApplications,
  resendActivationEmail,
  type ApplicationStatus,
  type StaffApplication,
} from "@/api/admissions";
import { isApiError } from "@/api/errors";
import { assignFighterCoach, getUser, listFighterCoaches, listUsers, type CoachAssignment, type PublicUser } from "@/api";
import { assignDoctorHref, fighterIdFromActivatedUser } from "@/clinical/assign-doctor-link";
import { BottomSheet } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { hapticSuccess, StaggerList } from "@/components/motion";
import { OptionPick } from "@/components/option-pick";
import { EmptyLine, RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { adm } from "@/i18n/admissions";
import { ACTIONABLE_STATUSES } from "@/screens/admin/admin-actionable";
import { userDisplayName } from "@/screens/admin/readonly/admin-format";
import { PickRow } from "@/screens/admin/tools/admin-assign-screen";
import { Action, Field } from "@/screens/fight-camp/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { ConfirmSheet } from "@/screens/one-tap/sheets";
import { mapApiMessage } from "@/session/map-api-message";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import {
  applicantName, AssessmentBlock, DecisionBlock, Facts, HistoryBlock, nameInitials, ProfileBlock, Sec, shortDay,
  StateLine, statusTone, StepStrip, vnDay, weightWord, WhoHead,
} from "./adm-parts";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };
type Filter = "NEEDS" | "ALL" | ApplicationStatus;

const FILTERS: readonly { value: Filter; label: string }[] = [
  { value: "NEEDS", label: adm.admin.needs },
  { value: "ALL", label: adm.admin.all },
  ...(["SUBMITTED", "PASSED", "FAILED", "APPROVED", "ACTIVATED", "REJECTED"] as const).map(s => ({ value: s as Filter, label: adm.status[s] })),
];

export const adminApplicationHref = (id: string) => `/quan-tri/nhap-hoc/${id}` as Href;

/** A staff user's name as the rest of the app writes it (first · last), the same as the training-coach rows. */
export const staffName = (u: PublicUser): string => userDisplayName(u);
const profileId = (u: PublicUser): string | null => (u.profile && typeof u.profile.id === "string" ? u.profile.id : null);
const coachLine = (u: PublicUser) => (u.profile && "specialization" in u.profile && typeof u.profile.specialization === "string" && u.profile.specialization.trim()) || u.email;

/** Row of one application: initials, name, status word (coloured alone) · submitted day. */
export function ApplicationRow({ item, testID, onPress, last, word: ownWord, tone, line }: {
  item: StaffApplication; testID?: string; onPress: () => void; last?: boolean;
  /** The coach list shows its own word (Chờ đánh giá, Đạt, Không đạt) instead of the file status. */ word?: string; tone?: "ok" | "warn"; line?: string;
}) {
  const name = applicantName(item.applicant);
  const word = ownWord ?? adm.status[item.status];
  const rest = line ?? adm.submittedOn(shortDay(item.submittedAt));
  return <SlipRow testID={testID} lead={nameInitials(name)} title={name} word={word} wordTone={ownWord ? tone : statusTone(item.status)} line={rest} a11y={`${name}, ${word}, ${rest}`} last={last} onPress={onPress}/>;
}

/**
 * Admin Nhập học (redesign step 24), `quan-tri/nhap-hoc`: the Trạng thái field opens a sheet (Cần xử lý by default),
 * then one row per application. Cần xử lý = Đã nộp, Đạt test, Không đạt test.
 */
export function AdminAdmissionsScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [filter, setFilter] = useState<Filter>("NEEDS");
  const [list, setList] = useState<Load<StaffApplication[]>>({ state: "loading" });

  const load = useCallback((quiet = false) => {
    if (!quiet) setList({ state: "loading" });
    const status = filter === "NEEDS" || filter === "ALL" ? undefined : filter;
    return listApplications({ page: 1, limit: 100, ...(status ? { status } : {}) })
      .then(p => setList({ state: "ok", data: filter === "NEEDS" ? p.items.filter(i => ACTIONABLE_STATUSES.includes(i.status)) : p.items }))
      .catch(() => setList({ state: "error" }));
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(admin)" as Href));
  return <RolePage testID="admin-admissions" title={adm.admin.title} onBack={back} onRefresh={() => load(true)}>
    <OptionPick testID="adm-filter" label={adm.admin.filter} title={adm.admin.filter} options={FILTERS} value={filter} onChange={setFilter}/>
    {list.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
    {list.state === "error" ? <RetryRow message={adm.failedList} retry={adm.retry} onRetry={() => void load()}/> : null}
    {list.state === "ok" && !list.data.length ? <EmptyLine testID="adm-empty" title={filter === "NEEDS" ? adm.admin.emptyNeeds : adm.admin.empty}/> : null}
    {list.state === "ok" && list.data.length ? <StaggerList testID="adm-list">
      {list.data.map((item, k) => <ApplicationRow key={item.id} testID={`adm-row-${item.id}`} item={item} last={k === list.data.length - 1} onPress={() => router.push(adminApplicationHref(item.id))}/>)}
    </StaggerList> : null}
  </RolePage>;
}

/** A field that shows the chosen person and opens a sheet of people (owner 2026-11-13: long choices go in a sheet). */
function PickField({ testID, label, value, placeholder, onPress }: { testID: string; label: string; /** Hidden when the section head already names it. */ value: string; placeholder: string; onPress: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 7 }}>
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={`${label}: ${value || placeholder}`} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", minHeight: 50, paddingHorizontal: 13, borderWidth: 1.5, borderColor: c.controlBorder, opacity: pressed ? 0.75 : 1 })}>
      <Text numberOfLines={1} style={{ ...readableTextStyle(16, !!value), color: value ? c.ink : c.inkSubtle, flex: 1 }}>{value || placeholder}</Text>
      <Icon name="chevron" size={18} color={c.inkSubtle}/>
    </Pressable>
  </View>;
}

/** Admin's state line under the name. */
function adminStateLine(item: StaffApplication, coachName: (id?: string | null) => string): string {
  switch (item.status) {
    case "SUBMITTED": return item.currentAssignment ? adm.state.coachIs(coachName(item.currentAssignment.coachId)) : adm.state.waitCoach;
    case "PASSED": return adm.state.waitDecide;
    case "FAILED": case "REJECTED": return adm.state.closed;
    case "APPROVED": return adm.state.waitActivate;
    case "ACTIVATED": return adm.state.open;
  }
}

/**
 * Admin application page (redesign step 24), `quan-tri/nhap-hoc/[id]`: one page, the next step on top. The name, the
 * state line and the 4-step strip, then the action for this status (choose the assessing coach, decide, resend the
 * activation email, or set the training coach and doctor), then Đánh giá, Quyết định, Hồ sơ, Kinh nghiệm, Lịch sử.
 */
export function AdminAdmissionScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const [item, setItem] = useState<Load<StaffApplication>>({ state: "loading" });
  const [coaches, setCoaches] = useState<Load<PublicUser[]>>({ state: "loading" });
  const [coachId, setCoachId] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [fighterId, setFighterId] = useState<string | null>(null);
  const [fighterLookup, setFighterLookup] = useState<"idle" | "loading" | "missing">("idle");
  const [training, setTraining] = useState<CoachAssignment[]>([]);
  const [trainSheet, setTrainSheet] = useState(false);
  const [trainPick, setTrainPick] = useState("");
  const [coachSheet, setCoachSheet] = useState(false);
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  const load = useCallback((quiet = false) => {
    if (!id) { setItem({ state: "error" }); return Promise.resolve(); }
    if (!quiet) setItem({ state: "loading" });
    return getApplication(id).then(d => setItem({ state: "ok", data: d })).catch(() => { if (!quiet) setItem({ state: "error" }); });
  }, [id]);
  const loadCoaches = useCallback(() => {
    setCoaches({ state: "loading" });
    listUsers({ role: "COACH", status: "ACTIVE", page: 1, limit: 100 })
      .then(p => setCoaches({ state: "ok", data: p.items.filter(u => profileId(u)) }))
      .catch(() => setCoaches({ state: "error" }));
  }, []);
  useEffect(() => { void load(); loadCoaches(); }, [load, loadCoaches]);

  const data = item.state === "ok" ? item.data : null;
  const status = data?.status;
  const guestUserId = data?.guestUserId;
  const current = data?.currentAssignment?.coachId ?? "";
  useEffect(() => { setCoachId(current); }, [current]);

  // An activated file: find the new fighter, then their training coaches.
  useEffect(() => {
    if (status !== "ACTIVATED" || !guestUserId) { setFighterId(null); setFighterLookup("idle"); return; }
    let live = true;
    setFighterLookup("loading");
    getUser(guestUserId).then(u => { if (!live) return; const f = fighterIdFromActivatedUser(u); setFighterId(f); setFighterLookup(f ? "idle" : "missing"); })
      .catch(() => { if (live) setFighterLookup("missing"); });
    return () => { live = false; };
  }, [status, guestUserId]);
  useEffect(() => {
    if (!fighterId) { setTraining([]); return; }
    listFighterCoaches(fighterId).then(setTraining).catch(() => setTraining([]));
  }, [fighterId]);

  const coachList = coaches.state === "ok" ? coaches.data : [];
  const byProfile = useMemo(() => new Map(coachList.map(u => [profileId(u) ?? "", u])), [coachList]);
  const coachName = useCallback((pid?: string | null) => { if (!pid) return adm.none; const u = byProfile.get(pid); return u ? staffName(u) : adm.none; }, [byProfile]);

  const run = (work: () => Promise<unknown>, done: string, after?: () => void) => {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    work().then(() => { hapticSuccess(); setNotice(done); after?.(); void load(true); })
      .catch((x: unknown) => { setError(mapApiMessage(x)); if (isApiError(x) && x.status === 409) void load(true); })
      .finally(() => setBusy(false));
  };
  const back = () => (router.canGoBack() ? router.back() : router.replace("/quan-tri/nhap-hoc" as Href));

  if (item.state !== "ok" || !data) {
    return <RolePage testID="admin-admission" title={adm.admin.pageTitle} onBack={back}>
      {item.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : <RetryRow message={adm.failedOne} retry={adm.retry} onRetry={() => void load()}/>}
    </RolePage>;
  }

  const name = applicantName(data.applicant);
  const activeTraining = training.filter(r => r.endsAt == null);
  const doctorHref = assignDoctorHref(fighterId);
  let action: ReactNode = null;
  let footer: ReactNode;

  if (data.status === "SUBMITTED") {
    const changing = Boolean(current) && coachId !== current;
    action = <View testID="adm-assign" style={{ gap: 8 }}>
      <Sec title={adm.admin.chooseCoach}/>
      {coaches.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 16 }}/> : null}
      {coaches.state === "error" ? <RetryRow message={adm.admin.coachesFailed} retry={adm.retry} onRetry={loadCoaches}/> : null}
      {coaches.state === "ok" && !coachList.length ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{adm.admin.noCoaches}</Text> : null}
      {coachList.length ? <PickField testID="adm-coach" label={adm.admin.coachField} value={coachId ? coachName(coachId) : ""} placeholder={adm.admin.coachPick} onPress={() => setCoachSheet(true)}/> : null}
      {changing ? <Field label={adm.admin.changeReason} value={changeReason} onChangeText={setChangeReason} placeholder={adm.admin.optional} maxLength={500} multiline/> : null}
    </View>;
    footer = coachList.length ? <Action label={adm.admin.assign} disabled={!coachId || (Boolean(current) && !changing)} pending={busy}
      onPress={() => run(() => assignApplicationCoach(id, { coachId, reassignmentReason: changing && changeReason.trim() ? changeReason.trim() : undefined }), adm.admin.assigned, () => setChangeReason(""))}/> : undefined;
  } else if (data.status === "PASSED") {
    action = <View testID="adm-decide" style={{ gap: 8 }}>
      <Sec title={adm.sections.decision}/>
      <Field label={adm.admin.reason} value={reason} onChangeText={setReason} placeholder={adm.admin.reasonHint} maxLength={2000} multiline/>
    </View>;
    const off = !reason.trim();
    footer = <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ flex: 1 }}><Action label={adm.admin.reject} danger disabled={off || busy} onPress={() => setRejecting(true)}/></View>
      <View style={{ flex: 1 }}><Action label={adm.admin.approve} disabled={off} pending={busy}
        onPress={() => run(() => decideApplication(id, { decision: "APPROVED", reason: reason.trim() }), adm.admin.approvedDone, () => setReason(""))}/></View>
    </View>;
  } else if (data.status === "APPROVED") {
    action = <View testID="adm-activation" style={{ gap: 8 }}>
      <Sec title={adm.sections.activation}/>
      <Facts rows={[[adm.facts.account, data.accountEmail ?? data.applicant.email], [adm.facts.status, data.activation ? adm.activation[data.activation.status] : adm.activation.PENDING]]}/>
    </View>;
    footer = <Action label={adm.admin.resend} secondary pending={busy} onPress={() => run(() => resendActivationEmail(id), adm.admin.resent)}/>;
  } else if (data.status === "ACTIVATED") {
    action = <View testID="adm-training" style={{ gap: 8 }}>
      <Sec title={adm.admin.training}/>
      {fighterLookup === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 16 }}/> : null}
      {fighterLookup === "missing" ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{adm.admin.fighterMissing}</Text> : null}
      {fighterId ? (activeTraining.length
        ? <View>{activeTraining.map((r, k) => { const n = r.coachName?.trim() || coachName(r.coachId);
          return <SlipRow key={r.id} lead={nameInitials(n)} title={n} line={adm.admin.trainingOn} a11y={`${n}, ${adm.admin.trainingOn}`} last={k === activeTraining.length - 1}/>; })}</View>
        : <Text style={{ ...readableTextStyle(15), color: c.ink }}>{adm.admin.trainingNone}</Text>) : null}
      {doctorHref ? <View style={{ marginTop: 6 }}><SlipRow testID="adm-doctor" icon="stethoscope" title={adm.admin.assignDoctor} line={name} a11y={`${adm.admin.assignDoctor}, ${name}`} last
        onPress={() => router.push(`${doctorHref}&applicationId=${encodeURIComponent(id)}` as Href)}/></View> : null}
    </View>;
    footer = fighterId && coachList.length ? <Action label={adm.admin.trainingCta} secondary onPress={() => { setTrainPick(""); setTrainSheet(true); }}/> : undefined;
  }

  return <RolePage testID="admin-admission" title={adm.admin.pageTitle} onBack={back} onRefresh={() => load(true)} footer={footer}>
    <StaggerList gap={14}>
      <WhoHead name={name} line={`${weightWord(data.applicant.weightClass)} · ${adm.submittedOn(vnDay(data.submittedAt))}`}/>
      <StateLine testID="adm-state" status={data.status} line={adminStateLine(data, coachName)}/>
      <StepStrip status={data.status}/>
    </StaggerList>
    {action}
    {data.assessment ? <AssessmentBlock s={data.assessment} coachName={coachName(data.assessment.coachId)}/> : null}
    {data.decision ? <DecisionBlock d={data.decision}/> : null}
    <ProfileBlock a={data.applicant} accountEmail={data.accountEmail}/>
    <HistoryBlock item={data} coachName={coachName}/>

    <ConfirmSheet visible={rejecting} title={adm.admin.rejectAsk} body={adm.admin.rejectBody} confirmLabel={adm.admin.reject} danger sending={busy} forbidden=""
      onCancel={() => setRejecting(false)}
      onConfirm={() => run(() => decideApplication(id, { decision: "REJECTED", reason: reason.trim() }), adm.admin.rejectedDone, () => { setRejecting(false); setReason(""); })}/>
    <BottomSheet visible={coachSheet} onClose={() => setCoachSheet(false)} title={adm.admin.chooseCoach}>
      {coachList.map((u, k) => { const pid = profileId(u)!; const n = staffName(u);
        return <PickRow key={pid} testID={`adm-coach-${pid}`} initials={nameInitials(n)} title={n} line={coachLine(u)} on={coachId === pid} last={k === coachList.length - 1} onPress={() => { setCoachId(pid); setCoachSheet(false); }}/>; })}
    </BottomSheet>
    <BottomSheet visible={trainSheet} onClose={() => (busy ? undefined : setTrainSheet(false))} title={adm.admin.trainingCta}
      footer={<View style={{ paddingTop: 10 }}><Action label={adm.admin.trainingCta} disabled={!trainPick} pending={busy}
        onPress={() => fighterId && run(() => assignFighterCoach(fighterId, { coachId: trainPick }).then(row => setTraining(cur => [row, ...cur.filter(o => o.id !== row.id)])), adm.admin.trainingDone, () => setTrainSheet(false))}/></View>}>
      {coachList.map((u, k) => { const pid = profileId(u)!; const n = staffName(u);
        return <PickRow key={pid} testID={`adm-train-${pid}`} initials={nameInitials(n)} title={n} line={coachLine(u)} on={trainPick === pid} last={k === coachList.length - 1} onPress={() => setTrainPick(pid)}/>; })}
    </BottomSheet>
  </RolePage>;
}
