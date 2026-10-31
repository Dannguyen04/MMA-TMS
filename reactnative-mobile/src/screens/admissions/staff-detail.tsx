import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  assignApplicationCoach,
  decideApplication,
  getApplication,
  getAssignedApplication,
  resendActivationEmail,
  submitAssessment,
  type AssessmentConclusion,
  type AssessmentCriterion,
  type StaffApplication,
} from "@/api/admissions";
import { isApiError } from "@/api/errors";
import { assignFighterCoach, getUser, listFighterCoaches, listUsers, type CoachAssignment, type PublicUser } from "@/api";
import { assignDoctorHref, fighterIdFromActivatedUser } from "@/clinical/assign-doctor-link";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import { AuthSelectField } from "@/components/auth/auth-select-field";
import { AuthTextField } from "@/components/auth/auth-text-field";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, type, useThemePreference } from "@/theme";

const SUMMARY_MAX = 4000;
const CRITERIA_MAX = 30;

type CriterionDraft = {
  key: string;
  criterionName: string;
  method: string;
  observation: string;
  value: string;
  unit: string;
  note: string;
};

let criterionCounter = 0;

function emptyCriterion(): CriterionDraft {
  criterionCounter += 1;
  return {
    key: `criterion-${criterionCounter}`,
    criterionName: "",
    method: "",
    observation: "",
    value: "",
    unit: "",
    note: "",
  };
}

export function StaffDetailScreen({
  id,
  audience,
}: {
  id: string;
  audience: "admin" | "coach";
}) {
  const { colors } = useThemePreference();
  const [item, setItem] = useState<StaffApplication | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const [coaches, setCoaches] = useState<PublicUser[]>([]);
  const [coachId, setCoachId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [summary, setSummary] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>(() => [emptyCriterion()]);
  const [conclusion, setConclusion] = useState<AssessmentConclusion | "">("");
  const [activatedFighterId, setActivatedFighterId] = useState<string | null>(null);
  const [fighterLookup, setFighterLookup] = useState<"idle" | "loading" | "missing">("idle");
  const [trainingCoachId, setTrainingCoachId] = useState("");
  const [trainingAssignments, setTrainingAssignments] = useState<CoachAssignment[]>([]);

  const patchCriterion = (key: string, patch: Partial<CriterionDraft>) => {
    setCriteria((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const onSubmitAssessment = () => {
    if (!conclusion || !summary.trim()) return;
    const body: AssessmentCriterion[] = [];
    for (const draft of criteria) {
      if (!draft.criterionName.trim() || !draft.method.trim() || !draft.observation.trim()) {
        setError(vi.admission.criteriaIncomplete);
        return;
      }
      let value: number | null = null;
      if (draft.value.trim()) {
        value = Number(draft.value.trim().replace(",", "."));
        if (!Number.isFinite(value)) {
          setError(vi.admission.valueInvalid);
          return;
        }
      }
      body.push({
        criterionName: draft.criterionName.trim(),
        method: draft.method.trim(),
        observation: draft.observation.trim(),
        ...(value != null ? { value } : {}),
        ...(draft.unit.trim() ? { unit: draft.unit.trim() } : {}),
        ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
      });
    }
    setError("");
    run(() => submitAssessment(id, { conclusion, summary: summary.trim(), criteria: body }));
  };

  const load = useCallback(() => {
    const request = audience === "admin" ? getApplication : getAssignedApplication;
    void request(id)
      .then((next) => {
        setItem(next);
        setError("");
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [audience, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (audience !== "admin" || item?.status !== "ACTIVATED") {
      setActivatedFighterId(null);
      setFighterLookup("idle");
      return;
    }
    let cancelled = false;
    setFighterLookup("loading");
    void getUser(item.guestUserId)
      .then((user) => {
        if (cancelled) return;
        const fighterId = fighterIdFromActivatedUser(user);
        setActivatedFighterId(fighterId);
        setFighterLookup(fighterId ? "idle" : "missing");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setActivatedFighterId(null);
        setFighterLookup("missing");
        setError(mapApiMessage(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [audience, item?.guestUserId, item?.status]);

  useEffect(() => {
    if (!activatedFighterId) {
      setTrainingAssignments([]);
      return;
    }
    void listFighterCoaches(activatedFighterId)
      .then(setTrainingAssignments)
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [activatedFighterId]);

  useEffect(() => {
    if (audience !== "admin") return;
    void listUsers({ role: "COACH", status: "ACTIVE", page: 1, limit: 50 })
      .then((page) => setCoaches(page.items))
      .catch(() => setCoaches([]));
  }, [audience]);

  const run = (work: () => Promise<unknown>, done?: string) => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    void work()
      .then(() => {
        if (done) setNotice(done);
        load();
      })
      .catch((cause: unknown) => {
        setError(mapApiMessage(cause));
        if (isApiError(cause) && cause.status === 409) load();
      })
      .finally(() => setBusy(false));
  };

  return (
    <AdmissionPage title={item ? `${item.applicant.lastName} ${item.applicant.firstName}` : vi.admission.title}>
      {item ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.status[item.status]}</Text>
      ) : null}
      {item && (item.status === "FAILED" || item.status === "REJECTED") ? (
        <Text style={[type.body, { color: colors.ink }]}>{vi.admission.failedNoExam}</Text>
      ) : null}
      {item?.currentAssignment ? (
        <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.intakeCoachNotTraining}</Text>
      ) : null}
      {audience === "admin" && item?.status === "ACTIVATED" ? (
        <Text style={[type.body, { color: colors.ink }]}>{vi.admission.activated}</Text>
      ) : null}
      {audience === "admin" && item?.status === "SUBMITTED" ? (
        <>
          {coaches.map((coach) => {
            const profile = coach.profile;
            const optionId = profile && "id" in profile ? profile.id : "";
            if (!optionId) return null;
            const name = profile && "firstName" in profile ? `${profile.lastName} ${profile.firstName}` : coach.email;
            return (
              <Pressable key={coach.id} onPress={() => setCoachId(optionId)}>
                <Text style={[type.body, { color: coachId === optionId ? colors.lotus : colors.ink }]}>{name}</Text>
              </Pressable>
            );
          })}
          <AuthTextField label={vi.admission.reason} helper={vi.admission.optional} value={assignReason} onChangeText={setAssignReason} />
          <AuthButton
            title={vi.admission.assign}
            disabled={busy || !coachId}
            loading={busy}
            onPress={() =>
              run(() =>
                assignApplicationCoach(id, {
                  coachId,
                  reassignmentReason: assignReason.trim() ? assignReason.trim() : undefined,
                }),
              )
            }
          />
        </>
      ) : null}
      {audience === "admin" && item?.status === "PASSED" ? (
        <>
          <AuthTextField label={vi.admission.reason} value={decisionReason} onChangeText={setDecisionReason} />
          <AuthButton
            title={vi.admission.approve}
            disabled={busy || !decisionReason.trim()}
            onPress={() =>
              run(() => decideApplication(id, { decision: "APPROVED", reason: decisionReason.trim() }))
            }
          />
          <AuthButton
            title={vi.admission.reject}
            variant="secondary"
            disabled={busy || !decisionReason.trim()}
            onPress={() =>
              run(() => decideApplication(id, { decision: "REJECTED", reason: decisionReason.trim() }))
            }
          />
        </>
      ) : null}
      {audience === "admin" && item?.status === "APPROVED" ? (
          <AuthButton
            title={vi.admission.resend}
            variant="secondary"
            disabled={busy}
            onPress={() => run(() => resendActivationEmail(id), vi.admission.resent)}
          />
      ) : null}
      {audience === "admin" && item?.status === "ACTIVATED" ? (
        fighterLookup === "loading" ? (
          <Text style={[type.caption, { color: colors.inkMuted }]}>...</Text>
        ) : assignDoctorHref(activatedFighterId) ? (
          <Pressable
            onPress={() => {
              const href = assignDoctorHref(activatedFighterId);
              if (href) router.push(href as Href);
            }}
          >
            <Text style={[type.link, { color: colors.lotus }]}>{vi.admission.assignDoctor}</Text>
          </Pressable>
        ) : (
          <Text style={[type.body, { color: colors.ink }]}>{vi.admission.assignDoctorMissing}</Text>
        )
      ) : null}
      {audience === "admin" && item?.status === "ACTIVATED" && activatedFighterId ? (
        <>
          <Text style={[type.body, { color: colors.ink }]}>{vi.admission.trainingCoachHint}</Text>
          {trainingAssignments
            .filter((row) => row.endsAt == null)
            .map((row) => (
              <Text key={row.id} style={[type.caption, { color: colors.inkMuted }]}>
                {row.coachName ?? row.coachId}
              </Text>
            ))}
          {coaches.map((coach) => {
            const profile = coach.profile;
            const optionId = profile && "id" in profile ? profile.id : "";
            if (!optionId) return null;
            const name = profile && "firstName" in profile ? `${profile.lastName} ${profile.firstName}` : coach.email;
            return (
              <Pressable key={`train-${coach.id}`} onPress={() => setTrainingCoachId(optionId)}>
                <Text style={[type.body, { color: trainingCoachId === optionId ? colors.lotus : colors.ink }]}>{name}</Text>
              </Pressable>
            );
          })}
          <AuthButton
            title={vi.admission.assignTrainingCoach}
            disabled={busy || !trainingCoachId}
            loading={busy}
            onPress={() =>
              run(
                () =>
                  assignFighterCoach(activatedFighterId, { coachId: trainingCoachId }).then((row) => {
                    setTrainingAssignments((current) => [row, ...current.filter((item) => item.id !== row.id)]);
                    return row;
                  }),
                vi.admission.trainingCoachAssigned,
              )
            }
          />
        </>
      ) : null}
      {item?.assessment ? <AssessmentView assessment={item.assessment} /> : null}
      {audience === "coach" && item && !item.assessment && item.status !== "SUBMITTED" ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.assessmentClosed}</Text>
      ) : null}
      {audience === "coach" && item && item.status === "SUBMITTED" && !item.assessment ? (
        <>
          <AuthSelectField
            label={vi.admission.assessment}
            value={conclusion}
            placeholder={vi.admission.assessment}
            options={[
              { value: "PASS", label: vi.admission.pass },
              { value: "FAIL", label: vi.admission.fail },
            ]}
            onChange={setConclusion}
          />
          <AuthTextField
            label={vi.admission.summary}
            value={summary}
            onChangeText={setSummary}
            maxLength={SUMMARY_MAX}
            multiline
          />
          {criteria.map((draft, index) => (
            <View key={draft.key} style={styles.criterion}>
              <Text style={[type.label, { color: colors.inkMuted }]}>
                {vi.admission.criterionIndex} {index + 1}
              </Text>
              <AuthTextField
                label={vi.admission.criterion}
                value={draft.criterionName}
                onChangeText={(value) => patchCriterion(draft.key, { criterionName: value })}
                maxLength={150}
              />
              <AuthTextField
                label={vi.admission.method}
                value={draft.method}
                onChangeText={(value) => patchCriterion(draft.key, { method: value })}
                maxLength={300}
              />
              <AuthTextField
                label={vi.admission.observation}
                value={draft.observation}
                onChangeText={(value) => patchCriterion(draft.key, { observation: value })}
                maxLength={1000}
                multiline
              />
              <AuthTextField
                label={vi.admission.value}
                helper={vi.admission.optional}
                value={draft.value}
                onChangeText={(value) => patchCriterion(draft.key, { value })}
                keyboardType="decimal-pad"
              />
              <AuthTextField
                label={vi.admission.unit}
                helper={vi.admission.optional}
                value={draft.unit}
                onChangeText={(value) => patchCriterion(draft.key, { unit: value })}
                maxLength={30}
              />
              <AuthTextField
                label={vi.admission.note}
                helper={vi.admission.optional}
                value={draft.note}
                onChangeText={(value) => patchCriterion(draft.key, { note: value })}
                maxLength={1000}
                multiline
              />
              {criteria.length > 1 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setCriteria((current) => current.filter((row) => row.key !== draft.key))}
                  style={styles.link}
                >
                  <Text style={[type.link, { color: colors.danger }]}>{vi.admission.removeCriterion}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
          {criteria.length < CRITERIA_MAX ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCriteria((current) => [...current, emptyCriterion()])}
              style={styles.link}
            >
              <Text style={[type.link, { color: colors.lotus }]}>{vi.admission.addCriterion}</Text>
            </Pressable>
          ) : (
            <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.criteriaMax}</Text>
          )}
          <AuthButton
            title={vi.admission.saveAssessment}
            disabled={busy || !conclusion || !summary.trim()}
            loading={busy}
            onPress={onSubmitAssessment}
          />
        </>
      ) : null}
    </AdmissionPage>
  );
}

function AssessmentView({ assessment }: { assessment: NonNullable<StaffApplication["assessment"]> }) {
  const { colors } = useThemePreference();
  return (
    <View style={styles.criterion}>
      <Text style={[type.label, { color: colors.inkMuted }]}>{vi.admission.submittedAssessment}</Text>
      <Text style={[type.body, { color: colors.ink }]}>
        {assessment.conclusion === "PASS" ? vi.admission.pass : vi.admission.fail} ·{" "}
        {vi.admission.assessedAt}: {new Date(assessment.assessedAt).toLocaleDateString("vi-VN")}
      </Text>
      <Text style={[type.body, { color: colors.ink }]}>{assessment.summary}</Text>
      {assessment.criteria.map((row, index) => (
        <View key={`${row.criterionName}-${index}`} style={styles.readRow}>
          <Text style={[type.body, { color: colors.ink }]}>
            {index + 1}. {row.criterionName}
          </Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {vi.admission.method}: {row.method}
          </Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {vi.admission.observation}: {row.observation}
          </Text>
          {row.value != null ? (
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {vi.admission.value}: {row.value}
              {row.unit ? ` ${row.unit}` : ""}
            </Text>
          ) : null}
          {row.note ? (
            <Text style={[type.caption, { color: colors.inkMuted }]}>
              {vi.admission.note}: {row.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  criterion: { gap: spacing.sm, paddingTop: spacing.sm },
  readRow: { gap: 2 },
  link: { minHeight: 44, justifyContent: "center" },
});
