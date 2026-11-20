import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { coachApi } from "@/api/coach/coach";
import { listVideos } from "@/api/video/media";
import { listFighterDoctors } from "@/api/medical/medical";
import type { MedicalDossier, PublicFighter } from "@/api/types";
import { BodyMapSection } from "@/components/body3d/body-map-section";
import { clearanceDates, clearanceProblem, clearanceState, clearanceWord, reasonFor, SCOPES } from "@/components/medical/clearance-state";
import { clearanceCopy } from "@/i18n/medical/clearance";
import { clearanceTypeLabel, eligibilityReasonLabel, jointLabel, jointStateLabel, measurementContextLabel, severityLabel } from "@/components/medical/medical-format";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine, RolePage } from "@/components/navigation/role-page";
import { WeightChart, type WeightPoint } from "@/components/visuals/charts";
import { coach } from "@/i18n/coach/coach";
import { coachFighters as t } from "@/i18n/coach/coach-fighters";
import { coachRo } from "@/i18n/coach/coach-ro";
import { vi } from "@/i18n/common/vi";
import { ageFromDob, fighterName, kgText, planPct, vnDate, weightChange, weightSeries } from "@/screens/coach/readonly/ro-format";
import { useSource } from "@/screens/coach/today/coach-today-screen";
import { CampTabs } from "@/shared/ui/camp-lit";
import { campApi, type Suspension } from "@/features/fight-camp/api";
import { SuspensionCard } from "@/features/fight-camp/components/camp-suspension";
import { liveSuspensions, suspensionHeadline, suspensionReasonLabel } from "@/features/fight-camp/logic/camp-rules";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useAiEnabled } from "@/screens/video-ai/ai-data";
import { coachSessionHref } from "@/screens/coach/schedule/session-model";
import { adminVideosHref } from "@/screens/admin/tools/admin-paths";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";
import { coachFighterSubHref, dayLead, fighterTopLine, statusMark, whenLine } from "./fighter-model";

type TabKey = "overview" | "weight" | "schedule" | "medical";
type Refreshers = Map<string, () => Promise<void>>;
const stanceLabels = vi.stance as Record<string, string>;

/** Each tab hands its quiet refetch to the page, so one pull refreshes what is on screen. */
function useRegister(refreshers: Refreshers, key: string, refresh: () => Promise<void>) {
  useEffect(() => { refreshers.set(key, refresh); return () => { refreshers.delete(key); }; }, [refreshers, key, refresh]);
}

async function loadMedical(id: string) {
  const [dossier, summary] = await Promise.allSettled([coachApi.getMedical(id), coachApi.getMedicalSummary(id)]);
  if (dossier.status === "rejected" && summary.status === "rejected") throw dossier.reason;
  return { dossier: dossier.status === "fulfilled" ? dossier.value : null, summary: summary.status === "fulfilled" ? summary.value : null };
}
type Medical = Awaited<ReturnType<typeof loadMedical>>;

/**
 * Võ sĩ (redesign step 16): the one fighter page for coach and admin. It replaced `fighters/[id]` and its
 * Mục tiêu / Hiệu suất placeholders. Name and one line, the training status as a mark and a word, then four
 * in-page tabs. Y tế also leads to the coach's exam request, the medical history and the assigned doctors.
 */
export function CoachFighterDetailScreen({ admin = false, doctorsPath }: { admin?: boolean; doctorsPath?: string } = {}) {
  const { id, tab: tabParam } = useLocalSearchParams<{ id?: string; tab?: string }>();
  const fighterId = typeof id === "string" ? id : "";
  const router = useRouter();
  const lotus = useThemePreference().colors.lotus;
  const [tab, setTab] = useState<TabKey>(tabParam === "medical" ? "medical" : "overview");
  const refreshers = useRef<Refreshers>(new Map()).current;
  const [fighter, reloadFighter, refreshFighter] = useSource(() => fighterId ? coachApi.getFighter(fighterId) : Promise.resolve(null), fighterId);
  const [medical, reloadMedical, refreshMedical] = useSource(() => fighterId ? loadMedical(fighterId) : Promise.resolve(null), `m|${fighterId}`);
  // Suspensions sit apart from the medical record; the page leads with them so a coach never reads "Được tập" for a
  // fighter who is suspended.
  const [susp, reloadSusp, refreshSusp] = useSource(() => fighterId ? campApi.suspensions({ fighterId }).then(p => liveSuspensions(p.data)) : Promise.resolve([] as Suspension[]), `s|${fighterId}`);
  const refresh = useCallback(async () => { await Promise.all([refreshFighter(), refreshMedical(), refreshSusp(), ...[...refreshers.values()].map(r => r())]); }, [refreshFighter, refreshMedical, refreshSusp, refreshers]);

  const back = () => (router.canGoBack() ? router.back() : router.replace((admin ? "/(admin)/vo-si" : "/(coach)/fighters") as never));
  if (!fighterId) return <RolePage title={t.page} onBack={back}><NotFound onBack={back}/></RolePage>;
  const f = fighter.state === "ok" ? fighter.data : null;
  const med = medical.state === "ok" ? medical.data : null;
  const tabs = [
    { key: "overview" as const, label: t.tabs.overview },
    { key: "weight" as const, label: t.tabs.weight },
    { key: "schedule" as const, label: t.tabs.schedule },
    { key: "medical" as const, label: t.tabs.medical, alert: med?.dossier ? !med.dossier.eligibility.training.eligible : f ? statusMark(f.currentMedicalStatus).tone === "warn" : false },
  ];

  return <RolePage testID="coach-fighter-page" title={t.page} onBack={back} onRefresh={refresh}>
    {fighter.state === "loading" ? <ActivityIndicator color={lotus} style={{ paddingVertical: 40 }}/> : null}
    {fighter.state === "error" ? <RetryRow message={t.pageFailed} retry={t.retry} onRetry={reloadFighter}/> : null}
    {fighter.state === "ok" && !f ? <NotFound onBack={back}/> : null}
    {f ? <>
      <Top f={f} med={med} susp={susp.state === "ok" ? susp.data[0] ?? null : null}/>
      {susp.state === "ok" && susp.data.length ? <View testID="fighter-suspensions" style={{ gap: 12 }}>{susp.data.map(x => <SuspensionCard key={x.id} s={x}/>)}</View> : null}
      {susp.state === "error" ? <RetryRow message={t.suspensionFailed} retry={t.retry} onRetry={reloadSusp}/> : null}
      {admin && doctorsPath ? <SlipRow testID="fighter-doctors-admin" icon="stethoscope" title={t.doctors} a11y={t.doctors} last
        onPress={() => router.push({ pathname: doctorsPath, params: { id: f.id } } as never)}/> : null}
      <CampTabs tabs={tabs} value={tab} onChange={setTab} alertLabel={t.alert}/>
      {tab === "overview" ? <Overview key="o" f={f} admin={admin} refreshers={refreshers}/> : null}
      {tab === "weight" ? <Weight key="w" f={f} refreshers={refreshers}/> : null}
      {tab === "schedule" ? <Schedule key="s" f={f} admin={admin} refreshers={refreshers}/> : null}
      {tab === "medical" ? <MedicalPart key="m" f={f} admin={admin} medical={medical.state === "error" ? "error" : med} onRetry={reloadMedical} refreshers={refreshers}/> : null}
    </> : null}
  </RolePage>;
}

function NotFound({ onBack }: { onBack: () => void }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 10 }}>
    <EmptyLine title={t.notFound} line={t.notFoundLine}/>
    <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}>
      <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.backToList}</Text>
    </Pressable>
  </View>;
}

/** Name, one line, then the training status as a mark and a word (from the dossier; the summary status until it loads). */
function Top({ f, med, susp }: { f: PublicFighter; med: Medical | null; susp: Suspension | null }) {
  const { colors: c } = useThemePreference();
  const el = med?.dossier?.eligibility.training;
  // The training licence from the current exam; the summary's single clearance only until the dossier loads.
  const trainingState = med?.dossier ? clearanceState(med.dossier, "training") : null;
  const clearance = trainingState ? (trainingState.kind === "valid" ? trainingState.clearance : null) : med?.summary?.activeClearance;
  const medMark = el ? (el.eligible ? { lead: "✓", tone: c.success } : { lead: "!", tone: c.danger }) : null;
  const fallback = statusMark(f.currentMedicalStatus);
  const medWord = el ? (el.eligible ? t.eligible : t.notEligible) : fallback.word;
  const medWordColor = el ? (el.eligible ? c.success : c.danger) : fallback.wordTone === "ok" ? c.success : fallback.wordTone === "warn" ? c.danger : c.ink;
  const medLine = el && !el.eligible && el.reasons[0] && med?.dossier ? reasonFor(med.dossier, "training", el.reasons[0], eligibilityReasonLabel)
    : clearance?.validUntil ? t.clearanceUntil(vnDate(clearance.validUntil)) : el ? t.noClearanceLine : "";
  // A live suspension outranks the medical answer: it is what decides today's training.
  const word = susp ? suspensionHeadline(susp) : medWord;
  const wordColor = susp ? c.danger : medWordColor;
  const mark = susp ? { lead: "!", tone: c.danger } : medMark;
  // One fact per line (owner 2026-11-18): the reason and the medical answer are not joined by "·" and cut.
  const lines = (susp ? [suspensionReasonLabel[susp.reason], medLine] : [medLine]).filter((x): x is string => !!x);
  const line = lines.join(", ");
  return <View style={{ gap: 12 }}>
    <View style={{ gap: 2 }}>
      <Text accessibilityRole="header" numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(41), textTransform: "uppercase", color: c.ink }}>{fighterName(f)}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{fighterTopLine(f, t.cm)}</Text>
    </View>
    <View testID="fighter-status" accessible accessibilityLabel={line ? `${word}. ${line}` : word} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
      <Text style={{ width: 40, textAlign: "center", fontFamily: fonts.displayExtraBold, fontSize: fz(30), lineHeight: lh(34), color: mark?.tone ?? wordColor }}>{mark?.lead ?? fallback.lead ?? "–"}</Text>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={2} style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.5, textTransform: "uppercase", color: wordColor }}>{word}</Text>
        {lines.map((l, i) => <Text key={i} style={{ ...readableTextStyle(14), color: c.ink }}>{l}</Text>)}
      </View>
    </View>
  </View>;
}

function FactRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopColor: c.line, borderTopWidth: 1, ...(last ? { borderBottomColor: c.line, borderBottomWidth: 1 } : null) }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{value}</Text>
  </View>;
}

function SectionHead({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text accessibilityRole="header" style={{ fontFamily: fonts.display, fontSize: fz(18), lineHeight: lh(25), letterSpacing: 0.7, textTransform: "uppercase", color: c.ink, marginTop: 6 }}>{children}</Text>;
}

function Spinner() { const { colors: c } = useThemePreference(); return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/>; }

function Overview({ f, admin, refreshers }: { f: PublicFighter; admin: boolean; refreshers: Refreshers }) {
  const router = useRouter();
  const [src, reload, refresh] = useSource(async () => {
    const [coaches, plans, videos] = await Promise.all([
      coachApi.listCoaches(f.id),
      coachApi.listPlans({ fighterId: f.id, isActive: true, limit: 1 }),
      // The API's total counts only the page asked for, so count a page of 50 and say "50+" past it.
      listVideos({ fighterId: f.id, limit: 50 }).then(p => ({ n: p.items.length, more: p.pageInfo.hasNextPage }), () => null),
    ]);
    return { coaches: coaches.filter(x => !x.endsAt), plan: plans.data[0] ?? null, videos };
  }, `ov|${f.id}`);
  useRegister(refreshers, "overview", refresh);
  const age = ageFromDob(f.dateOfBirth);
  const facts = [
    [t.dob, `${vnDate(f.dateOfBirth)}${age != null ? ` · ${t.age(age)}` : ""}`],
    ...(f.dominantStance ? [[t.stance, stanceLabels[f.dominantStance] ?? ""]] : []),
    ...(f.reachCm ? [[t.reach, t.cm(f.reachCm)]] : []),
    ...(f.nationality ? [[t.nationality, f.nationality]] : []),
  ] as [string, string][];
  const d = src.state === "ok" ? src.data : null;
  const coachNames = d ? d.coaches.map(x => x.coachName ?? coachRo.detail.coaches) : [];
  return <>
    <View>{facts.map(([l, v], k) => <FactRow key={l} label={l} value={v} last={k === facts.length - 1}/>)}</View>
    {src.state === "loading" ? <Spinner/> : null}
    {src.state === "error" ? <RetryRow message={t.partFailed} retry={t.retry} onRetry={reload}/> : null}
    {d ? <StaggerList testID="overview-rows">
      {d.plan
        ? <SlipRow testID="overview-plan" lead={String(planPct(d.plan))} leadSub="%" title={d.plan.title} line={t.planLine(coachRo.phase[d.plan.phase], d.plan.progress)} a11y={`${t.plan}: ${d.plan.title}`}
          onPress={admin ? undefined : () => router.push({ pathname: "/(coach)/plans/chi-tiet", params: { id: d.plan!.id } } as never)}/>
        : <SlipRow testID="overview-plan" lead="–" leadTone="dim" title={t.plan} line={t.noPlan} a11y={`${t.plan}: ${t.noPlan}`}/>}
      <SlipRow testID="overview-videos" lead={d.videos == null ? "–" : `${d.videos.n}${d.videos.more ? "+" : ""}`} leadTone={d.videos?.n ? undefined : "dim"} title={t.videos}
        line={t.videosLine(d.videos?.n ?? 0, !!d.videos?.more)} a11y={`${t.videos}: ${t.videosLine(d.videos?.n ?? 0, !!d.videos?.more)}`}
        onPress={() => router.push(admin ? adminVideosHref({ fighterId: f.id }) as never : coachFighterSubHref(f.id, "videos"))}/>
      <SlipRow testID="overview-coaches" lead={String(d.coaches.length)} leadTone={d.coaches.length ? undefined : "dim"} title={t.coaches} last
        line={d.coaches.length ? (d.coaches.length > 1 ? t.coachMore(coachNames[0]!, vnDate(d.coaches[0]!.startsAt), d.coaches.length - 1) : t.coachLine(coachNames[0]!, vnDate(d.coaches[0]!.startsAt))) : t.noCoach}
        a11y={`${t.coaches}: ${coachNames.join(", ") || t.noCoach}`}/>
    </StaggerList> : null}
  </>;
}

function Weight({ f, refreshers }: { f: PublicFighter; refreshers: Refreshers }) {
  const { colors } = useThemePreference();
  const [src, reload, refresh] = useSource(() => coachApi.listMeasurements(f.id, { limit: 50 }), `wt|${f.id}`);
  useRegister(refreshers, "weight", refresh);
  if (src.state === "loading") return <Spinner/>;
  if (src.state === "error") return <RetryRow message={t.partFailed} retry={t.retry} onRetry={reload}/>;
  const series = weightSeries(src.data.data);
  const latest = series[series.length - 1];
  if (!latest) return <EmptyLine testID="weight-empty" title={t.noWeight} line={t.noWeightLine}/>;
  const delta = weightChange(series);
  const points: WeightPoint[] = series.map(m => ({ id: m.id, weightKg: m.weightKg, measuredAt: m.measuredAt }));
  const rows = [...series].reverse();
  return <>
    <Stats items={[
      [kgText(latest.weightKg), t.kg, `${t.weightLatest} ${vnDate(latest.measuredAt).slice(0, 5)}`],
      [delta == null ? "–" : `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${kgText(Math.abs(delta))}`, delta == null ? "" : t.kg, t.weightDelta],
      [String(series.length), "", t.weighIns],
    ]}/>
    {series.length >= 2 ? <WeightChart colors={colors} points={points} unit="kg" hideLatest decimalComma/> : null}
    <StaggerList testID="weight-rows">
      {rows.map((m, k) => <SlipRow key={m.id} lead={dayLead(m.measuredAt)} title={`${kgText(m.weightKg)} ${t.kg}`} line={`${vnDate(m.measuredAt)} · ${measurementContextLabel(m.measurementContext)}`}
        a11y={`${kgText(m.weightKg)} ${t.kg}, ${vnDate(m.measuredAt)}`} last={k === rows.length - 1}/>)}
    </StaggerList>
  </>;
}

/** Three numbers in a row between two lines (value, unit, label). */
function Stats({ items }: { items: [string, string, string][] }) {
  const { colors: c } = useThemePreference();
  return <View testID="fighter-stats" style={{ flexDirection: "row", borderTopColor: c.line, borderTopWidth: 1, borderBottomColor: c.line, borderBottomWidth: 1 }}>
    {items.map(([v, u, l], k) => <View key={l} accessible accessibilityLabel={`${l}: ${v} ${u}`} style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, ...(k ? { borderLeftColor: c.line, borderLeftWidth: 1 } : null) }}>
      <Text numberOfLines={1} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: c.ink }}>{v}{u ? <Text style={{ fontSize: fz(13) }}> {u}</Text> : null}</Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink, marginTop: 2 }}>{l}</Text>
    </View>)}
  </View>;
}

function Schedule({ f, admin, refreshers }: { f: PublicFighter; admin: boolean; refreshers: Refreshers }) {
  const router = useRouter();
  const [src, reload, refresh] = useSource(() => coachApi.listFighterSessions(f.id, { page: 1, limit: 30 }), `fs|${f.id}`);
  useRegister(refreshers, "schedule", refresh);
  if (src.state === "loading") return <Spinner/>;
  if (src.state === "error") return <RetryRow message={t.partFailed} retry={t.retry} onRetry={reload}/>;
  const rows = [...src.data.data].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  if (!rows.length) return <EmptyLine testID="schedule-empty" title={t.noSessions}/>;
  return <StaggerList testID="schedule-rows">
    {rows.map((s, k) => {
      const done = s.status === "COMPLETED";
      const off = s.status === "SKIPPED" || s.status === "ABANDONED" || s.status === "CANCELLED";
      const type = coach.sessionTypeLabel[s.sessionType] ?? s.title;
      const word = coachRo.sessionStatus[s.status];
      return <SlipRow key={s.id} testID={`session-row-${s.id}`} lead={dayLead(s.scheduledAt)} leadTone={done ? "ok" : off ? "dim" : undefined} title={type}
        word={word} wordTone={done ? "ok" : off ? "warn" : undefined} line={whenLine(s.scheduledAt)} a11y={`${type}, ${whenLine(s.scheduledAt)}, ${word}`} last={k === rows.length - 1}
        onPress={admin ? undefined : () => router.push(coachSessionHref(s.id))}/>;
    })}
  </StaggerList>;
}

function MedicalPart({ f, admin, medical, onRetry, refreshers }: { f: PublicFighter; admin: boolean; medical: Medical | null | "error"; onRetry: () => void; refreshers: Refreshers }) {
  const router = useRouter();
  const ai = useAiEnabled();
  const { width } = useWindowDimensions();
  const [docs, reloadDocs, refreshDocs] = useSource(() => admin ? Promise.resolve([]) : listFighterDoctors(f.id, { limit: 20 }).then(p => p.data.filter(d => !d.endsAt)), `dr|${f.id}|${admin}`);
  useRegister(refreshers, "doctors", refreshDocs);
  if (medical === "error") return <RetryRow message={t.partFailed} retry={t.retry} onRetry={onRetry}/>;
  if (!medical) return <Spinner/>;
  const injuries = medical.summary?.activeInjuries ?? [];
  const clearances = medical.summary?.activeClearance ? [medical.summary.activeClearance] : [];
  const open = medical.dossier?.openReviewRequests.length ?? 0;
  const names = docs.state === "ok" ? docs.data.map(d => d.doctorName).filter(Boolean).join(" · ") : "";
  const rows: ((last: boolean) => ReactNode)[] = [];
  if (!admin) rows.push(last => <SlipRow key="ask" last={last} testID="medical-ask" lead={String(open)} leadTone={open ? undefined : "dim"} title={t.ask} line={open ? t.askOpen(open) : t.askNone} a11y={`${t.ask}: ${open ? t.askOpen(open) : t.askNone}`}
    onPress={() => router.push(coachFighterSubHref(f.id, "yeu-cau-kham"))}/>);
  if (!admin) rows.push(last => <SlipRow key="history" last={last} testID="medical-history" icon="history" title={t.history} line={t.historyLine} a11y={t.history} onPress={() => router.push(coachFighterSubHref(f.id, "lich-su-y-te"))}/>);
  if (!admin) rows.push(last => docs.state === "error"
    ? <RetryRow key="docs" message={t.partFailed} retry={t.retry} onRetry={reloadDocs}/>
    : <SlipRow key="docs" last={last} testID="medical-doctors" lead={docs.state === "ok" ? String(docs.data.length) : "–"} leadTone={docs.state === "ok" && docs.data.length ? undefined : "dim"} title={t.doctors}
      line={docs.state === "ok" ? names || t.doctorsNone : ""} a11y={`${t.doctors}: ${names || t.doctorsNone}`}/>);
  if (ai) rows.push(last => <SlipRow key="ai" last={last} testID="medical-ai" icon="aiAlert" title={t.aiAlerts} line={t.aiLine} a11y={t.aiAlerts}
    onPress={() => admin
      ? router.push({ pathname: "/(admin)/quan-tri/phan-tich-ai", params: { fighterId: f.id, status: "ALL" } } as never)
      : router.navigate({ pathname: "/(coach)/video-analysis", params: { fighterId: f.id, seg: "review", t: String(Date.now()) } } as never)}/>);
  return <>
    {medical.summary ? <BodyMapSection injuries={medical.summary.activeInjuries} jointStates={medical.summary.jointStates} stateText={jointStateLabel} severityText={severityLabel} height={width >= 768 ? 460 : 380}/> : null}
    <SectionHead>{t.injuries}</SectionHead>
    <View testID="medical-injuries">
      {injuries.length ? injuries.map((i, k) => <SlipRow key={i.id} lead="!" leadTone="warn" title={jointLabel(i.affectedJoint)} word={severityLabel(i.severity)} wordTone="warn"
        line={t.injuryLine(i.injuryType, vnDate(i.occurredAt))} a11y={`${jointLabel(i.affectedJoint)}, ${severityLabel(i.severity)}`} last={k === injuries.length - 1}/>)
        : <SlipRow lead="–" leadTone="dim" title={t.noInjury} a11y={t.noInjury} last/>}
    </View>
    <SectionHead>{t.clearance}</SectionHead>
    <View testID="medical-clearances">
      {medical.dossier ? <ClearanceStates d={medical.dossier}/>
        : clearances.length ? clearances.map((c, k) => <SlipRow key={c.id} lead="✓" leadTone="ok" title={clearanceTypeLabel(c.clearanceType)} line={c.validUntil ? t.until(vnDate(c.validUntil)) : t.noEnd}
        a11y={`${clearanceTypeLabel(c.clearanceType)}, ${c.validUntil ? t.until(vnDate(c.validUntil)) : t.noEnd}`} last={k === clearances.length - 1}/>)
        : <SlipRow lead="–" leadTone="dim" title={t.noClearance} a11y={t.noClearance} last/>}
    </View>
    {rows.length ? <StaggerList testID="medical-rows">{rows.map((r, k) => r(k === rows.length - 1))}</StaggerList> : null}
  </>;
}

/**
 * The licence per scope, from the current exam's clearance only (older exams' clearances no longer count):
 * valid until a date, not valid yet, expired, or not issued for the latest exam.
 */
function ClearanceStates({ d }: { d: MedicalDossier }) {
  const rows = SCOPES.map(scope => ({ scope, state: clearanceState(d, scope) }));
  return <>{rows.map(({ scope, state }, k) => {
    const title = clearanceCopy.scope[scope];
    const ok = state.kind === "valid";
    const word = clearanceWord(state);
    const line = state.kind === "noExam" ? clearanceProblem(state, scope) ?? "" : clearanceDates(state);
    return <SlipRow key={scope} testID={`medical-clearance-${scope}`} lead={ok ? "✓" : state.kind === "noExam" ? "–" : "!"} leadTone={ok ? "ok" : state.kind === "noExam" ? "dim" : "warn"}
      title={title} word={word ?? undefined} wordTone={state.kind === "noExam" ? undefined : "warn"} line={line}
      a11y={[`${t.clearance} ${title.toLocaleLowerCase("vi")}`, word, line].filter(Boolean).join(", ")} last={k === rows.length - 1}/>;
  })}</>;
}
