import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { isApiError } from "@/api/errors";
import { listFighterMedicalExaminations, listFighterMedicalHistory } from "@/api/medical";
import {
  EXAMINATION_SCOPES,
  MEDICAL_HISTORY_RECORD_TYPES,
  type ExaminationScope,
  type MedicalExamination,
  type MedicalHistoryEntry,
  type MedicalHistoryRecordType,
  type Paginated,
} from "@/api/types";
import { AuthFormError } from "@/components/auth/auth-form-error";
import {
  decisionLabel,
  describeSnapshot,
  formatMedicalWhen,
  jointLabel,
  recordTypeLabel,
  scopeLabel,
  sessionTypeName,
  techniqueLabel,
} from "@/components/medical/medical-format";
import {
  MedicalCard,
  MedicalChip,
  MedicalFact,
  MedicalLink,
  MedicalMuted,
  medicalStyles,
} from "@/components/medical/medical-ui";
import { medical } from "@/i18n/medical";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

const PAGE_SIZE = 20;

function usePagedList<T>(
  enabled: boolean,
  fetchPage: (page: number) => Promise<Paginated<T>>,
  onAccessLost?: () => void,
) {
  const [rows, setRows] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const seqRef = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      if (!enabled) {
        setRows([]);
        setHasNext(false);
        return;
      }
      const seq = ++seqRef.current;
      setLoading(true);
      setError("");
      try {
        const result = await fetchPage(nextPage);
        if (seq !== seqRef.current) return;
        setRows((current) => (nextPage === 1 ? result.data : [...current, ...result.data]));
        setHasNext(result.hasNextPage);
        setPage(nextPage);
      } catch (cause: unknown) {
        if (seq !== seqRef.current) return;
        setRows([]);
        setHasNext(false);
        setError(mapApiMessage(cause));
        if (isApiError(cause) && (cause.status === 403 || cause.status === 404)) onAccessLost?.();
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [enabled, fetchPage, onAccessLost],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return { rows, loading, error, hasNext, reload: () => void load(1), more: () => void load(page + 1) };
}

function HistoryRow({ entry }: { entry: MedicalHistoryEntry }) {
  const { colors } = useThemePreference();
  const view = describeSnapshot(entry);
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: colors.ink }]}>{view.title}</Text>
      <MedicalMuted
        text={`${medical.revision} ${entry.revision} · ${formatMedicalWhen(entry.recordedAt)}`}
      />
      {entry.source === "MIGRATION_BASELINE" ? <MedicalMuted text={medical.baseline} /> : null}
      {view.lines.map((line) => (
        <MedicalFact key={line.label} label={line.label} value={line.value} />
      ))}
    </View>
  );
}

function ExamRow({ exam }: { exam: MedicalExamination }) {
  const { colors } = useThemePreference();
  const r = exam.restrictions;
  return (
    <View style={medicalStyles.row}>
      <Text style={[type.body, { color: exam.decision === "NOT_ELIGIBLE" ? colors.danger : colors.ink }]}>
        {scopeLabel(exam.scope)} · {decisionLabel(exam.decision)}
      </Text>
      <MedicalMuted text={formatMedicalWhen(exam.examinedAt)} />
      {exam.supersedesId ? <MedicalMuted text={medical.correction} /> : null}
      {exam.reason ? <MedicalFact label={medical.snapshot.reason} value={exam.reason} /> : null}
      {r?.allowedSessionTypes?.length ? (
        <MedicalFact
          label={medical.allowedSessionTypes}
          value={r.allowedSessionTypes.map(sessionTypeName).join(", ")}
        />
      ) : null}
      {r?.allowedTechniqueTypes?.length ? (
        <MedicalFact
          label={medical.allowedTechniqueTypes}
          value={r.allowedTechniqueTypes.map(techniqueLabel).join(", ")}
        />
      ) : null}
      {r?.excludedJoints?.length ? (
        <MedicalFact label={medical.excludedJoints} value={r.excludedJoints.map(jointLabel).join(", ")} />
      ) : null}
      {r?.notes ? <MedicalFact label={medical.restrictionNotes} value={r.notes} /> : null}
      <MedicalMuted
        text={`${medical.validUntil}: ${exam.validUntil ? formatMedicalWhen(exam.validUntil) : medical.noExpiry}`}
      />
    </View>
  );
}

/** Read-only medical history and examination history for one Fighter (shared by Fighter and Coach). */
export function MedicalHistoryContent({
  fighterId,
  enabled,
  onAccessLost,
}: {
  fighterId: string;
  enabled: boolean;
  onAccessLost?: () => void;
}) {
  const [tab, setTab] = useState<"history" | "exams">("history");
  const [recordType, setRecordType] = useState<MedicalHistoryRecordType | "">("");
  const [scope, setScope] = useState<ExaminationScope | "">("");

  const fetchHistory = useCallback(
    (page: number) =>
      listFighterMedicalHistory(fighterId, {
        page,
        limit: PAGE_SIZE,
        ...(recordType ? { recordType } : {}),
      }),
    [fighterId, recordType],
  );
  const fetchExams = useCallback(
    (page: number) =>
      listFighterMedicalExaminations(fighterId, {
        page,
        limit: PAGE_SIZE,
        ...(scope ? { scope } : {}),
      }),
    [fighterId, scope],
  );

  const history = usePagedList(enabled && !!fighterId && tab === "history", fetchHistory, onAccessLost);
  const exams = usePagedList(enabled && !!fighterId && tab === "exams", fetchExams, onAccessLost);
  const active = tab === "history" ? history : exams;

  return (
    <View style={medicalStyles.stack}>
      <View style={medicalStyles.chips}>
        <MedicalChip label={medical.historyTab} selected={tab === "history"} onPress={() => setTab("history")} />
        <MedicalChip label={medical.examsTab} selected={tab === "exams"} onPress={() => setTab("exams")} />
      </View>

      {tab === "history" ? (
        <View style={medicalStyles.chips}>
          <MedicalChip label={medical.filterAll} selected={recordType === ""} onPress={() => setRecordType("")} />
          {MEDICAL_HISTORY_RECORD_TYPES.map((value) => (
            <MedicalChip
              key={value}
              label={recordTypeLabel(value)}
              selected={recordType === value}
              onPress={() => setRecordType(value)}
            />
          ))}
        </View>
      ) : (
        <View style={medicalStyles.chips}>
          <MedicalChip label={medical.filterAll} selected={scope === ""} onPress={() => setScope("")} />
          {EXAMINATION_SCOPES.map((value) => (
            <MedicalChip
              key={value}
              label={scopeLabel(value)}
              selected={scope === value}
              onPress={() => setScope(value)}
            />
          ))}
        </View>
      )}

      <AuthFormError message={active.error} />
      {active.error ? <MedicalLink label={medical.retry} onPress={active.reload} /> : null}

      <MedicalCard>
        {active.loading && active.rows.length === 0 ? <MedicalMuted text={medical.loading} /> : null}
        {!active.loading && active.rows.length === 0 && !active.error ? (
          <MedicalMuted text={tab === "history" ? medical.historyEmpty : medical.examsEmpty} />
        ) : null}
        {tab === "history"
          ? history.rows.map((entry) => (
              <HistoryRow key={`${entry.recordType}:${entry.recordId}:${entry.revision}`} entry={entry} />
            ))
          : exams.rows.map((exam) => <ExamRow key={exam.id} exam={exam} />)}
        {active.hasNext ? <MedicalLink label={medical.loadMore} onPress={active.more} /> : null}
      </MedicalCard>

      <MedicalMuted text={medical.disclaimer} />
    </View>
  );
}
