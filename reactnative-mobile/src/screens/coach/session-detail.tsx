import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import {
  ALLOWED_SESSION_TRANSITIONS,
  SESSION_TYPES,
  getTrainingPlan,
  getTrainingSession,
  medicalGateReasons,
  updateTrainingSession,
  updateTrainingSessionStatus,
  type SessionStatus,
  type SessionType,
  type TrainingPlan,
  type TrainingSession,
} from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { coach } from "@/i18n/coach";
import { coachErrorMessage, coachHref, formatWhen } from "@/screens/coach/coach-error";
import {
  CoachBanner,
  CoachCard,
  CoachChip,
  CoachField,
  CoachPicker,
  CoachPrimaryButton,
  CoachScaffold,
} from "@/screens/coach/coach-ui";
import { spacing, type, useThemePreference } from "@/theme";
import { SkeletonCard } from "@/components/loading";

const CANCEL_REASON_MAX = 500;

function gateReasonLabel(reason: string): string {
  const labels = coach.medicalGate.reasons as Record<string, string>;
  return labels[reason] ?? coach.medicalGate.unknown;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} phút ${rest} giây` : `${minutes} phút`;
}

export function CoachSessionDetailScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = typeof params.id === "string" ? params.id : "";
  const [row, setRow] = useState<TrainingSession | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [gate, setGate] = useState<string[] | null>(null);
  const [notes, setNotes] = useState("");
  const [rpe, setRpe] = useState("");
  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [saving, setSaving] = useState(false);
  const [changing, setChanging] = useState(false);
  const seqRef = useRef(0);

  const load = useCallback((mode?: unknown) => {
    if (!sessionId) return;
    const seq = ++seqRef.current;
    setError("");
    return getTrainingSession(sessionId)
      .then(async (next) => {
        if (seq !== seqRef.current) return;
        setRow(next);
        if (!next.planId) {
          setPlan(null);
          return;
        }
        try {
          const linked = await getTrainingPlan(next.planId);
          if (seq === seqRef.current) setPlan(linked);
        } catch {
          if (seq === seqRef.current) setPlan(null);
        }
      })
      .catch((cause: unknown) => {
        if (mode === "refresh") throw cause;
        if (seq === seqRef.current) setError(coachErrorMessage(cause));
      });
  }, [sessionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!row) return;
    setNotes(row.coachNotes ?? "");
    setRpe(row.reportedRpe != null ? String(row.reportedRpe) : "");
    setSessionType(row.sessionType);
  }, [row]);

  const handleFailure = (cause: unknown) => {
    const reasons = medicalGateReasons(cause);
    if (reasons) {
      setGate(reasons);
      setError("");
    } else {
      setError(coachErrorMessage(cause));
    }
    load();
  };

  const sendStatus = (status: SessionStatus, reason?: string) => {
    if (!sessionId || changing) return;
    setChanging(true);
    setError("");
    setNotice("");
    setGate(null);
    const body =
      status === "CANCELLED"
        ? { status: "CANCELLED" as const, cancellationReason: reason ?? "" }
        : { status: status as Exclude<SessionStatus, "CANCELLED"> };
    void updateTrainingSessionStatus(sessionId, body)
      .then(() => {
        setCancelOpen(false);
        setCancelReason("");
        setNotice(coach.saved);
        load();
      })
      .catch(handleFailure)
      .finally(() => setChanging(false));
  };

  const onPickStatus = (status: SessionStatus) => {
    if (status === "CANCELLED") {
      setCancelOpen(true);
      setCancelError("");
      return;
    }
    setCancelOpen(false);
    sendStatus(status);
  };

  const onConfirmCancel = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setCancelError(coach.cancelReasonRequired);
      return;
    }
    setCancelError("");
    sendStatus("CANCELLED", reason);
  };

  const onSave = () => {
    if (!sessionId || !row) return;
    const rawRpe = rpe.trim();
    let rpeValue: number | null = null;
    if (rawRpe) {
      const parsed = Number(rawRpe);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
        setError(coach.rpeInvalid);
        return;
      }
      rpeValue = parsed;
    }
    setSaving(true);
    setError("");
    setNotice("");
    setGate(null);
    void updateTrainingSession(sessionId, {
      coachNotes: notes.trim() ? notes.trim() : null,
      reportedRpe: rpeValue,
      ...(sessionType && sessionType !== row.sessionType ? { sessionType } : {}),
    })
      .then(() => {
        setNotice(coach.saved);
        load();
      })
      .catch(handleFailure)
      .finally(() => setSaving(false));
  };

  const nextStatuses = row ? (ALLOWED_SESSION_TRANSITIONS[row.status] ?? []) : [];

  return (
    <CoachScaffold title={row?.title ?? coach.sessionDetail} keyboard inStack onRefresh={() => load("refresh")}>
      {gate && row ? (
        <CoachCard>
          <Text style={[type.label, { color: colors.danger, lineHeight: 18 }]}>{coach.medicalGate.title}</Text>
          {(gate.length ? gate : [""]).map((reason, index) => (
            <Text key={`${reason}-${index}`} style={[type.body, { color: colors.ink }]}>
              • {gateReasonLabel(reason)}
            </Text>
          ))}
          <Text
            accessibilityRole="link"
            onPress={() => router.push(coachHref(`/(coach)/fighters/${row.fighterId}/medical`))}
            style={[type.link, { color: colors.lotus }]}
          >
            {coach.medicalGate.openMedical}
          </Text>
        </CoachCard>
      ) : null}
      {row ? (
        <CoachCard>
          <Text style={[type.body, { color: colors.inkMuted }]}>{formatWhen(row.scheduledAt)}</Text>
          <Text style={[type.body, { color: colors.ink }]}>
            {coach.status}: {coach.sessionStatus[row.status]}
          </Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {coach.sessionTypeLabel[row.sessionType]}
          </Text>
          {row.location ? (
            <Text style={[type.body, { color: colors.inkMuted }]}>{row.location}</Text>
          ) : null}
          {row.actualDurationSec != null ? (
            <Text style={[type.body, { color: colors.inkMuted }]}>
              {coach.actualDuration}: {formatDuration(row.actualDurationSec)}
            </Text>
          ) : null}
          {row.cancellationReason ? (
            <Text style={[type.body, { color: colors.inkMuted }]}>
              {coach.cancelReason}: {row.cancellationReason}
            </Text>
          ) : null}
          {plan ? (
            <Text
              accessibilityRole="link"
              onPress={() => router.push(coachHref(`/(coach)/plans/${plan.id}`))}
              style={[type.link, { color: colors.lotus }]}
            >
              {coach.linkedPlan}: {plan.title}
              {plan.progress
                ? ` (${plan.progress.completedSessions}/${plan.progress.totalSessions})`
                : ""}
            </Text>
          ) : null}
        </CoachCard>
      ) : error ? null : (
        <SkeletonCard lines={3} />
      )}
      {row ? (
        <>
          <CoachPicker
            label={coach.sessionType}
            valueLabel={sessionType ? coach.sessionTypeLabel[sessionType] : ""}
            placeholder={coach.sessionType}
            options={SESSION_TYPES.map((value) => ({ value, label: coach.sessionTypeLabel[value] }))}
            onSelect={setSessionType}
          />
          <CoachField
            label={coach.coachNotes}
            helper={coach.optional}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
          <CoachField
            label={coach.rpe}
            helper={coach.optional}
            value={rpe}
            onChangeText={setRpe}
            keyboardType="number-pad"
            maxLength={2}
          />
          <CoachPrimaryButton title={coach.saveSession} onPress={onSave} loading={saving} />
          <Text style={[type.label, { color: colors.inkMuted, lineHeight: 18 }]}>{coach.nextStatus}</Text>
          {nextStatuses.length ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
              {nextStatuses.map((status) => (
                <CoachChip
                  key={status}
                  value={status}
                  selected={status === "CANCELLED" && cancelOpen}
                  label={coach.sessionStatus[status]}
                  onPress={changing ? () => undefined : onPickStatus}
                />
              ))}
            </View>
          ) : (
            <CoachBanner message={coach.noTransitions} />
          )}
          {cancelOpen && nextStatuses.includes("CANCELLED") ? (
            <>
              <CoachField
                label={coach.cancelReason}
                helper={coach.cancelReasonHint}
                error={cancelError}
                value={cancelReason}
                onChangeText={setCancelReason}
                maxLength={CANCEL_REASON_MAX}
                multiline
              />
              <CoachPrimaryButton title={coach.cancelSubmit} onPress={onConfirmCancel} loading={changing} />
            </>
          ) : null}
        </>
      ) : null}
    </CoachScaffold>
  );
}
