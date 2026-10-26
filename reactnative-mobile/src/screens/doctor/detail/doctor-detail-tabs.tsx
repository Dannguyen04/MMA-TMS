import { useCallback, useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { doctorRoApi } from "@/api/doctor-ro";
import type { MedicalDossier, MedicalExamination, MedicalHistoryEntry, MedicalHistoryRecordType as RecordType } from "@/api/types";
import {
  clearanceTypeLabel,
  decisionLabel,
  jointLabel,
  recordTypeLabel,
  requesterRoleLabel,
  scopeLabel,
  sessionTypeName,
} from "@/components/medical/medical-format";
import { doctorRo } from "@/i18n/doctor-ro";
import { medical } from "@/i18n/medical";
import { doctor } from "@/i18n/doctor";
import { eligibilityReasonLabel } from "@/components/medical/medical-format";
import { vnDate } from "@/screens/coach/readonly/ro-format";
import { LoadMore, ProgressBar, RowSkeletons, StatusChip, Stack } from "@/screens/coach/readonly/ro-ui";
import { usePagedList } from "@/screens/coach/readonly/use-paged-list";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useLoad } from "@/screens/fighter/use-load";

import { currentClearances, DECISION_CHIP, detailError, expiresSoon, groupByMonth, historyDot, historySummary, planProgress, planStatusText, severityText, vnDayMonth } from "./detail-format";
import { FilterChips, Line, SectionCard } from "./detail-ui";
import { BodyMapSection, bodyText } from "@/components/body3d/body-map-section";
import { jointStateLabel } from "@/components/medical/medical-format";
import { AiAlertsBlock } from "@/screens/video-ai/ai-ui";
import { RevokeClearanceButton } from "@/screens/one-tap/status-actions";

const jointStateText = (s: string) => jointStateLabel(s);

const t = doctorRo.detail2;
export const WIDE_MIN = 768;
type Load<T> = { data: T | null; error: string; loading: boolean; reload: () => unknown; refresh: () => Promise<void> };
export type Bind = (key: string, fn: (() => Promise<unknown>) | null) => void;

function Divider() {
  const p = useFighterPalette();
  return <View style={{ height: 1, backgroundColor: p.line }} />;
}

/* ───────────── Tổng quan ───────────── */

export function OverviewTab({ fighterId, dossier, enabled, onSeeAllAi }: { fighterId: string; dossier: Load<MedicalDossier>; enabled: boolean; onSeeAllAi?: () => void }) {
  const p = useFighterPalette();
  const wide = useWindowDimensions().width >= WIDE_MIN;
  const summary = useLoad(enabled && !!fighterId, `summary:${fighterId}`, useCallback(() => doctorRoApi.getMedicalSummary(fighterId), [fighterId]), { keepOnError: true });
  const doctors = useLoad(enabled && !!fighterId, `doctors:${fighterId}`, useCallback(() => doctorRoApi.listDoctors(fighterId, { limit: 50 }), [fighterId]), { keepOnError: true });
  const d = dossier.data;
  const dl = dossier.loading && !d;
  const de = d ? "" : detailError(dossier.error);
  const common = { loading: dl, error: de, onRetry: () => void dossier.reload() };
  const elig = d?.eligibility;
  const blocked = !!elig && (!elig.training.eligible || !elig.competition.eligible);
  const clear = d ? currentClearances(d.activeClearances) : [];
  const currentDoctors = (doctors.data?.data ?? []).filter((a) => !a.endsAt || Date.parse(a.endsAt) > Date.now());

  const doctorsCard = (
    <SectionCard
      title={t.doctors}
      loading={doctors.loading && !doctors.data}
      error={doctors.data ? "" : detailError(doctors.error)}
      onRetry={() => void doctors.reload()}
      empty={currentDoctors.length === 0}
      emptyText={t.noDoctors}
    >
      {currentDoctors.map((a) => (
        <View key={a.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <Text style={[TEXT.body, { color: p.ink }]}>{a.doctorName || t.doctorFallback}</Text>
          <Text style={[TEXT.detail, { color: p.ink }]}>{t.since(vnDate(a.startsAt))}</Text>
        </View>
      ))}
    </SectionCard>
  );

  // Hồ sơ y tế lỗi (chưa có dữ liệu): một thẻ lỗi thay cho 5 thẻ cùng báo một lỗi.
  if (de && !dl) {
    return (
      <Stack>
        <SectionCard title={doctorRo.detail.medical} loading={false} error={de} onRetry={common.onRetry} empty={false} emptyText="" />
        {doctorsCard}
      </Stack>
    );
  }

  const left = (
    <>
      <SectionCard title={t.eligibility} {...common} empty={!elig} emptyText={medical.unknownReason} tone={blocked ? "error" : undefined}>
        {elig
          ? ([["training", t.training], ["competition", t.competition]] as const).map(([k, label]) => {
              const e = elig[k];
              return (
                <View key={k} style={{ gap: 4 }}>
                  <Text style={[TEXT.bodyBold, { color: e.eligible ? p.ink : p.danger }]}>
                    {`${label}: ${e.eligible ? t.eligible : t.notEligible}`}
                  </Text>
                  {e.eligible ? null : e.reasons.length ? e.reasons.map((r) => <Line key={r}>{`• ${eligibilityReasonLabel(r)}`}</Line>) : <Line>{`• ${medical.unknownReason}`}</Line>}
                </View>
              );
            })
          : null}
      </SectionCard>

      <SectionCard
        title={bodyText.title}
        loading={summary.loading && !summary.data}
        error={summary.data ? "" : detailError(summary.error)}
        onRetry={() => void summary.reload()}
        empty={false}
        emptyText=""
      >
        {summary.data ? (
          <BodyMapSection
            injuries={summary.data.activeInjuries}
            jointStates={summary.data.jointStates}
            stateText={jointStateText}
            severityText={severityText}
            height={wide ? 460 : 380}
          />
        ) : null}
      </SectionCard>

      <SectionCard title={t.clearance} {...common} empty={clear.length === 0} emptyText={t.noClearance}>
        {clear.map((c) => (
          <View key={c.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Text style={[TEXT.bodyBold, { color: p.ink }]}>{clearanceTypeLabel(c.clearanceType)}</Text>
              {expiresSoon(c.validUntil) ? <StatusChip spec={{ label: t.expiringSoon, tone: "attention", icon: "schedule" }} /> : null}
            </View>
            <Line>{t.validRange(vnDate(c.validFrom), vnDate(c.validUntil))}</Line>
            {c.notes ? <Line>{c.notes}</Line> : null}
            <RevokeClearanceButton clearanceId={c.id} training={c.clearanceType === "TRAINING"} onDone={() => void dossier.reload()} />
          </View>
        ))}
      </SectionCard>

      <AiAlertsBlock fighterId={fighterId} enabled={enabled} onSeeAll={onSeeAllAi ?? (() => undefined)} />
    </>
  );
  const right = (
    <>
      <SectionCard title={t.injuries} {...common} empty={!d?.activeInjuries.length} emptyText={t.noInjuries}>
        {d?.activeInjuries.map((i, n) => (
          <View key={i.id} style={{ gap: 4 }}>
            {n > 0 ? <Divider /> : null}
            <Text style={[TEXT.bodyBold, { color: p.ink }]}>{`${i.injuryType} · ${jointLabel(i.affectedJoint)}`}</Text>
            <Line>{t.injuryMeta(severityText(i.severity), vnDate(i.occurredAt))}</Line>
          </View>
        ))}
      </SectionCard>

      <SectionCard title={t.recovery} {...common} empty={!d?.activeRecoveryPlans.length} emptyText={t.noRecovery}>
        {d?.activeRecoveryPlans.map((r) => {
          const pr = planProgress(r);
          return (
            <View key={r.id} style={{ gap: 6 }}>
              <Text style={[TEXT.bodyBold, { color: p.ink }]}>{r.title}</Text>
              <Line>{t.recoveryMeta(`${vnDayMonth(r.startDate)} – ${vnDate(r.estimatedEndDate)}`, planStatusText(r.status))}</Line>
              {pr.total ? (
                <>
                  <ProgressBar pct={pr.pct} />
                  <Line>{t.milestones(pr.done, pr.total)}</Line>
                </>
              ) : null}
            </View>
          );
        })}
      </SectionCard>

      <SectionCard
        title={t.reviews}
        {...common}
        badge={d?.openReviewRequests.length ? <StatusChip spec={{ label: t.reviewsOpen(d.openReviewRequests.length), tone: "attention", icon: "alertCircle" }} /> : undefined}
        empty={!d?.openReviewRequests.length}
        emptyText={t.noReviews}
      >
        {d?.openReviewRequests.map((r) => (
          <View key={r.id} style={{ gap: 4 }}>
            <Line>{t.reviewBy(requesterRoleLabel(r.requesterRole), vnDate(r.requestedAt))}</Line>
            <Text style={[TEXT.body, { color: p.ink }]}>{`“${r.reason}”`}</Text>
          </View>
        ))}
      </SectionCard>

      {doctorsCard}
    </>
  );
  if (wide) {
    return (
      <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
        <View style={{ flex: 1, gap: 16 }}>{left}</View>
        <View style={{ flex: 1, gap: 16 }}>{right}</View>
      </View>
    );
  }
  return (
    <Stack>
      {left}
      {right}
    </Stack>
  );
}

/* ───────────── Khám ───────────── */

type Scope = "ALL" | "TRAINING" | "COMPETITION";

function ExamCard({ e }: { e: MedicalExamination }) {
  const p = useFighterPalette();
  const [open, setOpen] = useState(false);
  const det = e.details;
  const r = e.restrictions;
  const v = det?.vitals;
  const vitals = v
    ? [
        v.weightKg != null ? `${doctor.exam.weight} ${v.weightKg} kg` : "",
        v.restingHeartRate != null ? `${doctor.exam.heart} ${v.restingHeartRate}` : "",
        v.bloodPressureSystolic != null && v.bloodPressureDiastolic != null ? `${doctor.exam.bloodPressure} ${v.bloodPressureSystolic}/${v.bloodPressureDiastolic}` : "",
        v.temperatureC != null ? `${doctor.exam.temperature} ${v.temperatureC}°C` : "",
        v.spo2Pct != null ? `${doctor.exam.spo2} ${v.spo2Pct}%` : "",
      ].filter(Boolean)
    : [];
  const hasMore = !!e.reason || !!r?.notes || vitals.length > 0 || !!det?.assessments?.length || !!det?.recommendations;
  return (
    <View style={{ borderWidth: 1, borderColor: p.line, borderRadius: 12, padding: 16, gap: 6, backgroundColor: p.surface }}>
      <View style={{ flexDirection: "row", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <Text style={[TEXT.bodyBold, { color: p.ink, flexShrink: 1 }]}>{t.examTitle(scopeLabel(e.scope), e.sequenceNo)}</Text>
        <StatusChip spec={DECISION_CHIP[e.decision] ?? { label: decisionLabel(e.decision), tone: "neutral", icon: "info" }} />
      </View>
      <Line>
        {[vnDate(e.examinedAt), det?.examinationType ? (doctor.exam.types as Record<string, string>)[det.examinationType] ?? "" : "", det?.followUpDate ? t.followUp(vnDate(det.followUpDate)) : "", e.validUntil ? t.validUntil(vnDate(e.validUntil)) : ""]
          .filter(Boolean)
          .join(" · ")}
      </Line>
      {r?.excludedJoints?.length ? <Line label={t.avoidJoints}>{r.excludedJoints.map(jointLabel).join(", ")}</Line> : null}
      {r?.allowedSessionTypes?.length ? <Line label={t.allowedSessions}>{r.allowedSessionTypes.map(sessionTypeName).join(", ")}</Line> : null}
      {open ? (
        <View style={{ gap: 4 }}>
          {e.reason ? <Line label={t.reason}>{e.reason}</Line> : null}
          {r?.notes ? <Line label={t.restrictionNotes}>{r.notes}</Line> : null}
          {vitals.length ? <Line label={doctor.exam.vitals}>{vitals.join(" · ")}</Line> : null}
          {det?.assessments?.map((a, i) => (
            <Line key={i} label={a.area}>{[(doctor.exam.assessment as Record<string, string>)[a.result] ?? "", a.note ?? ""].filter(Boolean).join(" · ")}</Line>
          ))}
          {det?.recommendations ? <Line label={doctor.exam.recommendations}>{det.recommendations}</Line> : null}
        </View>
      ) : null}
      {hasMore ? (
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ minHeight: 48, justifyContent: "center", alignSelf: "flex-end" }}>
          <Text style={[TEXT.bodyBold, { color: p.link }]}>{open ? t.showLess : `${t.showMore} ›`}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ExamsTab({ fighterId, enabled, bind }: { fighterId: string; enabled: boolean; bind: Bind }) {
  const p = useFighterPalette();
  const [scope, setScope] = useState<Scope>("ALL");
  const on = enabled && !!fighterId;
  const reviews = useLoad(on, `rr:${fighterId}`, useCallback(() => doctorRoApi.listReviewRequests(fighterId, { status: "OPEN", limit: 20 }), [fighterId]), { keepOnError: true });
  const exams = usePagedList<MedicalExamination>(on, `ex:${fighterId}:${scope}`, (page) =>
    doctorRoApi.listExaminations(fighterId, { page, limit: 20, ...(scope === "ALL" ? {} : { scope }) }),
  );
  bind("exams", async () => Promise.all([reviews.refresh(), exams.refresh()]));
  const open = reviews.data?.data ?? [];
  return (
    <Stack>
      {open.length || reviews.error ? (
        <SectionCard title={t.openRequests} loading={false} error={reviews.data ? "" : detailError(reviews.error)} onRetry={() => void reviews.reload()} empty={false} emptyText="">
          {open.map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <Line>{t.reviewBy(requesterRoleLabel(r.requesterRole), vnDate(r.requestedAt))}</Line>
              <Text style={[TEXT.body, { color: p.ink }]}>{`“${r.reason}”`}</Text>
            </View>
          ))}
        </SectionCard>
      ) : null}
      <FilterChips
        label={medical.scope.TRAINING}
        value={scope}
        onChange={setScope}
        items={[
          { key: "ALL", label: t.filterAll },
          { key: "TRAINING", label: medical.scope.TRAINING },
          { key: "COMPETITION", label: medical.scope.COMPETITION },
        ]}
      />
      <PagedBody list={exams} emptyText={scope === "ALL" ? t.noExams : t.noExamsScope}>
        {exams.items.map((e) => <ExamCard key={e.id} e={e} />)}
      </PagedBody>
    </Stack>
  );
}

function PagedBody({ list, emptyText, children }: { list: ReturnType<typeof usePagedList<{ id: string }>>; emptyText: string; children: React.ReactNode }) {
  const p = useFighterPalette();
  if (!list.loaded || (list.loading && list.items.length === 0)) return <RowSkeletons count={2} height={96} />;
  if (list.error && list.items.length === 0)
    return <SectionCard title={emptyText} loading={false} error={detailError(list.error)} onRetry={() => void list.reload()} empty={false} emptyText="" />;
  if (list.items.length === 0) return <Text style={[TEXT.body, { color: p.ink, paddingVertical: 8 }]}>{emptyText}</Text>;
  return (
    <>
      {children}
      {list.hasNext ? <LoadMore onPress={list.loadMore} loading={list.loadingMore} /> : null}
    </>
  );
}

/* ───────────── Hồ sơ ───────────── */

type HistRow = MedicalHistoryEntry & { id: string };
const TYPES: RecordType[] = ["INJURY", "MEDICAL_EXAMINATION", "MEDICAL_CLEARANCE", "RECOVERY_PLAN", "TREATMENT", "MEDICAL_REVIEW_REQUEST"];

export function HistoryTab({ fighterId, enabled, bind }: { fighterId: string; enabled: boolean; bind: Bind }) {
  const p = useFighterPalette();
  const [type, setType] = useState<"ALL" | RecordType>("ALL");
  const list = usePagedList<HistRow>(enabled && !!fighterId, `hist:${fighterId}:${type}`, async (page) => {
    const res = await doctorRoApi.listHistory(fighterId, { page, limit: 20, ...(type === "ALL" ? {} : { recordType: type }) });
    return { ...res, data: res.data.map((e) => ({ ...e, id: `${e.recordType}:${e.recordId}:${e.revision}` })) };
  });
  bind("history", list.refresh);
  const groups = groupByMonth(list.items, (r) => r.recordedAt);
  return (
    <Stack>
      <FilterChips label={medical.recordType.INJURY} value={type} onChange={setType} items={[{ key: "ALL", label: t.filterAll }, ...TYPES.map((k) => ({ key: k, label: recordTypeLabel(k) }))]} />
      <PagedBody list={list} emptyText={type === "ALL" ? t.noHistory : t.noHistoryType}>
        {groups.map((g) => (
          <View key={g.label} style={{ gap: 8 }}>
            <Text style={[TEXT.bodyBold, { color: p.ink }]} accessibilityRole="header">{g.label}</Text>
            {g.rows.map((r) => {
              const tone = historyDot(r);
              const summary = historySummary(r);
              return (
                <View key={r.id} style={{ flexDirection: "row", gap: 12 }} accessible accessibilityLabel={`${recordTypeLabel(r.recordType)}, ${vnDate(r.recordedAt)}${summary ? `, ${summary}` : ""}`}>
                  <View style={{ width: 12, height: 12, borderRadius: 6, marginTop: 6, backgroundColor: p[tone] }} />
                  <View style={{ flex: 1, gap: 2, paddingBottom: 8 }}>
                    <Text style={[TEXT.bodyBold, { color: p.ink }]}>{recordTypeLabel(r.recordType)}</Text>
                    <Line>{[vnDayMonth(r.recordedAt), summary].filter(Boolean).join(" · ")}</Line>
                  </View>
                </View>
              );
            })}
          </View>
        ))}
      </PagedBody>
    </Stack>
  );
}
