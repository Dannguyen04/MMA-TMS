import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";

import { getMe } from "@/api/auth";
import { activateAdmission, getOwnApplication, listOwnApplications, submitApplication, type ApplicantApplication } from "@/api/admissions";
import { isApiError } from "@/api/errors";
import { blockingApplication } from "@/admissions/open-application";
import { COUNTRIES, DEFAULT_COUNTRY, DEFAULT_COUNTRY_CODE, filterCountries, findCountry, MAX_PHONE_DIGITS, nationalDigits, toInternationalPhone } from "@/constants/countries";
import { WEIGHT_CLASSES, type WeightClass } from "@/constants/weight-classes";
import { Icon } from "@/components/icon";
import { hapticSuccess, PressableScale, StaggerList } from "@/components/motion";
import { OptionPick } from "@/components/option-pick";
import { EmptyLine, RolePage } from "@/components/role-page";
import { useToastMessage } from "@/components/toast/app-toast";
import { adm } from "@/i18n/admissions";
import { fromVnDate } from "@/screens/coach/plans/plan-model";
import { ConfirmDialog } from "@/screens/doctor/redesign/confirm-dialog";
import { CampTabs } from "@/screens/fight-camp/camp-lit";
import { Action, Field } from "@/screens/fight-camp/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { mapApiMessage } from "@/session/map-api-message";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { applicantName, Facts, nameInitials, Para, ProfileBlock, Sec, shortDay, StateLine, statusTone, StepStrip, vnDay, weightWord, WhoHead } from "./adm-parts";

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "error" };

/** One own application: initials, name, status word · submitted day. */
function OwnRow({ a, last, onPress }: { a: ApplicantApplication; last?: boolean; onPress: () => void }) {
  const name = applicantName(a.applicant);
  const word = adm.status[a.status];
  const line = adm.submittedOn(shortDay(a.submittedAt));
  return <SlipRow testID={`adm-own-${a.id}`} lead={nameInitials(name)} title={name} word={word} wordTone={statusTone(a.status)} line={line} a11y={`${name}, ${word}, ${line}`} last={last} onPress={onPress}/>;
}

/**
 * The applicant's home (redesign step 24). Guest (`ho-so`): Nhập học with the account email, Hồ sơ của bạn, then
 * Giao diện and Đăng xuất; the footer "Nộp hồ sơ" shows only when no file is open. Fighter (`ho-so-cua-toi`, from Tôi):
 * Hồ sơ của tôi with the rows only.
 */
export function ApplicantHomeScreen({ guest = false }: { guest?: boolean }) {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { user, signOut } = useSession();
  const [list, setList] = useState<Load<ApplicantApplication[]>>({ state: "loading" });
  const [confirm, setConfirm] = useState(false);
  const load = useCallback((quiet = false) => {
    if (!quiet) setList(cur => (cur.state === "ok" ? cur : { state: "loading" }));
    return listOwnApplications({ page: 1, limit: 50 }).then(p => setList({ state: "ok", data: p.items })).catch(() => setList({ state: "error" }));
  }, []);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const items = list.state === "ok" ? list.data : [];
  const open = list.state === "ok" ? blockingApplication(items) : null;
  const detail = (id: string) => (guest ? `/ho-so/${id}` : `/ho-so-cua-toi/${id}`) as Href;
  const logout = () => { setConfirm(false); void signOut().then(() => router.replace("/login")); };

  const rows = <>
    {list.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/> : null}
    {list.state === "error" ? <RetryRow message={adm.failedList} retry={adm.retry} onRetry={() => void load()}/> : null}
    {list.state === "ok" && !items.length ? (guest ? <Para>{adm.guest.empty}</Para> : <EmptyLine testID="adm-own-empty" title={adm.fighter.empty}/>) : null}
    {items.length ? <StaggerList testID="adm-own-list">{items.map((a, k) => <OwnRow key={a.id} a={a} last={k === items.length - 1} onPress={() => router.push(detail(a.id))}/>)}</StaggerList> : null}
  </>;

  if (!guest) {
    return <RolePage testID="applicant-home" title={adm.fighter.title} onBack={() => (router.canGoBack() ? router.back() : router.replace("/(fighter)/me" as Href))} onRefresh={() => load(true)}>
      {rows}
    </RolePage>;
  }
  return <RolePage testID="guest-home" title={adm.guest.title} onRefresh={() => load(true)}
    footer={list.state === "ok" && !open ? <Action label={adm.guest.submit} onPress={() => router.push("/ho-so/new" as Href)}/> : undefined}>
    {user?.email ? <Facts rows={[[adm.guest.account, user.email]]}/> : null}
    <Sec title={adm.guest.yours}/>
    {rows}
    {open ? <Para>{adm.guest.openOne}</Para> : null}
    <View style={{ marginTop: 12 }}>
      <SlipRow testID="guest-appearance" icon="appearance" title={adm.guest.look} a11y={adm.guest.look} onPress={() => router.push("/appearance" as Href)}/>
      <PressableScale testID="guest-logout" scaleTo={0.99} accessibilityRole="button" accessibilityLabel={adm.guest.signOut} onPress={() => setConfirm(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
        <View style={{ width: 52 }}><Icon name="logout" size={28} color={c.danger}/></View>
        <Text numberOfLines={1} style={{ flex: 1, fontFamily: fonts.display, fontSize: fz(17), lineHeight: lh(23), letterSpacing: 0.5, textTransform: "uppercase", color: c.danger }}>{adm.guest.signOut}</Text>
      </PressableScale>
    </View>
    <ConfirmDialog visible={confirm} title={adm.guest.signOutAsk} cancelLabel={adm.cancel} confirmLabel={adm.guest.signOut} onCancel={() => setConfirm(false)} onConfirm={logout}/>
  </RolePage>;
}

function mineLine(a: ApplicantApplication): string {
  switch (a.status) {
    case "SUBMITTED": return adm.state.coachMine;
    case "PASSED": return adm.state.waitDecide;
    case "FAILED": case "REJECTED": return adm.state.closed;
    case "APPROVED": return adm.state.waitYou;
    case "ACTIVATED": return adm.state.open;
  }
}

/**
 * The applicant's page (redesign step 24), `ho-so/[id]` and `ho-so-cua-toi/[id]`: name, state line, 4-step strip,
 * the activation part when approved (footer "Kích hoạt tài khoản" once the password is set), Kết quả, then Hồ sơ.
 */
export function ApplicantScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const { applyRegisteredSession } = useSession();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const [item, setItem] = useState<Load<ApplicantApplication>>({ state: "loading" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const load = useCallback((quiet = false) => {
    if (!id) { setItem({ state: "error" }); return Promise.resolve(); }
    if (!quiet) setItem({ state: "loading" });
    return getOwnApplication(id).then(d => setItem({ state: "ok", data: d })).catch(() => { if (!quiet) setItem({ state: "error" }); });
  }, [id]);
  useEffect(() => { void load(); }, [load]);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/" as Href));

  if (item.state !== "ok") {
    return <RolePage testID="applicant-page" title={adm.mine.title} onBack={back}>
      {item.state === "loading" ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : <RetryRow message={adm.failedOne} retry={adm.retry} onRetry={() => void load()}/>}
    </RolePage>;
  }
  const a = item.data;
  const canActivate = a.status === "APPROVED" && a.activation?.status === "PASSWORD_SET";
  const activate = () => {
    if (busy) return;
    setBusy(true); setError("");
    activateAdmission()
      .then(async () => { hapticSuccess(); setNotice(adm.mine.activated); const me = await getMe(); router.replace(homeHrefForGate(applyRegisteredSession(me))); })
      .catch((x: unknown) => setError(mapApiMessage(x)))
      .finally(() => setBusy(false));
  };
  const results: [string, string, boolean?][] = [];
  if (a.assessment) { const pass = a.assessment.conclusion === "PASS"; results.push([adm.facts.assessment, `${pass ? adm.pass : adm.fail} · ${shortDay(a.assessment.assessedAt)}`, !pass]); }
  if (a.decision) { const ok = a.decision.decision === "APPROVED"; results.push([adm.facts.decision, `${ok ? adm.approved : adm.rejected} · ${shortDay(a.decision.decidedAt)}`, !ok]); }

  return <RolePage testID="applicant-page" title={adm.mine.title} onBack={back} onRefresh={() => load(true)}
    footer={canActivate ? <Action label={adm.mine.activate} pending={busy} onPress={activate}/> : undefined}>
    <StaggerList gap={14}>
      <WhoHead name={applicantName(a.applicant)} line={`${weightWord(a.applicant.weightClass)} · ${adm.submittedOn(vnDay(a.submittedAt))}`}/>
      <StateLine testID="adm-state" status={a.status} line={mineLine(a)}/>
      <StepStrip status={a.status}/>
    </StaggerList>
    {a.status === "APPROVED" ? <View testID="adm-activate" style={{ gap: 8 }}>
      <Facts rows={[[adm.facts.activation, a.activation ? adm.activation[a.activation.status] : adm.activation.PENDING]]}/>
      <Para>{adm.mine.approvedLine}</Para>
      <Para>{canActivate ? adm.mine.activateLine : adm.mine.passwordLine}</Para>
    </View> : null}
    {a.status === "FAILED" || a.status === "REJECTED" ? <Para>{adm.mine.again}</Para> : null}
    {results.length ? <View style={{ gap: 8 }}><Sec title={adm.sections.result}/><Facts rows={results}/></View> : null}
    <ProfileBlock a={a.applicant}/>
  </RolePage>;
}

type Step = "who" | "contact" | "exp";
const STEPS: readonly Step[] = ["who", "contact", "exp"];
const WEIGHT_OPTIONS = WEIGHT_CLASSES.map(w => ({ value: w, label: weightWord(w) }));

/**
 * Nộp hồ sơ (redesign step 24), `ho-so/new`: three underline tabs (1. Bạn là ai · 2. Liên hệ · 3. Kinh nghiệm; past
 * steps can be tapped back), fields in the new frame, long choices (hạng cân, quốc tịch) as bottom-sheet pickers.
 * Footer: Quay lại + Tiếp, and "Gửi hồ sơ" on the last step.
 */
export function ApplicationFormScreen() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const [step, setStep] = useState<Step>("who");
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [dob, setDob] = useState("");
  const [weight, setWeight] = useState<WeightClass | "">("");
  const [nationality, setNationality] = useState(DEFAULT_COUNTRY_CODE);
  const [phone, setPhone] = useState("");
  const [training, setTraining] = useState("");
  const [competition, setCompetition] = useState("");
  const [motivation, setMotivation] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const country = findCountry(nationality) ?? DEFAULT_COUNTRY;
  const countryOptions = useMemo(() => COUNTRIES.map(k => ({ value: k.code, label: `${k.flag} ${k.name}` })), []);

  useEffect(() => {
    let live = true;
    // A failed check leaves the form usable; the API still refuses a second open file.
    listOwnApplications({ page: 1, limit: 50 }).then(p => { const o = blockingApplication(p.items); if (live && o) setOpenId(o.id); }).catch(() => undefined);
    return () => { live = false; };
  }, []);

  const k = STEPS.indexOf(step);
  const last = k === STEPS.length - 1;
  const back = () => (router.canGoBack() ? router.back() : router.replace("/ho-so" as Href));
  const send = () => {
    if (busy) return;
    const iso = fromVnDate(dob);
    if (!lastName.trim() || !firstName.trim() || !weight || !dob.trim()) { setFormError(adm.form.required); setStep("who"); return; }
    if (!iso) { setFormError(adm.form.badDate); setStep("who"); return; }
    setFormError(""); setBusy(true); setError("");
    submitApplication({
      firstName: firstName.trim(), lastName: lastName.trim(), dateOfBirth: iso, weightClass: weight, nationality: country.code,
      contactPhone: toInternationalPhone(country, phone),
      trainingBackground: training.trim() || undefined, competitionBackground: competition.trim() || undefined, motivation: motivation.trim() || undefined,
    })
      .then(created => { hapticSuccess(); router.replace(`/ho-so/${created.id}` as Href); })
      .catch((x: unknown) => { if (isApiError(x) && x.code === "FIGHTER_APPLICATION_ALREADY_OPEN") setFormError(adm.form.blocked); setError(mapApiMessage(x)); })
      .finally(() => setBusy(false));
  };

  const footer = openId
    ? <Action label={adm.mine.title} secondary onPress={() => router.replace(`/ho-so/${openId}` as Href)}/>
    : <View style={{ flexDirection: "row", gap: 10 }}>
      {k > 0 ? <View style={{ flex: 1 }}><Action label={adm.form.back} secondary disabled={busy} onPress={() => setStep(STEPS[k - 1]!)}/></View> : null}
      <View style={{ flex: 1 }}><Action label={last ? adm.form.send : adm.form.next} pending={last && busy} onPress={() => (last ? send() : setStep(STEPS[k + 1]!))}/></View>
    </View>;

  return <RolePage testID="application-form" title={adm.form.title} onBack={back} footer={footer}>
    <CampTabs alertLabel="" value={step} onChange={s => { if (STEPS.indexOf(s) < k) setStep(s); }}
      tabs={STEPS.map((s, i) => ({ key: s, label: adm.form.tabs[i]!, a11y: adm.form.tabs[i]! }))}/>
    {openId ? <Para>{adm.form.blocked}</Para> : null}
    {step === "who" ? <View style={{ gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}><Field label={adm.form.lastName} value={lastName} onChangeText={v => { setLastName(v); setFormError(""); }} maxLength={100} autoComplete="family-name"/></View>
        <View style={{ flex: 1, minWidth: 0 }}><Field label={adm.form.firstName} value={firstName} onChangeText={v => { setFirstName(v); setFormError(""); }} maxLength={100} autoComplete="given-name"/></View>
      </View>
      <Field label={adm.form.dob} value={dob} onChangeText={v => { setDob(v); setFormError(""); }} placeholder={adm.form.dobHint} keyboardType="numbers-and-punctuation" maxLength={10}/>
      <OptionPick testID="adm-weight" label={adm.form.weight} title={adm.form.weight} placeholder={adm.form.weightPick} options={WEIGHT_OPTIONS} value={weight} onChange={v => { setWeight(v); setFormError(""); }}/>
    </View> : null}
    {step === "contact" ? <View style={{ gap: 12 }}>
      <OptionPick testID="adm-country" label={adm.form.nationality} title={adm.form.nationality} options={countryOptions} value={nationality} onChange={setNationality}
        search={{ placeholder: adm.form.countrySearch, match: (o, q) => filterCountries(q).some(x => x.code === o.value) }} emptySearch={adm.form.countryEmpty}/>
      <Field label={`${adm.form.phone} (+${country.callingCode})`} value={phone} onChangeText={v => setPhone(nationalDigits(v))} placeholder={adm.form.optional} keyboardType="phone-pad" maxLength={MAX_PHONE_DIGITS}/>
    </View> : null}
    {step === "exp" ? <View style={{ gap: 12 }}>
      <Field label={adm.form.training} value={training} onChangeText={setTraining} placeholder={adm.form.optional} maxLength={2000} multiline/>
      <Field label={adm.form.competition} value={competition} onChangeText={setCompetition} placeholder={adm.form.optional} maxLength={2000} multiline/>
      <Field label={adm.form.motivation} value={motivation} onChangeText={setMotivation} placeholder={adm.form.optional} maxLength={2000} multiline/>
    </View> : null}
    {formError ? <Text testID="adm-form-error" style={{ ...readableTextStyle(14.5, true), color: c.danger }}>{formError}</Text> : null}
  </RolePage>;
}
