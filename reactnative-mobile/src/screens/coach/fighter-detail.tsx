import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import {
  getFighter,
  getFighterMedical,
  isApiError,
  listFighterCoaches,
  listFighterMeasurements,
  listFighterSessions,
  listTrainingPlans,
  type CoachAssignment,
  type FighterMeasurement,
  type MedicalDossier,
  type PublicFighter,
  type TrainingPlan,
  type TrainingSessionSummary,
} from "@/api";
import { EligibilityLine } from "@/components/medical/medical-dossier-view";
import { coach } from "@/i18n/coach";
import { medical as medicalCopy } from "@/i18n/medical";
import { vi } from "@/i18n/vi";
import {
  coachErrorMessage,
  coachHref,
  fighterDisplayName,
  formatWhen,
} from "@/screens/coach/coach-error";
import { CoachBanner, CoachCard, CoachScaffold } from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

function lostAccess(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.status === 404);
}

/**
 * Read-only Fighter workspace for a Coach. Baseline Coach has no
 * `fighter.coach:assign` nor `fighter.measurement:write`, so no self-assign or measurement form.
 */
export function CoachFighterDetailScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { isDemo } = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const fighterId = typeof params.id === "string" ? params.id : "";

  const [fighter, setFighter] = useState<PublicFighter | null>(null);
  const [measurements, setMeasurements] = useState<FighterMeasurement[]>([]);
  const [medical, setMedical] = useState<MedicalDossier | null>(null);
  const [medicalError, setMedicalError] = useState("");
  const [sessions, setSessions] = useState<TrainingSessionSummary[]>([]);
  const [assignments, setAssignments] = useState<CoachAssignment[]>([]);
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [accessLost, setAccessLost] = useState(false);
  const seqRef = useRef(0);

  const resetAll = useCallback(() => {
    setFighter(null);
    setMeasurements([]);
    setMedical(null);
    setMedicalError("");
    setSessions([]);
    setAssignments([]);
    setPlans([]);
  }, []);

  const load = useCallback(() => {
    if (!fighterId || isDemo) return;
    const seq = ++seqRef.current;
    setError("");
    setLoading(true);
    void getFighter(fighterId)
      .then((profile) => {
        if (seq !== seqRef.current) return;
        setAccessLost(false);
        setFighter(profile);
        return Promise.allSettled([
          listFighterMeasurements(fighterId, { limit: 20 }),
          getFighterMedical(fighterId),
          listFighterSessions(fighterId, { limit: 10 }),
          listFighterCoaches(fighterId),
          listTrainingPlans({ fighterId, limit: 10 }),
        ]).then(([measureResult, medicalResult, sessionResult, coachResult, planResult]) => {
          if (seq !== seqRef.current) return;
          const results = [measureResult, medicalResult, sessionResult, coachResult, planResult];
          setMeasurements(measureResult.status === "fulfilled" ? measureResult.value.data : []);
          setMedical(medicalResult.status === "fulfilled" ? medicalResult.value : null);
          setMedicalError(
            medicalResult.status === "rejected" ? coachErrorMessage(medicalResult.reason) : "",
          );
          setSessions(sessionResult.status === "fulfilled" ? sessionResult.value.data : []);
          setAssignments(coachResult.status === "fulfilled" ? coachResult.value : []);
          setPlans(planResult.status === "fulfilled" ? planResult.value.data : []);
          const firstFailure = results.find(
            (item) => item.status === "rejected" && item !== medicalResult,
          );
          if (firstFailure && firstFailure.status === "rejected") {
            setError(coachErrorMessage(firstFailure.reason));
          }
        });
      })
      .catch((cause: unknown) => {
        if (seq !== seqRef.current) return;
        resetAll();
        if (lostAccess(cause)) {
          setAccessLost(true);
          setError(coach.accessLost);
        } else {
          setError(coachErrorMessage(cause));
        }
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, [fighterId, isDemo, resetAll]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <CoachScaffold title={fighter ? fighterDisplayName(fighter) : coach.fighterDetail} inStack>
      {error ? <CoachBanner message={error} tone="danger" /> : null}
      {accessLost ? (
        <CoachCard onPress={() => router.replace(coachHref("/(coach)/fighters"))}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.backToRoster}</Text>
        </CoachCard>
      ) : null}
      {fighter ? (
        <CoachCard>
          <Text style={[type.body, { color: colors.inkMuted }]}>
            {coach.weightClass}: {vi.weightClass[fighter.weightClass]}
          </Text>
          {fighter.gym ? (
            <Text style={[type.body, { color: colors.inkMuted }]}>
              {coach.gym}: {fighter.gym}
            </Text>
          ) : null}
        </CoachCard>
      ) : loading ? (
        <CoachBanner message={coach.loading} />
      ) : null}

      {fighter ? (
        <>
          <Text style={[type.title, { color: colors.ink }]}>{coach.medicalSummary}</Text>
          <CoachCard onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/medical`))}>
            {medical ? (
              <>
                <EligibilityLine
                  eligibility={medical.eligibility.training}
                  label={medicalCopy.eligibilityTraining}
                />
                {medical.openReviewRequests.length > 0 ? (
                  <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                    {medicalCopy.openRequests}: {medical.openReviewRequests.length}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={[type.body, { color: colors.inkMuted }]}>
                {medicalError || coach.loading}
              </Text>
            )}
            <Text style={[type.link, { color: colors.lotus }]}>{coach.openMedical}</Text>
          </CoachCard>

          <Text style={[type.title, { color: colors.ink }]}>{coach.sessionHistory}</Text>
          <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
            {coach.sessionHistoryHint}
          </Text>
          <View style={{ gap: spacing.sm }}>
            {sessions.length === 0 ? <CoachBanner message={coach.emptySessions} /> : null}
            {sessions.map((row) => (
              <CoachCard
                key={row.id}
                onPress={() => router.push(coachHref(`/(coach)/schedule/${row.id}`))}
              >
                <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
                <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                  {formatWhen(row.scheduledAt)} · {coach.sessionTypeLabel[row.sessionType]} ·{" "}
                  {coach.sessionStatus[row.status]}
                </Text>
              </CoachCard>
            ))}
          </View>

          <CoachCard onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/videos`))}>
            <Text style={[type.link, { color: colors.lotus }]}>Video võ sĩ</Text>
          </CoachCard>
          <CoachCard onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/goals`))}>
            <Text style={[type.link, { color: colors.lotus }]}>Mục tiêu võ sĩ</Text>
          </CoachCard>
          <CoachCard
            onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/performance`))}
          >
            <Text style={[type.link, { color: colors.lotus }]}>Hiệu suất võ sĩ</Text>
          </CoachCard>

          <Text style={[type.title, { color: colors.ink }]}>{coach.fighterPlans}</Text>
          <View style={{ gap: spacing.sm }}>
            {plans.length === 0 ? <CoachBanner message={coach.emptyPlans} /> : null}
            {plans.map((row) => (
              <CoachCard
                key={row.id}
                onPress={() => router.push(coachHref(`/(coach)/plans/${row.id}`))}
              >
                <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
                <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                  {coach.planStatus[row.status]}
                </Text>
                <Text style={[type.link, { color: colors.lotus }]}>{coach.openPlan}</Text>
              </CoachCard>
            ))}
          </View>

          <Text style={[type.title, { color: colors.ink }]}>{coach.assignments}</Text>
          <View style={{ gap: spacing.sm }}>
            {assignments.length === 0 ? <CoachBanner message={coach.emptyAssignments} /> : null}
            {assignments.map((row) => (
              <CoachCard key={row.id}>
                <Text style={[type.body, { color: colors.ink }]}>
                  {row.coachName ?? coach.coachFallback}
                </Text>
                <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                  {row.endsAt ? coach.assignmentEnded : coach.assignmentActive} ·{" "}
                  {formatWhen(row.startsAt)}
                  {row.endsAt ? ` – ${formatWhen(row.endsAt)}` : ""}
                  {row.coachGym ? ` · ${row.coachGym}` : ""}
                </Text>
                {row.endReason ? (
                  <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                    {coach.endReason}: {row.endReason}
                  </Text>
                ) : null}
              </CoachCard>
            ))}
          </View>

          <Text style={[type.title, { color: colors.ink }]}>{coach.measurementTitle}</Text>
          <View style={{ gap: spacing.sm }}>
            {measurements.length === 0 ? (
              <CoachBanner message={coach.emptyMeasurements} />
            ) : (
              measurements.map((row) => (
                <CoachCard key={row.id}>
                  <Text style={[type.body, { color: colors.ink }]}>
                    {row.weightKg} kg · {row.measurementContext}
                  </Text>
                  <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                    {formatWhen(row.measuredAt)}
                  </Text>
                </CoachCard>
              ))
            )}
          </View>
        </>
      ) : null}
    </CoachScaffold>
  );
}
