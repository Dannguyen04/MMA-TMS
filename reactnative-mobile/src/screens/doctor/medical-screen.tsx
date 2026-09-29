import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  createFighterMeasurement,
  getFighterMedicalSummary,
  isApiError,
  listFighterMeasurements,
  listTrainingSessions,
  type FighterMeasurement,
  type FighterMedicalSummary,
  type MedicalStatus,
  type SessionStatus,
  type SessionType,
  type TrainingSession,
} from "@/api";
import { AuthButton } from "@/components/auth/auth-button";
import { doctor } from "@/i18n/doctor";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { radius, spacing, type, useThemePreference } from "@/theme";

import { DoctorCard, DoctorChrome, doctorStyles, fighterName, formatWhen } from "./doctor-chrome";
import { useSelectedFighter } from "./selected-fighter";

function statusLabel(value: MedicalStatus): string {
  return doctor.status[value];
}

function sessionStatusLabel(value: SessionStatus): string {
  return doctor.sessionStatus[value];
}

function sessionTypeLabel(value: SessionType): string {
  return doctor.sessionType[value];
}

function isForbidden(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.code === "FORBIDDEN");
}

export function DoctorMedicalScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, isDemo } = useSession();
  const { fighter } = useSelectedFighter();
  const [summary, setSummary] = useState<FighterMedicalSummary | null>(null);
  const [checkups, setCheckups] = useState<FighterMeasurement[]>([]);
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [summaryError, setSummaryError] = useState("");
  const [checkupError, setCheckupError] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  const [sessionsForbidden, setSessionsForbidden] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [weightKg, setWeightKg] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveHint, setSaveHint] = useState("");

  const load = useCallback(
    async (soft = false) => {
      if (isDemo || !fighter || user?.role !== "DOCTOR") {
        setSummary(null);
        setCheckups([]);
        setSessions([]);
        setSummaryError("");
        setCheckupError("");
        setSessionsError("");
        setSessionsForbidden(false);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (soft) setRefreshing(true);
      else setLoading(true);
      setSummaryError("");
      setCheckupError("");
      setSessionsError("");
      setSessionsForbidden(false);
      setSaveHint("");

      const [summaryResult, measurementResult, sessionResult] = await Promise.allSettled([
        getFighterMedicalSummary(fighter.id),
        listFighterMeasurements(fighter.id, { page: 1, limit: 50 }),
        listTrainingSessions({ fighterId: fighter.id, page: 1, limit: 20 }),
      ]);

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setSummaryError(mapApiMessage(summaryResult.reason));
      }

      if (measurementResult.status === "fulfilled") {
        setCheckups(
          measurementResult.value.data.filter(
            (row) => row.measurementContext === "CHECKUP" && !row.isSuperseded,
          ),
        );
      } else {
        setCheckups([]);
        setCheckupError(mapApiMessage(measurementResult.reason));
      }

      if (sessionResult.status === "fulfilled") {
        setSessions(sessionResult.value.data);
      } else if (isForbidden(sessionResult.reason)) {
        setSessions([]);
        setSessionsForbidden(true);
      } else {
        setSessions([]);
        setSessionsError(mapApiMessage(sessionResult.reason));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [fighter, isDemo, user?.role],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveCheckup = () => {
    if (!fighter || saving || isDemo) return;
    const kg = Number(weightKg.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0) {
      setSaveHint(doctor.medical.checkupNeedWeight);
      return;
    }
    setSaving(true);
    setSaveHint("");
    void createFighterMeasurement(fighter.id, {
      weightKg: kg,
      measurementContext: "CHECKUP",
    })
      .then(() => {
        setWeightKg("");
        setSaveHint(doctor.medical.checkupSaved);
        return load(true);
      })
      .catch((cause: unknown) => {
        setSaveHint(isForbidden(cause) ? doctor.medical.sessionsForbidden : mapApiMessage(cause));
      })
      .finally(() => {
        setSaving(false);
      });
  };

  return (
    <DoctorChrome title={doctor.medical.title}>
      {!fighter ? (
        <DoctorCard>
          <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.pickFighterHint}</Text>
        </DoctorCard>
      ) : null}

      {fighter && loading ? <ActivityIndicator color={colors.lotus} /> : null}

      {fighter && !loading ? (
        <ScrollView
          contentContainerStyle={doctorStyles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          <Text style={[type.body, { color: colors.ink }]}>{fighterName(fighter)}</Text>

          <DoctorCard>
            <Text style={[type.label, { color: colors.lotus }]}>{doctor.medical.disclaimerTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{doctor.medical.disclaimer}</Text>
            {summary?.disclaimer ? (
              <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                {doctor.medical.serverNote}: {summary.disclaimer}
              </Text>
            ) : null}
          </DoctorCard>

          {summaryError ? (
            <DoctorCard>
              <Text style={[type.body, { color: colors.danger }]}>{summaryError}</Text>
            </DoctorCard>
          ) : null}

          {summary ? (
            <>
              <DoctorCard>
                <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.status}</Text>
                <Text style={[type.body, { color: colors.ink }]}>
                  {statusLabel(summary.currentMedicalStatus)}
                </Text>
              </DoctorCard>

              <DoctorCard>
                <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.clearance}</Text>
                {summary.activeClearance ? (
                  <>
                    <Text style={[type.body, { color: colors.ink }]}>
                      {summary.activeClearance.clearanceType} · {summary.activeClearance.status}
                    </Text>
                    <Text style={[type.body, { color: colors.inkMuted }]}>
                      {doctor.medical.validUntil}:{" "}
                      {summary.activeClearance.validUntil
                        ? formatWhen(summary.activeClearance.validUntil)
                        : doctor.medical.noExpiry}
                    </Text>
                  </>
                ) : (
                  <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.medical.noClearance}</Text>
                )}
              </DoctorCard>

              <DoctorCard>
                <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.injuries}</Text>
                {summary.activeInjuries.length === 0 ? (
                  <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.medical.noInjuries}</Text>
                ) : (
                  summary.activeInjuries.map((injury) => (
                    <Text key={injury.id} style={[type.body, { color: colors.ink }]}>
                      {injury.affectedJoint} · {injury.injuryType} · {injury.severity}
                    </Text>
                  ))
                )}
              </DoctorCard>

              <DoctorCard>
                <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.joints}</Text>
                {summary.jointStates.length === 0 ? (
                  <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.medical.noJoints}</Text>
                ) : (
                  summary.jointStates.map((joint) => (
                    <Text key={joint.id} style={[type.body, { color: colors.ink }]}>
                      {joint.joint} · {joint.currentState}
                    </Text>
                  ))
                )}
              </DoctorCard>
            </>
          ) : null}

          <DoctorCard>
            <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.checkup}</Text>
            {checkupError ? (
              <Text style={[type.body, { color: colors.danger }]}>{checkupError}</Text>
            ) : checkups.length === 0 ? (
              <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.medical.checkupEmpty}</Text>
            ) : (
              checkups.map((row) => (
                <Text key={row.id} style={[type.body, { color: colors.ink }]}>
                  {row.weightKg} {doctor.medical.kg}
                  {row.heightCm != null ? ` · ${row.heightCm} ${doctor.medical.cm}` : ""}
                  {` · ${formatWhen(row.measuredAt)}`}
                </Text>
              ))
            )}
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.weightKg}</Text>
              <TextInput
                accessibilityLabel={doctor.medical.weightKg}
                keyboardType="decimal-pad"
                value={weightKg}
                onChangeText={setWeightKg}
                placeholder="70.5"
                placeholderTextColor={colors.inkSubtle}
                style={{
                  minHeight: 44,
                  borderWidth: 1,
                  borderColor: colors.controlBorder,
                  borderRadius: radius.field,
                  paddingHorizontal: spacing.md,
                  color: colors.ink,
                  fontSize: 16,
                }}
              />
              <AuthButton
                title={doctor.medical.saveCheckup}
                onPress={onSaveCheckup}
                loading={saving}
                disabled={saving}
              />
              {saveHint ? (
                <Text style={[type.body, { color: colors.inkMuted }]}>{saveHint}</Text>
              ) : null}
            </View>
          </DoctorCard>

          <DoctorCard>
            <Pressable accessibilityRole="button" onPress={() => router.push("/examinations" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Khám</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/injuries" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Chấn thương</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/recovery" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Hồi phục</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/clearance" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Cấp giấy phép</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/records" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Hồ sơ y tế</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => router.push("/ai-alerts" as Href)}>
              <Text style={[type.link, { color: colors.lotus }]}>Cảnh báo AI</Text>
            </Pressable>
          </DoctorCard>

          <DoctorCard>
            <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.medical.sessions}</Text>
            {sessionsForbidden ? (
              <Text style={[type.body, { color: colors.ink }]}>{doctor.medical.sessionsForbidden}</Text>
            ) : sessionsError ? (
              <Text style={[type.body, { color: colors.danger }]}>{sessionsError}</Text>
            ) : sessions.length === 0 ? (
              <Text style={[type.body, { color: colors.inkMuted }]}>{doctor.medical.sessionsEmpty}</Text>
            ) : (
              sessions.map((row) => (
                <Text key={row.id} style={[type.body, { color: colors.ink }]}>
                  {row.title} · {sessionTypeLabel(row.sessionType)} · {sessionStatusLabel(row.status)}
                  {` · ${formatWhen(row.scheduledAt)}`}
                </Text>
              ))
            )}
          </DoctorCard>
        </ScrollView>
      ) : null}
    </DoctorChrome>
  );
}
