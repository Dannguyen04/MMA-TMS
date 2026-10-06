import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";

import { useToastMessage } from "@/components/toast/app-toast";

import {
  createFighterExamination,
  createFighterInjury,
  createFighterRecoveryPlan,
  getFighterMedical,
  issueFighterClearance,
  listFighterMedicalExaminations,
  type ClearanceType,
  type ExaminationDecision,
  type HydrationLevel,
  type InjurySeverity,
  type MedicalExamination,
  type MedicalInjury,
} from "@/api";
import { BODY_JOINTS, type BodyJoint } from "@/api/types";
import {
  BASELINE_AREAS,
  buildBaselineExamination,
  buildClearanceRetry,
  emptyBaselineDraft,
  type BaselineDraft,
} from "@/clinical/baseline-payload";
import { clearanceFollowUp } from "@/clinical/onboarding-step";
import { medical } from "@/i18n/medical";
import { decisionLabel, formatMedicalWhen, jointLabel } from "@/components/medical/medical-format";
import { MedicalDossierView } from "@/components/medical/medical-dossier-view";
import { mapApiMessage } from "@/session/map-api-message";
import { spacing, type, useThemePreference } from "@/theme";
import { DoctorCard, DoctorChrome, fighterName } from "./doctor-chrome";
import { useSelectedFighter } from "./selected-fighter";

const DECISIONS: ExaminationDecision[] = ["ELIGIBLE", "ELIGIBLE_WITH_RESTRICTIONS", "NOT_ELIGIBLE"];
const HYDRATION: HydrationLevel[] = ["GOOD", "FAIR", "POOR"];
const RESULTS = ["NORMAL", "ABNORMAL", "INCONCLUSIVE"] as const;
const SEVERITIES: InjurySeverity[] = ["MINOR", "MODERATE", "SEVERE", "CRITICAL"];

function Field({
  label,
  value,
  onChangeText,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (next: string) => void;
  error?: boolean;
}) {
  const { colors } = useThemePreference();
  return (
    <View style={{ gap: 4 }}>
      <Text style={[type.caption, { color: colors.inkMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: error ? colors.danger : colors.line,
          borderRadius: 8,
          paddingHorizontal: spacing.sm,
          color: colors.ink,
        }}
      />
    </View>
  );
}

function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useThemePreference();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ minHeight: 44, justifyContent: "center" }}>
      <Text style={[type.body, { color: selected ? colors.lotus : colors.ink }]}>{selected ? `● ${label}` : label}</Text>
    </Pressable>
  );
}

function useFighterId() {
  const { fighter } = useSelectedFighter();
  return fighter;
}

export function ExaminationListScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const fighter = useFighterId();
  const [rows, setRows] = useState<MedicalExamination[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  const load = useCallback(() => {
    if (!fighter) return;
    void listFighterMedicalExaminations(fighter.id, { page: 1, limit: 20 })
      .then((page) => setRows(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [fighter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DoctorChrome title={medical.currentExams}>
      <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xxl }}>
        <Pressable onPress={() => router.push("/examinations/new" as Href)}>
          <Text style={[type.link, { color: colors.lotus }]}>Khám baseline</Text>
        </Pressable>
        {rows.map((row) => (
          <Pressable key={row.id} onPress={() => router.push(`/examinations/${row.id}` as Href)}>
            <DoctorCard>
              <Text style={[type.body, { color: colors.ink }]}>
                {row.details?.examinationType ?? "LEGACY"} · {decisionLabel(row.decision)}
              </Text>
              <Text style={[type.caption, { color: colors.inkMuted }]}>{formatMedicalWhen(row.examinedAt)}</Text>
            </DoctorCard>
          </Pressable>
        ))}
      </ScrollView>
    </DoctorChrome>
  );
}

export function ExaminationFormScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const fighter = useFighterId();
  const [draft, setDraft] = useState<BaselineDraft>(emptyBaselineDraft);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [fields, setFields] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const patch = (next: Partial<BaselineDraft>) => setDraft((current) => ({ ...current, ...next }));

  const onSubmit = () => {
    if (!fighter || lock.current) return;
    const examinedAt = new Date().toISOString();
    const built = buildBaselineExamination(draft, examinedAt);
    if (!built.ok) {
      setFields(built.fields);
      setError(medical.unknownReason);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    void listFighterMedicalExaminations(fighter.id, { page: 1, limit: 1 })
      .then((before) =>
        createFighterExamination(fighter.id, built.body)
          .then((created) => {
            router.replace(`/examinations/${created.id}` as Href);
          })
          .catch(async (cause: unknown) => {
            const after = await listFighterMedicalExaminations(fighter.id, { page: 1, limit: 1 }).catch(() => null);
            if (after && after.total > before.total && after.data[0]) {
              router.replace(`/examinations/${after.data[0].id}` as Href);
              return;
            }
            setError(mapApiMessage(cause));
          }),
      )
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  return (
    <DoctorChrome title="Khám baseline">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingBottom: 120 }}>
        {fighter ? <Text style={[type.body, { color: colors.ink }]}>{fighterName(fighter)}</Text> : null}
        <Text style={[type.caption, { color: colors.inkMuted }]}>{medical.scat6NotEmbedded}</Text>
        {DECISIONS.map((value) => (
          <Choice key={value} label={decisionLabel(value)} selected={draft.decision === value} onPress={() => patch({ decision: value })} />
        ))}
        <Field label="Lý do" value={draft.reason} onChangeText={(reason) => patch({ reason })} error={fields.includes("reason")} />
        {draft.decision === "ELIGIBLE_WITH_RESTRICTIONS" ? (
          <Field
            label="Giới hạn"
            value={draft.restrictionNotes}
            onChangeText={(restrictionNotes) => patch({ restrictionNotes })}
            error={fields.includes("restrictionNotes")}
          />
        ) : null}
        <Field label="Cân nặng (kg)" value={draft.weightKg} onChangeText={(weightKg) => patch({ weightKg })} error={fields.includes("weightKg")} />
        <Field label="Nhịp tim nghỉ" value={draft.restingHeartRate} onChangeText={(restingHeartRate) => patch({ restingHeartRate })} error={fields.includes("restingHeartRate")} />
        <Field label="Huyết áp tâm thu" value={draft.bloodPressureSystolic} onChangeText={(bloodPressureSystolic) => patch({ bloodPressureSystolic })} error={fields.includes("bloodPressureSystolic")} />
        <Field label="Huyết áp tâm trương" value={draft.bloodPressureDiastolic} onChangeText={(bloodPressureDiastolic) => patch({ bloodPressureDiastolic })} error={fields.includes("bloodPressureDiastolic")} />
        <Field label="Nhiệt độ (°C)" value={draft.temperatureC} onChangeText={(temperatureC) => patch({ temperatureC })} error={fields.includes("temperatureC")} />
        <Field label="SpO2 (%)" value={draft.spo2Pct} onChangeText={(spo2Pct) => patch({ spo2Pct })} error={fields.includes("spo2Pct")} />
        {HYDRATION.map((value) => (
          <Choice key={value} label={value} selected={draft.hydration === value} onPress={() => patch({ hydration: value })} />
        ))}
        {BASELINE_AREAS.map((area) => (
          <DoctorCard key={area.key}>
            <Text style={[type.body, { color: colors.ink }]}>{area.area}</Text>
            {RESULTS.map((result) => (
              <Choice
                key={result}
                label={result}
                selected={draft.results[area.key] === result}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    results: { ...current.results, [area.key]: result },
                  }))
                }
              />
            ))}
            <Field
              label="Ghi chú"
              value={draft.notes[area.key]}
              onChangeText={(note) =>
                setDraft((current) => ({ ...current, notes: { ...current.notes, [area.key]: note } }))
              }
            />
          </DoctorCard>
        ))}
        <Field label="Lý do chưa làm SCAT6" value={draft.scat6Reason} onChangeText={(scat6Reason) => patch({ scat6Reason })} error={fields.includes("scat6Reason")} />
        <Field label="Khuyến nghị" value={draft.recommendations} onChangeText={(recommendations) => patch({ recommendations })} />
        <Pressable accessibilityRole="button" disabled={busy || !fighter} onPress={onSubmit} style={{ minHeight: 48, justifyContent: "center" }}>
          <Text style={[type.link, { color: colors.lotus }]}>{busy ? medical.loading : "Gửi lần khám"}</Text>
        </Pressable>
      </ScrollView>
    </DoctorChrome>
  );
}

export function ExaminationReadScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { examId } = useLocalSearchParams<{ examId: string }>();
  const fighter = useFighterId();
  const [exam, setExam] = useState<MedicalExamination | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  useEffect(() => {
    if (!fighter || !examId) return;
    void listFighterMedicalExaminations(fighter.id, { page: 1, limit: 50 })
      .then((page) => {
        const found = page.data.find((row) => row.id === examId) ?? null;
        setExam(found);
        if (!found) setError(medical.examsEmpty);
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [examId, fighter]);

  const canClear = exam && exam.decision !== "NOT_ELIGIBLE";

  return (
    <DoctorChrome title={medical.currentExams}>
      <ScrollView contentContainerStyle={{ gap: spacing.sm, paddingBottom: spacing.xxl }}>
        {exam ? (
          <>
            <Text style={[type.body, { color: colors.ink }]}>
              {exam.details?.examinationType ?? "LEGACY"} · {decisionLabel(exam.decision)}
            </Text>
            {!exam.details ? <Text style={[type.caption, { color: colors.inkMuted }]}>{medical.legacyDetails}</Text> : null}
            {exam.details?.vitals ? (
              <Text style={[type.caption, { color: colors.ink }]}>
                {exam.details.vitals.weightKg} kg · {exam.details.vitals.restingHeartRate} bpm ·{" "}
                {exam.details.vitals.bloodPressureSystolic}/{exam.details.vitals.bloodPressureDiastolic} ·{" "}
                {exam.details.vitals.temperatureC}°C · SpO2 {exam.details.vitals.spo2Pct}% · {exam.details.vitals.hydration}
              </Text>
            ) : null}
            {exam.details?.assessments.map((row) => (
              <Text key={row.area} style={[type.body, { color: colors.ink }]}>
                {row.area}: {row.result}
                {row.note ? ` — ${row.note}` : ""}
              </Text>
            ))}
            {exam.details?.scat6 ? (
              <Text style={[type.caption, { color: colors.inkMuted }]}>
                SCAT6 {exam.details.scat6.responses.status} · {exam.details.scat6.formVersion}
                {exam.details.scat6.scoringVersion != null ? ` · điểm server v${exam.details.scat6.scoringVersion}` : ""}
                {exam.details.scat6.scores ? ` · complete ${String(exam.details.scat6.scores.complete)}` : ""}
              </Text>
            ) : null}
            <Text style={[type.body, { color: colors.ink }]}>{exam.reason}</Text>
            {canClear ? (
              <Pressable onPress={() => router.push(`/clearance/new?examinationId=${exam.id}` as Href)}>
                <Text style={[type.link, { color: colors.lotus }]}>Cấp giấy phép</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </DoctorChrome>
  );
}

export function ClearanceFormScreen() {
  const { colors } = useThemePreference();
  const params = useLocalSearchParams<{ examinationId?: string }>();
  const fighter = useFighterId();
  const [examinationId, setExaminationId] = useState(typeof params.examinationId === "string" ? params.examinationId : "");
  const [clearanceType, setClearanceType] = useState<ClearanceType>("TRAINING");
  const [exams, setExams] = useState<MedicalExamination[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!fighter) return;
    void listFighterMedicalExaminations(fighter.id, { page: 1, limit: 20 })
      .then((page) => setExams(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [fighter]);

  const onSubmit = () => {
    if (!fighter || lock.current) return;
    const body = buildClearanceRetry(examinationId, clearanceType);
    if (!body) {
      setError(medical.stepClearance);
      return;
    }
    lock.current = true;
    setBusy(true);
    setError("");
    void issueFighterClearance(fighter.id, body)
      .then(async () => {
        const dossier = await getFighterMedical(fighter.id).catch(() => null);
        const follow = clearanceFollowUp(dossier?.eligibility.training);
        if (follow.kind === "eligible") {
          setNotice(medical.stepEligible);
          return;
        }
        if (follow.kind === "blocked") {
          const lines = follow.reasons.map(
            (code) => medical.reason[code as keyof typeof medical.reason] ?? code,
          );
          setNotice([medical.clearanceSavedNotEligible, ...lines].join(" "));
          return;
        }
        setNotice(medical.clearanceUnconfirmed);
      })
      .catch((cause: unknown) => {
        setError(`${medical.examSavedClearanceFailed} ${mapApiMessage(cause)}`);
      })
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  return (
    <DoctorChrome title="Cấp giấy phép">
      <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
        {exams.map((row) => (
          <Choice
            key={row.id}
            label={`${row.details?.examinationType ?? "LEGACY"} · ${decisionLabel(row.decision)}`}
            selected={examinationId === row.id}
            onPress={() => setExaminationId(row.id)}
          />
        ))}
        {(["TRAINING", "RETURN_FROM_INJURY", "COMPETITION"] as const).map((value) => (
          <Choice key={value} label={value} selected={clearanceType === value} onPress={() => setClearanceType(value)} />
        ))}
        <Pressable disabled={busy} onPress={onSubmit}>
          <Text style={[type.link, { color: colors.lotus }]}>{busy ? medical.loading : "Cấp giấy"}</Text>
        </Pressable>
      </ScrollView>
    </DoctorChrome>
  );
}

export function InjuryFormScreen() {
  const { colors } = useThemePreference();
  const fighter = useFighterId();
  const [joint, setJoint] = useState<BodyJoint | "">("");
  const [injuryType, setInjuryType] = useState("");
  const [severity, setSeverity] = useState<InjurySeverity | "">("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const onSubmit = () => {
    if (!fighter || lock.current || !joint || !severity || !injuryType.trim()) {
      setError(medical.unknownReason);
      return;
    }
    lock.current = true;
    setBusy(true);
    void createFighterInjury(fighter.id, {
      affectedJoint: joint,
      injuryType: injuryType.trim(),
      severity,
      occurredAt: new Date().toISOString(),
      ...(description.trim() ? { description: description.trim() } : {}),
    })
      .then(() => setError(""))
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  return (
    <DoctorChrome title="Ghi chấn thương">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingBottom: 80 }}>
        {BODY_JOINTS.map((value) => (
          <Choice key={value} label={jointLabel(value)} selected={joint === value} onPress={() => setJoint(value)} />
        ))}
        <Field label="Loại chấn thương" value={injuryType} onChangeText={setInjuryType} />
        {SEVERITIES.map((value) => (
          <Choice key={value} label={value} selected={severity === value} onPress={() => setSeverity(value)} />
        ))}
        <Field label="Mô tả" value={description} onChangeText={setDescription} />
        <Pressable disabled={busy} onPress={onSubmit}>
          <Text style={[type.link, { color: colors.lotus }]}>{busy ? medical.loading : "Lưu chấn thương"}</Text>
        </Pressable>
      </ScrollView>
    </DoctorChrome>
  );
}

export function RecoveryFormScreen() {
  const { colors } = useThemePreference();
  const fighter = useFighterId();
  const [injuries, setInjuries] = useState<MedicalInjury[]>([]);
  const [injuryId, setInjuryId] = useState("");
  const [title, setTitle] = useState("");
  const [milestone, setMilestone] = useState("");
  const [criteria, setCriteria] = useState("");
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!fighter) return;
    void getFighterMedical(fighter.id)
      .then((dossier) => setInjuries(dossier.activeInjuries))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [fighter]);

  const onSubmit = () => {
    if (!fighter || lock.current) return;
    if (!injuryId || !title.trim() || !milestone.trim() || !criteria.trim()) {
      setError("Chọn chấn thương thật và điền mốc. Không tạo chấn thương giả cho baseline.");
      return;
    }
    lock.current = true;
    setBusy(true);
    const today = new Date().toISOString().slice(0, 10);
    void createFighterRecoveryPlan(fighter.id, {
      injuryId,
      title: title.trim(),
      startDate: today,
      milestones: [{ title: milestone.trim(), criteria: criteria.trim() }],
    })
      .then(() => setError(""))
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => {
        lock.current = false;
        setBusy(false);
      });
  };

  return (
    <DoctorChrome title="Kế hoạch hồi phục">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.sm, paddingBottom: 80 }}>
        {injuries.length === 0 ? (
          <Text style={[type.body, { color: colors.ink }]}>Chưa có chấn thương. Hãy ghi chấn thương hợp lệ trước, không tự tạo bản ghi nền.</Text>
        ) : (
          injuries.map((row) => (
            <Choice
              key={row.id}
              label={`${jointLabel(row.affectedJoint)} · ${row.injuryType}`}
              selected={injuryId === row.id}
              onPress={() => setInjuryId(row.id)}
            />
          ))
        )}
        <Field label="Tên kế hoạch" value={title} onChangeText={setTitle} />
        <Field label="Mốc" value={milestone} onChangeText={setMilestone} />
        <Field label="Tiêu chí mốc" value={criteria} onChangeText={setCriteria} />
        <Pressable disabled={busy || injuries.length === 0} onPress={onSubmit}>
          <Text style={[type.link, { color: colors.lotus }]}>{busy ? medical.loading : "Lưu kế hoạch"}</Text>
        </Pressable>
      </ScrollView>
    </DoctorChrome>
  );
}

export function RecordsScreen() {
  const fighter = useFighterId();
  const [dossier, setDossier] = useState<Awaited<ReturnType<typeof getFighterMedical>> | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");

  useEffect(() => {
    if (!fighter) return;
    void getFighterMedical(fighter.id)
      .then(setDossier)
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [fighter]);

  return (
    <DoctorChrome title={medical.dossierTitle}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
        {dossier ? <MedicalDossierView dossier={dossier} /> : null}
      </ScrollView>
    </DoctorChrome>
  );
}
