import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  getFighterMedicalSummary,
  type FighterMedicalSummary,
  type MedicalStatus,
} from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { doctor } from "@/i18n/doctor";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

import { DoctorCard, DoctorChrome, doctorStyles, fighterName, formatWhen } from "./doctor-chrome";
import { useSelectedFighter } from "./selected-fighter";

function statusLabel(value: MedicalStatus): string {
  return doctor.status[value];
}

/**
 * Doctor Y tế loads only the fighter medical summary.
 * Body-measurement list/write and the training-session list are other roles.
 * There is no doctor-scoped replacement for either list.
 */
export function DoctorMedicalScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, isDemo } = useSession();
  const { fighter } = useSelectedFighter();
  const [summary, setSummary] = useState<FighterMedicalSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  useToastMessage(summaryError, "error");
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (soft = false) => {
      if (isDemo || !fighter || user?.role !== "DOCTOR") {
        setSummary(null);
        setSummaryError("");
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (soft) setRefreshing(true);
      else setLoading(true);
      setSummaryError("");

      try {
        setSummary(await getFighterMedicalSummary(fighter.id));
      } catch (cause: unknown) {
        setSummary(null);
        setSummaryError(mapApiMessage(cause));
      }

      setLoading(false);
      setRefreshing(false);
    },
    [fighter, isDemo, user?.role],
  );

  useEffect(() => {
    void load();
  }, [load]);

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
          <Pressable onPress={() => router.push("/examinations" as Href)}>
            <Text style={[type.link, { color: colors.lotus }]}>Khám baseline và đọc lại</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/clearance" as Href)}>
            <Text style={[type.link, { color: colors.lotus }]}>Cấp giấy phép</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/injuries" as Href)}>
            <Text style={[type.link, { color: colors.lotus }]}>Chấn thương</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/recovery" as Href)}>
            <Text style={[type.link, { color: colors.lotus }]}>Hồi phục</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/records" as Href)}>
            <Text style={[type.link, { color: colors.lotus }]}>Đọc hồ sơ</Text>
          </Pressable>

          <DoctorCard>
            <Text style={[type.label, { color: colors.lotus }]}>{doctor.medical.disclaimerTitle}</Text>
            <Text style={[type.body, { color: colors.ink }]}>{doctor.medical.disclaimer}</Text>
            {summary?.disclaimer ? (
              <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                {doctor.medical.serverNote}: {summary.disclaimer}
              </Text>
            ) : null}
          </DoctorCard>

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
        </ScrollView>
      ) : null}
    </DoctorChrome>
  );
}
