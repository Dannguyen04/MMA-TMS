import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormError } from "@/components/auth/auth-form-error";
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
  const [busy, setBusy] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [assignReason, setAssignReason] = useState("");
  const [decisionReason, setDecisionReason] = useState("");
  const [summary, setSummary] = useState("");
  const [criteria, setCriteria] = useState<CriterionDraft[]>(() => [emptyCriterion()]);
  const [conclusion, setConclusion] = useState<AssessmentConclusion | "">("");

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
      <AuthFormError message={error} />
      <AuthFormError message={notice} tone="success" />
      {item ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.status[item.status]}</Text>
      ) : null}
      {audience === "admin" ? (
        <>
          <AuthTextField label={vi.admission.coachId} value={coachId} onChangeText={setCoachId} autoCapitalize="none" />
          <AuthTextField label={vi.admission.reason} helper={vi.admission.optional} value={assignReason} onChangeText={setAssignReason} />
          <AuthButton
            title={vi.admission.assign}
            disabled={busy || !coachId.trim()}
            loading={busy}
            onPress={() =>
              run(() =>
                assignApplicationCoach(id, {
                  coachId: coachId.trim(),
                  reassignmentReason: assignReason.trim() ? assignReason.trim() : undefined,
                }),
              )
            }
          />
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
          <AuthButton
            title={vi.admission.resend}
            variant="secondary"
            disabled={busy}
            onPress={() => run(() => resendActivationEmail(id), vi.admission.resent)}
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
