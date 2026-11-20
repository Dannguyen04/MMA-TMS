import { useCallback, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor/doctor-ro";
import type { MedicalDossier, MedicalExamination, MedicalHistoryEntry, MedicalHistoryRecordType as RecordType } from "@/api/types";
import { StaggerList } from "@/components/motion/motion";
import { EmptyLine } from "@/components/navigation/role-page";
import { BodyMapSection, bodyText } from "@/components/body3d/body-map-section";
import { clearanceDates, clearanceProblem, clearanceState, clearanceWord, olderClearances, reasonFor, SCOPES } from "@/components/medical/clearance-state";
import { clearanceCopy } from "@/i18n/medical/clearance";
import {
  clearanceTypeLabel,
  eligibilityReasonLabel,
  jointLabel,
  jointStateLabel,
  recordTypeLabel,
  requesterRoleLabel,

} from "@/components/medical/medical-format";

import { doctorClinical as t } from "@/i18n/doctor/doctor-clinical";
import { medical } from "@/i18n/medical/medical";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { Choices } from "@/shared/ui/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/shared/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useRevokeClearance } from "@/screens/one-tap/status-actions";
import { AiOverviewBlock, type FighterAi } from "./ai-tab";
import { useThemePreference } from "@/theme";
import { readableTextStyle } from "@/theme/typography";

import { detailError, expiresSoon, groupByMonth, historySummary, planProgress, planStatusText, severityText, vnDayMonth } from "./detail-format";
import { examHref, examView } from "./exam-model";

export const WIDE_MIN = 768;
type Load<T> = { data: T | null; error: string; loading: boolean; reload: () => unknown; refresh: () => Promise<void> };
export type Bind = (key: string, fn: (() => Promise<unknown>) | null) => void;

/* ───────────── shared bits ───────────── */

function Section({ title, aside, testID, children }: { title: string; aside?: string; testID?: string; children: ReactNode }) {
  return <View testID={testID} style={{ gap: 8 }}><EvHead title={title} aside={aside}/>{children}</View>;
}

function Note({ children }: { children: string }) {
  const { colors: c } = useThemePreference();
  return <Text style={{ ...readableTextStyle(15), color: c.ink }}>{children}</Text>;
}

/** Rows with a ruled bottom on the last one. */
function Rows<T>({ items, render }: { items: readonly T[]; render: (item: T, last: boolean, i: number) => ReactNode }) {
  return <StaggerList gap={0}>{items.map((x, i) => render(x, i === items.length - 1, i))}</StaggerList>;
}

function Spinner() {
  const { colors: c } = useThemePreference();
  return <ActivityIndicator color={c.lotus} style={{ paddingVertical: 24 }}/>;
}

function MoreLink({ onPress, busy }: { onPress: () => void; busy: boolean }) {
  const { colors: c } = useThemePreference();
  return <Pressable accessibilityRole="button" accessibilityLabel={t.more} onPress={onPress} disabled={busy} style={{ minHeight: 48, justifyContent: "center", alignItems: "center" }}>
    {busy ? <ActivityIndicator color={c.lotus}/> : <Text style={{ ...readableTextStyle(14.5, true), color: c.lotus }}>{t.more}</Text>}
  </Pressable>;
}

/** "05/10 – 24/11/2026", or "từ 05/10" when there is no end date (never a dash). */
export function dateRange(from: string | null | undefined, to: string | null | undefined): string {
  const end = to ? vnDate(to) : "";
  const start = vnDayMonth(from);
  return end && end !== "—" ? `${start} – ${end}` : t.since(start);
}

/* ───────────── Tổng quan ───────────── */

/** Keyed by fighterId: a previous fighter's highlights must never survive a switch. */
function MedicalBodyMap({ fighterId, enabled, wide }: { fighterId: string; enabled: boolean; wide: boolean }) {
  const summary = useLoad(enabled && !!fighterId, `summary:${fighterId}`, useCallback(() => doctorRoApi.getMedicalSummary(fighterId), [fighterId]), { keepOnError: true });
  return <Section title={bodyText.title}>
    {summary.loading && !summary.data ? <Spinner/> : null}
    {!summary.data && summary.error ? <RetryRow message={detailError(summary.error)} retry={t.retry} onRetry={() => void summary.reload()}/> : null}
    {summary.data ? <BodyMapSection injuries={summary.data.activeInjuries} jointStates={summary.data.jointStates}
      stateText={jointStateLabel} severityText={severityText} height={wide ? 460 : 380}/> : null}
  </Section>;
}

function Doctors({ fighterId, enabled }: { fighterId: string; enabled: boolean }) {
  const { colors: c } = useThemePreference();
  const doctors = useLoad(enabled && !!fighterId, `doctors:${fighterId}`, useCallback(() => doctorRoApi.listDoctors(fighterId, { limit: 50 }), [fighterId]), { keepOnError: true });
  const current = (doctors.data?.data ?? []).filter((a) => !a.endsAt || Date.parse(a.endsAt) > Date.now());
  return <Section title={t.doctors} testID="ov-doctors">
    {doctors.loading && !doctors.data ? <Spinner/> : null}
    {!doctors.data && doctors.error ? <RetryRow message={detailError(doctors.error)} retry={t.retry} onRetry={() => void doctors.reload()}/> : null}
    {doctors.data && !current.length ? <Note>{t.noDoctors}</Note> : null}
    {current.length ? <View>
      {current.map((a, i) => <View key={a.id} accessible accessibilityLabel={`${a.doctorName || t.doctorFallback}, ${t.since(vnDate(a.startsAt))}`}
        style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.line, ...(i === current.length - 1 ? { borderBottomWidth: 1, borderBottomColor: c.line } : null) }}>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink, flexShrink: 1 }}>{a.doctorName || t.doctorFallback}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink }}>{t.since(vnDate(a.startsAt))}</Text>
      </View>)}
    </View> : null}
  </Section>;
}

/**
 * Tổng quan (redesign step 20): sections with one-line rows. Đủ điều kiện (Tập luyện, Thi đấu), the body map, Giấy phép
 * (a row opens the revoke sheet), Chấn thương, Hồi phục (% lead), Yêu cầu khám, Bác sĩ phụ trách. Only status words are coloured.
 */
export function OverviewTab({ fighterId, dossier, enabled, onSeeAllAi, ai }: { fighterId: string; dossier: Load<MedicalDossier>; enabled: boolean; onSeeAllAi?: () => void; ai?: FighterAi }) {
  const wide = useWindowDimensions().width >= WIDE_MIN;
  const revoke = useRevokeClearance(() => void dossier.reload());
  const d = dossier.data;

  if (!d) {
    return <View style={{ gap: 20 }}>
      {dossier.loading ? <Spinner/> : null}
      {!dossier.loading && dossier.error ? <RetryRow message={detailError(dossier.error) || t.medicalError} retry={t.retry} onRetry={() => void dossier.reload()}/> : null}
      <Doctors fighterId={fighterId} enabled={enabled}/>
    </View>;
  }

  const elig = d.eligibility;
  // One licence row per scope from its current exam; ACTIVE clearances of older exams stay listed (revocable) but marked.
  const clear = SCOPES.map(scope => ({ scope, state: clearanceState(d, scope) }));
  const older = olderClearances(d);
  const open = d.openReviewRequests;

  const left = <>
    <Section title={t.eligibility} testID="ov-eligibility">
      {!elig ? <Note>{medical.unknownReason}</Note> : <Rows items={[["training", t.training], ["competition", t.competition]] as const} render={([k, label], last) => {
        const e = elig[k];
        const reasons = e.eligible ? "" : (e.reasons.length ? [...new Set(e.reasons.map(code => reasonFor(d, k, code, eligibilityReasonLabel)))] : [medical.unknownReason]).join(" · ");
        const word = e.eligible ? t.allowed : t.notAllowed;
        return <SlipRow key={k} testID={`elig-${k}`} lead={e.eligible ? "✓" : "!"} leadTone={e.eligible ? "ok" : "warn"} title={label}
          word={word} wordTone={e.eligible ? "ok" : "warn"} line={reasons || undefined} a11y={[label, word, reasons].filter(Boolean).join(", ")} last={last}/>;
      }}/>}
    </Section>
    <MedicalBodyMap key={fighterId} fighterId={fighterId} enabled={enabled} wide={wide}/>
    <Section title={t.clearance} testID="ov-clearance">
      <Rows items={[...clear.map(x => ({ key: x.scope, x })), ...older.map(c => ({ key: c.id, c }))]} render={(row, last) => {
        if ("c" in row) {
          const c = row.c;
          const title = `${clearanceTypeLabel(c.clearanceType)} · ${clearanceCopy.older}`;
          const range = dateRange(c.validFrom, c.validUntil);
          return <SlipRow key={c.id} testID={`clearance-${c.id}`} lead="–" leadTone="dim" title={title} word={clearanceCopy.olderWord} line={range}
            a11y={[title, range, clearanceCopy.olderLine, t.revokeA11y].join(", ")} last={last} onPress={() => revoke.open(c.id, c.clearanceType === "TRAINING")}/>;
        }
        const { scope, state } = row.x;
        const title = clearanceCopy.scope[scope];
        const c = "clearance" in state ? state.clearance : null;
        const ok = state.kind === "valid";
        const soon = ok && expiresSoon(c?.validUntil ?? null);
        const word = ok ? (soon ? t.expiring : undefined) : clearanceWord(state) ?? undefined;
        const line = c && state.kind !== "expired" ? dateRange(c.validFrom, c.validUntil) : state.kind === "noExam" ? clearanceProblem(state, scope) ?? "" : clearanceDates(state);
        return <SlipRow key={scope} testID={c ? `clearance-${c.id}` : `clearance-${scope}`} lead={ok ? "✓" : state.kind === "noExam" ? "–" : "!"} leadTone={ok ? "ok" : state.kind === "noExam" ? "dim" : "warn"}
          title={title} word={word} wordTone={state.kind === "noExam" ? undefined : "warn"} line={line}
          a11y={[title, word, line, c ? t.revokeA11y : ""].filter(Boolean).join(", ")} last={last}
          onPress={c ? () => revoke.open(c.id, c.clearanceType === "TRAINING") : undefined}/>;
      }}/>
    </Section>
    <AiOverviewBlock fighterId={fighterId} enabled={enabled} ai={ai} onSeeAll={onSeeAllAi ?? (() => undefined)}/>
  </>;

  const right = <>
    <Section title={t.injuries} aside={d.activeInjuries.length ? String(d.activeInjuries.length) : undefined} testID="ov-injuries">
      {d.activeInjuries.length ? <Rows items={d.activeInjuries} render={(i, last) => {
        const title = [i.injuryType, jointLabel(i.affectedJoint)].filter(Boolean).join(" · ");
        const line = `${severityText(i.severity)} · ${vnDate(i.occurredAt)}`;
        return <SlipRow key={i.id} testID={`injury-${i.id}`} lead="!" leadTone="warn" title={title} line={line} a11y={`${title}, ${line}`} last={last}/>;
      }}/> : <Note>{t.noInjuries}</Note>}
    </Section>
    <Section title={t.recovery} testID="ov-recovery">
      {d.activeRecoveryPlans.length ? <Rows items={d.activeRecoveryPlans} render={(r, last) => {
        const pr = planProgress(r);
        const line = [dateRange(r.startDate, r.estimatedEndDate), planStatusText(r.status), pr.total ? t.milestones(pr.done, pr.total) : ""].filter(Boolean).join(" · ");
        return <SlipRow key={r.id} testID={`recovery-${r.id}`} lead={pr.total ? String(pr.pct) : "–"} leadSub={pr.total ? "%" : undefined} leadTone={pr.total ? undefined : "dim"}
          title={r.title} line={line} a11y={`${r.title}, ${pr.total ? `${pr.pct}%, ` : ""}${line}`} last={last}/>;
      }}/> : <Note>{t.noRecovery}</Note>}
    </Section>
    {open.length ? <Section title={t.requests} aside={String(open.length)} testID="ov-requests">
      <Rows items={open} render={(r, last) => {
        const title = t.requestTitle(requesterRoleLabel(r.requesterRole), vnDayMonth(r.requestedAt));
        return <SlipRow key={r.id} testID={`request-${r.id}`} icon="alertCircle" leadTone="warn" title={title} line={`“${r.reason}”`} a11y={`${title}, ${r.reason}`} last={last}/>;
      }}/>
    </Section> : null}
    <Doctors fighterId={fighterId} enabled={enabled}/>
  </>;

  return <>
    {wide
      ? <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start" }}>
          <View style={{ flex: 1, gap: 20 }}>{left}</View>
          <View style={{ flex: 1, gap: 20 }}>{right}</View>
        </View>
      : <View style={{ gap: 20 }}>{left}{right}</View>}
    {revoke.sheet}
  </>;
}

/* ───────────── Khám ───────────── */

type Scope = "ALL" | "TRAINING" | "COMPETITION";

/** Khám (redesign step 20): open requests, scope chips, one row per exam; a row opens the exam page. */
export function ExamsTab({ fighterId, enabled, bind }: { fighterId: string; enabled: boolean; bind: Bind }) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>("ALL");
  const on = enabled && !!fighterId;
  const reviews = useLoad(on, `rr:${fighterId}`, useCallback(() => doctorRoApi.listReviewRequests(fighterId, { status: "OPEN", limit: 20 }), [fighterId]), { keepOnError: true });
  const exams = usePagedList<MedicalExamination>(on, `ex:${fighterId}:${scope}`, (page) =>
    doctorRoApi.listExaminations(fighterId, { page, limit: 20, ...(scope === "ALL" ? {} : { scope }) }),
  );
  bind("exams", async () => Promise.all([reviews.refresh(), exams.refresh()]));
  const open = reviews.data?.data ?? [];
  return <View style={{ gap: 16 }}>
    {open.length ? <Section title={t.requests} aside={String(open.length)} testID="exam-requests">
      <Rows items={open} render={(r, last) => {
        const title = t.requestTitle(requesterRoleLabel(r.requesterRole), vnDayMonth(r.requestedAt));
        return <SlipRow key={r.id} icon="alertCircle" leadTone="warn" title={title} line={`“${r.reason}”`} a11y={`${title}, ${r.reason}`} last={last}/>;
      }}/>
    </Section> : null}
    {!reviews.data && reviews.error ? <RetryRow message={detailError(reviews.error)} retry={t.retry} onRetry={() => void reviews.reload()}/> : null}
    <Choices chips label={undefined} value={scope} onChange={setScope}
      options={[{ value: "ALL", label: t.all }, { value: "TRAINING", label: medical.scope.TRAINING }, { value: "COMPETITION", label: medical.scope.COMPETITION }]}/>
    {!exams.loaded || (exams.loading && !exams.items.length) ? <Spinner/> : null}
    {exams.error && !exams.items.length ? <RetryRow message={detailError(exams.error) || t.examsError} retry={t.retry} onRetry={() => void exams.reload()}/> : null}
    {exams.loaded && !exams.loading && !exams.error && !exams.items.length ? <EmptyLine testID="exams-empty" title={scope === "ALL" ? t.noExams : t.noExamsScope}/> : null}
    {exams.items.length ? <View testID="exam-list">
      <Rows items={exams.items} render={(e, last) => {
        const v = examView(e);
        return <SlipRow key={e.id} testID={`exam-${e.id}`} lead={v.mark} leadTone={v.tone} title={v.title} word={v.word} wordTone={v.tone} line={v.line}
          a11y={[v.title, v.word, v.line].filter(Boolean).join(", ")} last={last} onPress={() => router.push(examHref(e.id, fighterId) as never)}/>;
      }}/>
    </View> : null}
    {exams.hasNext ? <MoreLink onPress={exams.loadMore} busy={exams.loadingMore}/> : null}
  </View>;
}

/* ───────────── Hồ sơ ───────────── */

type HistRow = MedicalHistoryEntry & { id: string };
const TYPES: RecordType[] = ["INJURY", "MEDICAL_EXAMINATION", "MEDICAL_CLEARANCE", "RECOVERY_PLAN", "TREATMENT", "MEDICAL_REVIEW_REQUEST"];

/** Hồ sơ (redesign step 20): type chips (rows of three), month heads, one row per record with the day as the lead. */
export function HistoryTab({ fighterId, enabled, bind }: { fighterId: string; enabled: boolean; bind: Bind }) {
  const { colors: c } = useThemePreference();
  const [type, setType] = useState<"ALL" | RecordType>("ALL");
  const list = usePagedList<HistRow>(enabled && !!fighterId, `hist:${fighterId}:${type}`, async (page) => {
    const res = await doctorRoApi.listHistory(fighterId, { page, limit: 20, ...(type === "ALL" ? {} : { recordType: type }) });
    return { ...res, data: res.data.map((e) => ({ ...e, id: `${e.recordType}:${e.recordId}:${e.revision}` })) };
  });
  bind("history", list.refresh);
  const groups = groupByMonth(list.items, (r) => r.recordedAt);
  return <View style={{ gap: 16 }}>
    <Choices chips value={type} onChange={setType} options={[{ value: "ALL" as const, label: t.all }, ...TYPES.map((k) => ({ value: k, label: recordTypeLabel(k) }))]}/>
    {!list.loaded || (list.loading && !list.items.length) ? <Spinner/> : null}
    {list.error && !list.items.length ? <RetryRow message={detailError(list.error) || t.historyError} retry={t.retry} onRetry={() => void list.reload()}/> : null}
    {list.loaded && !list.loading && !list.error && !list.items.length ? <EmptyLine testID="history-empty" title={type === "ALL" ? t.noHistory : t.noHistoryType}/> : null}
    {groups.map((g) => <View key={g.label} style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={{ ...readableTextStyle(14, true), color: c.ink, textTransform: "uppercase", letterSpacing: 0.6 }}>{g.label}</Text>
      <Rows items={g.rows} render={(r, last) => {
        const title = recordTypeLabel(r.recordType);
        const summary = historySummary(r);
        const day = vnDate(r.recordedAt).slice(0, 2);
        return <SlipRow key={r.id} testID={`hist-${r.id}`} lead={day} title={title} line={summary || undefined}
          a11y={`${title}, ${vnDate(r.recordedAt)}${summary ? `, ${summary}` : ""}`} last={last}/>;
      }}/>
    </View>)}
    {list.hasNext ? <MoreLink onPress={list.loadMore} busy={list.loadingMore}/> : null}
  </View>;
}

