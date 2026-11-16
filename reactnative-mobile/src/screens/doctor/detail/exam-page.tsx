import { useCallback } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { doctorRoApi } from "@/api/doctor-ro";
import type { MedicalExamination } from "@/api/types";
import { StaggerList } from "@/components/motion";
import { EmptyLine, RolePage } from "@/components/role-page";
import { jointLabel, sessionTypeName } from "@/components/medical/medical-format";
import { doctor } from "@/i18n/doctor";
import { doctorClinical as t } from "@/i18n/doctor-clinical";
import { assessmentAreaLabel } from "@/i18n/server-text";
import { fighterName, vnDate } from "@/screens/coach/readonly/ro-format";
import { sentences } from "@/screens/fight-camp/camp-ui";
import { RetryRow, SlipRow } from "@/screens/fighter/redesign/tab-page";
import { useLoad } from "@/screens/fighter/use-load";
import { EvHead } from "@/screens/media/evidence/evidence-panels";
import { useDoctorRoster } from "@/screens/doctor/redesign/doctor-roster";
import { useThemePreference } from "@/theme";
import { fonts, readableTextStyle, fz, lh } from "@/theme/typography";

import { detailError } from "./detail-format";
import { decisionWord, doctorFighterHref, examSubline, examTypeText } from "./exam-model";

const MAX_PAGES = 5;

/** The exam is not served alone: walk the fighter's list (newest first) until it shows up. */
export async function findExam(fighterId: string, id: string): Promise<MedicalExamination | null> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await doctorRoApi.listExaminations(fighterId, { page, limit: 50 });
    const hit = res.data.find((e) => e.id === id);
    if (hit) return hit;
    if (!res.data.length || page * 50 >= (res.total ?? 0)) return null;
  }
  return null;
}

function num(v: number | null | undefined, digits = 0): string {
  return v == null || !Number.isFinite(v) ? "–" : v.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function Strip({ cells, testID }: { cells: { value: string; unit?: string; label: string }[]; testID?: string }) {
  const { colors: c } = useThemePreference();
  return <View testID={testID} style={{ flexDirection: "row", borderTopWidth: 1, borderBottomWidth: 1, borderColor: c.line }}>
    {cells.map((x, k) => <View key={x.label} accessible accessibilityLabel={`${x.label}: ${x.value}${x.unit ?? ""}`}
      style={{ flex: 1, minWidth: 0, alignItems: "center", paddingVertical: 12, paddingHorizontal: 4, borderLeftWidth: k ? 1 : 0, borderLeftColor: c.line }}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(24), lineHeight: lh(28), color: c.ink }}>
        {x.value}{x.unit ? <Text style={{ fontFamily: fonts.display, fontSize: fz(14) }}>{x.unit}</Text> : null}
      </Text>
      <Text numberOfLines={1} style={{ ...readableTextStyle(12.5), color: c.ink }}>{x.label}</Text>
    </View>)}
  </View>;
}

function Fact({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors: c } = useThemePreference();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 11, borderTopWidth: 1, borderTopColor: c.line, ...(last ? { borderBottomWidth: 1, borderBottomColor: c.line } : null) }}>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5), color: c.ink }}>{label}</Text>
    <Text numberOfLines={1} style={{ ...readableTextStyle(14.5, true), color: c.ink, flexShrink: 1, textAlign: "right" }}>{value}</Text>
  </View>;
}

function Prose({ text }: { text: string }) {
  const { colors: c } = useThemePreference();
  return <View style={{ gap: 4 }}>{sentences(text).map((s, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(22), color: c.ink }}>{s}</Text>)}</View>;
}

/**
 * Doctor exam page (redesign step 20): exam type, "fighter · scope #n · date time", the decision row, vitals in two
 * 3-number strips, area checks (abnormal first, only the result word coloured), restrictions, advice and note one
 * sentence per line. Read-only.
 */
export function DoctorExamPage() {
  const router = useRouter();
  const { colors: c } = useThemePreference();
  const params = useLocalSearchParams<{ id?: string; fighterId?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const fighterId = typeof params.fighterId === "string" ? params.fighterId : "";
  const roster = useDoctorRoster();
  const f = roster.items.find((x) => x.id === fighterId) ?? null;
  const load = useCallback(async () => ({ exam: await findExam(fighterId, id) }), [fighterId, id]);
  const exam = useLoad(!!id && !!fighterId, `exam:${fighterId}:${id}`, load, { keepOnError: true });
  const back = () => (router.canGoBack() ? router.back() : router.replace((fighterId ? doctorFighterHref(fighterId, "exams") : "/(doctor)/vo-si") as never));

  const e = exam.data?.exam ?? null;
  const det = e?.details ?? null;
  const v = det?.vitals ?? null;
  const w = e ? decisionWord(e.decision) : null;
  const r = e?.restrictions ?? null;
  const areas = det ? [...det.assessments].sort((a, b) => Number(a.result === "NORMAL") - Number(b.result === "NORMAL")) : [];
  const scat = det?.scat6?.responses.status === "ADMINISTERED" ? t.scat6Done : det?.scat6?.responses.status === "NOT_ADMINISTERED" ? t.scat6Skipped : "";
  const facts: [string, string][] = e ? [
    [t.avoidJoints, r?.excludedJoints?.length ? r.excludedJoints.map(jointLabel).join(", ") : t.none],
    [t.allowedSessions, r?.allowedSessionTypes?.length ? r.allowedSessionTypes.map(sessionTypeName).join(", ") : t.all],
    ...(r?.notes ? [[t.limitNotes, r.notes] as [string, string]] : []),
    ...(scat ? [[t.scat6, scat] as [string, string]] : []),
  ] : [];

  return <RolePage testID="doctor-exam-page" title={t.examPage} onBack={back} onRefresh={exam.refresh}>
    {(!id || !fighterId) ? <EmptyLine title={t.notFound}/> : null}
    {!e && exam.loading ? <ActivityIndicator color={c.lotus} style={{ paddingVertical: 32 }}/> : null}
    {!e && !exam.loading && exam.error ? <RetryRow message={detailError(exam.error) || t.examsError} retry={t.retry} onRetry={() => void exam.reload()}/> : null}
    {e && w ? <StaggerList gap={16}>
      <View style={{ gap: 2 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ fontFamily: fonts.displayExtraBold, fontSize: fz(26), lineHeight: lh(30), textTransform: "uppercase", color: c.ink }}>{examTypeText(e) || t.examFallback}</Text>
        <Text numberOfLines={1} style={{ ...readableTextStyle(14), color: c.ink }}>{examSubline(e, f ? fighterName(f) : "")}</Text>
      </View>
      <SlipRow testID="exam-decision" lead={w.mark} leadTone={w.tone} title={w.word} line={det?.followUpDate ? t.followUpLine(vnDate(det.followUpDate)) : e.validUntil ? t.validUntil(vnDate(e.validUntil)) : t.noEffect}
        a11y={`${w.word}, ${det?.followUpDate ? t.followUpLine(vnDate(det.followUpDate)) : e.validUntil ? t.validUntil(vnDate(e.validUntil)) : t.noEffect}`} last/>
      {!det ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{t.legacy}</Text> : null}
      {v ? <View style={{ gap: 8 }}>
        <EvHead title={t.vitals}/>
        <Strip testID="exam-vitals" cells={[
          { value: num(v.weightKg, 1), unit: t.unitKg, label: doctor.exam.weight },
          { value: num(v.restingHeartRate), label: doctor.exam.heart },
          { value: `${num(v.bloodPressureSystolic)}/${num(v.bloodPressureDiastolic)}`, label: doctor.exam.bloodPressure },
        ]}/>
        <View style={{ marginTop: -9 }}>
          <Strip cells={[
            { value: num(v.temperatureC, 1), unit: t.unitC, label: doctor.exam.temperature },
            { value: num(v.spo2Pct), unit: t.unitPct, label: doctor.exam.spo2 },
            { value: (doctor.exam.hydrationLevel as Record<string, string>)[v.hydration] ?? "–", label: doctor.exam.hydration },
          ]}/>
        </View>
      </View> : null}
      {areas.length ? <View style={{ gap: 8 }}>
        <EvHead title={t.areas}/>
        <View testID="exam-areas">{areas.map((a, i) => {
          const word = (doctor.exam.assessment as Record<string, string>)[a.result] ?? "–";
          const ok = a.result === "NORMAL";
          const title = assessmentAreaLabel(a.area);
          return <SlipRow key={`${a.area}-${i}`} testID={`area-${i}`} lead={ok ? "✓" : "!"} leadTone={ok ? "ok" : a.result === "ABNORMAL" ? "warn" : "dim"} title={title}
            word={word} wordTone={ok ? "ok" : a.result === "ABNORMAL" ? "warn" : undefined} line={a.note ?? undefined}
            a11y={[title, word, a.note ?? ""].filter(Boolean).join(", ")} last={i === areas.length - 1}/>;
        })}</View>
      </View> : null}
      <View style={{ gap: 8 }}>
        <EvHead title={t.limits}/>
        <View testID="exam-limits">{facts.map(([l, val], i) => <Fact key={l} label={l} value={val} last={i === facts.length - 1}/>)}</View>
      </View>
      {det?.recommendations ? <View style={{ gap: 8 }}><EvHead title={t.advice}/><Prose text={det.recommendations}/></View> : null}
      {e.reason ? <View style={{ gap: 8 }}><EvHead title={t.note}/><Prose text={e.reason}/></View> : null}
    </StaggerList> : null}
    {exam.data && !exam.data.exam ? <EmptyLine testID="exam-missing" title={t.notFound}/> : null}
  </RolePage>;
}
