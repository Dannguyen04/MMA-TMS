import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  assignApplicationCoach,
  decideApplication,
  getApplication,
  resendActivationEmail,
  type StaffApplication,
} from "@/api/admissions";
import { isApiError } from "@/api/errors";
import { assignFighterCoach, getUser, listFighterCoaches, listUsers, type CoachAssignment, type PublicUser } from "@/api";
import { assignDoctorHref, fighterIdFromActivatedUser } from "@/clinical/assign-doctor-link";
import { confirmDestructive } from "@/components/confirm";
import { Icon } from "@/components/icon";
import { hapticSuccess, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";
import { useToastMessage } from "@/components/toast/app-toast";
import { manager } from "@/i18n/manager";
import { states } from "@/i18n/unavailable";
import { vi } from "@/i18n/vi";
import { applicantName, formatDay } from "@/screens/admin/admin-applications";
import { useAdminType } from "@/screens/admin/admin-page";
import {
  AdminButton,
  AdminButtonRow,
  AdminCard,
  AdminChoiceList,
  AdminField,
  AdminFieldPair,
  AdminInput,
  AdminNotice,
  AdminRow,
  AdminScreen,
  AdminSection,
  AdminSegments,
  ApplicationStatusPill,
  Initials,
} from "@/screens/admin/admin-ui";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, useThemePreference } from "@/theme";

const t = manager.detail;
type Tab = "overview" | "coach" | "decision";
const TABS: readonly { value: Tab; label: string }[] = [
  { value: "overview", label: t.tabs[0] },
  { value: "coach", label: t.tabs[1] },
  { value: "decision", label: t.tabs[2] },
];

/** Tab mở mặc định theo trạng thái (Figma: Đạt test/Đã duyệt → Quyết định, Đã kích hoạt → Gán HLV). */
export function defaultTab(status: StaffApplication["status"]): Tab {
  if (status === "SUBMITTED") return "overview";
  if (status === "ACTIVATED") return "coach";
  return "decision";
}

function userName(user: PublicUser): string {
  const p = user.profile;
  return p && "firstName" in p ? `${p.lastName} ${p.firstName}`.trim() : user.email;
}

function profileId(user: PublicUser): string | null {
  return user.profile && typeof user.profile.id === "string" ? user.profile.id : null;
}

/** Figma "Manager · Chi tiết hồ sơ" + 6 trạng thái (161:19062, 19636–20051). */
export function AdminApplicationDetailScreen({ id }: { id: string }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const router = useRouter();
  const [item, setItem] = useState<StaffApplication | null>(null);
  const [tab, setTab] = useState<Tab | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [coaches, setCoaches] = useState<PublicUser[]>([]);
  const [coachId, setCoachId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [resent, setResent] = useState(false);
  const [fighterId, setFighterId] = useState<string | null>(null);
  const [fighterLookup, setFighterLookup] = useState<"idle" | "loading" | "missing">("idle");
  const [training, setTraining] = useState<CoachAssignment[]>([]);
  const [trainingCoachId, setTrainingCoachId] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");

  const load = useCallback(
    (mode: "initial" | "refresh" = "initial") =>
      getApplication(id)
        .then((next) => {
          setItem(next);
          setTab((current) => current ?? defaultTab(next.status));
          setError("");
        })
        .catch((cause: unknown) => {
          if (mode === "refresh") throw cause;
          setError(mapApiMessage(cause));
        }),
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void listUsers({ role: "COACH", status: "ACTIVE", page: 1, limit: 100 })
      .then((page) => setCoaches(page.items.filter((row) => profileId(row))))
      .catch(() => setCoaches([]));
  }, []);

  useEffect(() => {
    if (item?.status !== "ACTIVATED") {
      setFighterId(null);
      setFighterLookup("idle");
      return;
    }
    let cancelled = false;
    setFighterLookup("loading");
    void getUser(item.guestUserId)
      .then((user) => {
        if (cancelled) return;
        const next = fighterIdFromActivatedUser(user);
        setFighterId(next);
        setFighterLookup(next ? "idle" : "missing");
      })
      .catch(() => {
        if (!cancelled) setFighterLookup("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [item?.guestUserId, item?.status]);

  useEffect(() => {
    if (!fighterId) {
      setTraining([]);
      return;
    }
    void listFighterCoaches(fighterId)
      .then(setTraining)
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [fighterId]);

  const coachName = useMemo(() => {
    const byProfile = new Map(coaches.map((row) => [profileId(row) ?? "", row]));
    return (profile: string | null | undefined) => {
      if (!profile) return null;
      const user = byProfile.get(profile);
      return user ? userName(user) : profile;
    };
  }, [coaches]);

  const run = (work: () => Promise<unknown>, done: string, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    setError("");
    void work()
      .then(() => {
        setNotice(done);
        hapticSuccess();
        after?.();
        void load();
      })
      .catch((cause: unknown) => {
        setError(mapApiMessage(cause));
        if (isApiError(cause) && cause.status === 409) void load();
      })
      .finally(() => setBusy(false));
  };

  if (!item) {
    return (
      <AdminScreen onRefresh={() => load("refresh")} title={t.title}>
        {error ? (
          <StateView kind="error" title={states.loadFailed} description={error} actionLabel={states.retry} onAction={load} />
        ) : (
          <SkeletonList rows={5} height={72} />
        )}
      </AdminScreen>
    );
  }

  const name = applicantName(item);
  const status = item.status;
  const currentTab = tab ?? defaultTab(status);
  const activeTraining = training.filter((row) => row.endsAt == null);
  const doctorHref = assignDoctorHref(fighterId);

  const onApprove = () =>
    run(() => decideApplication(id, { decision: "APPROVED", reason: decisionReason.trim() }), t.approved);

  const onReject = () => {
    void confirmDestructive({
      title: t.rejectConfirmTitle,
      message: t.rejectConfirmBody,
      confirmLabel: t.reject,
      cancelLabel: manager.users.cancel,
    }).then((ok) => {
      if (ok) run(() => decideApplication(id, { decision: "REJECTED", reason: decisionReason.trim() }), t.rejected);
    });
  };

  let footer: ReactNode = null;
  if (currentTab === "overview" && status === "SUBMITTED") {
    footer = <AdminButton title={t.assignReviewerCta} onPress={() => setTab("coach")} />;
  } else if (currentTab === "coach" && status === "SUBMITTED") {
    footer = (
      <AdminButton
        title={t.assignCoach}
        loading={busy}
        disabled={!coachId}
        onPress={() =>
          run(
            () => assignApplicationCoach(id, { coachId, reassignmentReason: assignReason.trim() || undefined }),
            t.assigned,
            () => setAssignReason(""),
          )
        }
      />
    );
  } else if (currentTab === "coach" && status === "ACTIVATED" && fighterId) {
    footer = (
      <AdminButton
        title={t.trainingCta}
        loading={busy}
        disabled={!trainingCoachId}
        onPress={() =>
          run(
            () =>
              assignFighterCoach(fighterId, { coachId: trainingCoachId }).then((row) => {
                setTraining((current) => [row, ...current.filter((other) => other.id !== row.id)]);
              }),
            t.trainingDone,
          )
        }
      />
    );
  } else if (currentTab === "decision" && status === "PASSED") {
    const blocked = busy || !decisionReason.trim();
    footer = (
      <>
        <Text style={[at.meta, { color: colors.inkMuted }]}>{t.approveNote}</Text>
        <AdminButtonRow>
          <AdminButton title={t.reject} variant="danger" disabled={blocked} onPress={onReject} />
          <AdminButton title={t.approve} disabled={blocked} loading={busy} onPress={onApprove} />
        </AdminButtonRow>
      </>
    );
  } else if (currentTab === "decision" && status === "APPROVED") {
    footer = (
      <AdminButton
        title={t.resend}
        icon="mail"
        variant="outline"
        loading={busy}
        onPress={() => run(() => resendActivationEmail(id), t.resent, () => setResent(true))}
      />
    );
  }

  return (
    <AdminScreen title={t.title} footer={footer} onRefresh={() => load("refresh")}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Initials name={name} size={56} />
          <View style={styles.flex}>
            <Text style={[at.name, { color: colors.ink }]} numberOfLines={2}>{name}</Text>
            <Text style={[at.meta, { color: colors.inkMuted }]}>{manager.list.submittedOn(formatDay(item.submittedAt))}</Text>
          </View>
        </View>
        <ApplicationStatusPill status={status} />
      </View>

      <AdminSegments options={TABS} value={currentTab} onChange={setTab} />

      {currentTab === "overview" ? (
        <>
          <AdminSection title={t.applicant}>
            <AdminCard>
              <AdminField label={t.contactEmail} value={item.applicant.email} />
              <AdminField label={t.accountEmail} value={item.accountEmail ?? t.none} />
              <AdminField label={t.phone} value={item.applicant.contactPhone ?? t.none} />
              <AdminFieldPair>
                <AdminField label={t.dob} value={formatDay(item.applicant.dateOfBirth)} />
                <AdminField label={t.nationality} value={item.applicant.nationality ?? t.none} />
              </AdminFieldPair>
              <AdminField label={t.weightClass} value={vi.weightClass[item.applicant.weightClass] ?? item.applicant.weightClass} />
            </AdminCard>
          </AdminSection>
          <AdminSection title={t.background}>
            <AdminCard>
              <AdminField label={t.training} value={item.applicant.trainingBackground ?? t.none} />
              <AdminField label={t.competition} value={item.applicant.competitionBackground ?? t.none} />
              <AdminField label={t.motivation} value={item.applicant.motivation ?? t.none} />
            </AdminCard>
          </AdminSection>
          <AdminSection title={t.progress}>
            <AdminCard>
              <AdminField label={t.reviewer} value={coachName(item.currentAssignment?.coachId) ?? t.notAssigned} />
              <AdminField
                label={t.assessment}
                value={item.assessment ? (item.assessment.conclusion === "PASS" ? t.pass : t.fail) : t.noResult}
              />
              <AdminField
                label={t.decision}
                value={item.decision ? (item.decision.decision === "APPROVED" ? t.approvedText : t.rejectedText) : t.noDecision}
              />
              <AdminField
                label={t.activation}
                value={item.activation ? t.activationStatus[item.activation.status] : t.notActivated}
              />
            </AdminCard>
            <AdminNotice icon="alertCircle" title={t.nextStep} body={t.next[status]} />
          </AdminSection>
        </>
      ) : null}

      {currentTab === "coach" && status !== "ACTIVATED" ? (
        <>
          <AdminSection title={t.reviewerTitle} hint={t.reviewerHint}>
            <AdminCard>
              <AdminField label={t.currentAssignment} value={coachName(item.currentAssignment?.coachId) ?? t.noReviewer} />
            </AdminCard>
          </AdminSection>
          {status === "SUBMITTED" ? (
            <>
              <AdminSection title={t.pickCoach} hint={t.activeCoaches}>
                {coaches.length === 0 ? (
                  <Text style={[at.meta, { color: colors.inkMuted }]}>{t.noCoaches}</Text>
                ) : (
                  <AdminChoiceList
                    value={coachId}
                    onChange={setCoachId}
                    options={coaches.map((row) => ({ id: profileId(row) ?? row.id, title: userName(row), subtitle: row.email }))}
                  />
                )}
              </AdminSection>
              <AdminInput
                label={t.reasonOptional}
                placeholder={t.reasonPlaceholder}
                value={assignReason}
                onChangeText={setAssignReason}
                maxLength={2000}
                multiline
              />
              <AdminNotice icon="info" body={t.reviewerNote} />
            </>
          ) : (
            <AdminNotice icon="lock" body={t.reviewerLocked} />
          )}
        </>
      ) : null}

      {currentTab === "coach" && status === "ACTIVATED" ? (
        <>
          <AdminSection title={t.trainingTitle} hint={t.trainingHint}>
            <AdminCard>
              <AdminField
                label={t.trainingCurrent}
                value={
                  activeTraining.length > 0
                    ? activeTraining.map((row) => row.coachName ?? coachName(row.coachId) ?? row.coachId).join(", ")
                    : t.trainingNone
                }
              />
            </AdminCard>
            {fighterLookup === "loading" ? <SkeletonList rows={2} height={56} /> : null}
            {fighterLookup === "missing" ? <AdminNotice icon="alertCircle" body={t.fighterMissing} /> : null}
            {fighterId && coaches.length > 0 ? (
              <AdminChoiceList
                value={trainingCoachId}
                onChange={setTrainingCoachId}
                options={coaches.map((row) => ({ id: profileId(row) ?? row.id, title: userName(row), subtitle: row.email }))}
              />
            ) : null}
            <AdminNotice icon="stethoscope" title={t.baselineTitle} body={t.baselineBody} />
          </AdminSection>
          {doctorHref ? (
            <AdminRow
              icon="stethoscope"
              title={t.assignDoctor}
              subtitle={`${name} · ${t.assignDoctorSub}`}
              onPress={() => router.push(`${doctorHref}&applicationId=${encodeURIComponent(id)}` as Href)}
              last
            />
          ) : null}
          <AssessmentBlock item={item} coachName={coachName} />
        </>
      ) : null}

      {currentTab === "decision" ? (
        <>
          {item.decision ? (
            <AdminSection title={t.decided}>
              <AdminCard>
                <AdminField label={t.decisionLabel} value={item.decision.decision === "APPROVED" ? t.approvedText : t.rejectedText} />
                <AdminField label={t.decidedAt} value={formatDay(item.decision.decidedAt)} />
                <AdminField label={t.reason} value={item.decision.reason} />
              </AdminCard>
            </AdminSection>
          ) : null}

          {status === "APPROVED" || status === "ACTIVATED" ? (
            <AdminSection title={t.activation} hint={status === "APPROVED" ? t.activationWait : undefined}>
              <AdminCard>
                <AdminField label={t.accountEmail} value={item.accountEmail ?? item.applicant.email} />
                <AdminField
                  label={t.accountStatus}
                  value={item.activation ? t.activationStatus[item.activation.status] : t.notActivated}
                />
              </AdminCard>
              {resent ? <AdminNotice icon="mail" title={t.resent} body={t.resentBody} /> : null}
            </AdminSection>
          ) : null}

          {status === "PASSED" ? (
            <AdminSection title={t.decisionTitle} hint={t.decisionHint}>
              <AdminInput
                label={t.reason}
                placeholder={t.reasonDecision}
                value={decisionReason}
                onChangeText={setDecisionReason}
                maxLength={2000}
                multiline
              />
            </AdminSection>
          ) : null}
          {status === "SUBMITTED" ? <AdminNotice icon="lock" body={t.decisionLocked} /> : null}
          {status === "FAILED" ? <AdminNotice icon="xCircle" tone="danger" body={t.failedLocked} /> : null}

          {status !== "ACTIVATED" ? <AssessmentBlock item={item} coachName={coachName} withCriteria /> : null}
          {status === "PASSED" ? <AdminNotice icon="alertCircle" body={t.passNote} /> : null}
          <History item={item} coachName={coachName} />
        </>
      ) : null}
    </AdminScreen>
  );
}

function AssessmentBlock({
  item,
  coachName,
  withCriteria,
}: {
  item: StaffApplication;
  coachName: (id: string | null | undefined) => string | null;
  withCriteria?: boolean;
}) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const a = item.assessment;
  if (!a) return null;
  const pass = a.conclusion === "PASS";
  return (
    <>
      <AdminSection title={t.assessment}>
        <AdminCard>
          <View style={styles.verdict}>
            <Icon name={pass ? "success" : "xCircle"} size={16} tone={pass ? "success" : "danger"} />
            <Text style={[at.metaStrong, { color: pass ? colors.success : colors.danger }]}>{pass ? t.pass : t.fail}</Text>
          </View>
          <AdminField label={t.reviewerDate} value={`${coachName(a.coachId) ?? a.coachId} · ${formatDay(a.assessedAt)}`} />
          <AdminField label={t.summary} value={a.summary} />
        </AdminCard>
      </AdminSection>
      {withCriteria && a.criteria.length > 0 ? (
        <AdminSection title={t.criteria}>
          {a.criteria.map((row, index) => (
            <AdminCard key={`${row.criterionName}-${index}`}>
              <Text style={[at.rowTitle, { color: colors.ink }]}>{row.criterionName}</Text>
              <AdminField label={t.method} value={row.method} />
              <AdminField label={t.observation} value={row.observation} />
              {row.value != null ? <AdminField label={t.valueUnit} value={`${row.value}${row.unit ? ` · ${row.unit}` : ""}`} /> : null}
              {row.note ? <AdminField label={t.note} value={row.note} /> : null}
            </AdminCard>
          ))}
        </AdminSection>
      ) : null}
    </>
  );
}

function History({ item, coachName }: { item: StaffApplication; coachName: (id: string | null | undefined) => string | null }) {
  const { colors } = useThemePreference();
  const at = useAdminType();
  const rows: { key: string; label: string; at: string }[] = [];
  rows.push({ key: "submitted", label: t.hSubmitted, at: item.submittedAt });
  for (const period of item.assignmentHistory) {
    rows.push({ key: `assign-${period.id}`, label: t.hAssigned(coachName(period.coachId) ?? period.coachId), at: period.startsAt });
  }
  if (item.assessment) {
    rows.push({
      key: "assessed",
      label: t.hAssessed(coachName(item.assessment.coachId) ?? item.assessment.coachId, item.assessment.conclusion === "PASS"),
      at: item.assessment.assessedAt,
    });
  }
  if (item.decision) rows.push({ key: "decided", label: t.hDecided(item.decision.decision === "APPROVED"), at: item.decision.decidedAt });
  if (item.activation?.completedAt) rows.push({ key: "activated", label: t.hActivated, at: item.activation.completedAt });
  rows.sort((a, b) => b.at.localeCompare(a.at));
  return (
    <AdminSection title={t.history}>
      {rows.map((row) => (
        <View key={row.key} style={styles.historyRow}>
          <Icon name="success" size={16} tone="muted" />
          <View style={styles.flex}>
            <Text style={[at.body, { color: colors.ink }]}>{row.label}</Text>
            <Text style={[at.meta, { color: colors.inkMuted }]}>{formatDay(row.at)}</Text>
          </View>
        </View>
      ))}
    </AdminSection>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { gap: spacing.md },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  verdict: { flexDirection: "row", alignItems: "center", gap: 6 },
  historyRow: { flexDirection: "row", gap: spacing.md, alignItems: "flex-start" },
});
