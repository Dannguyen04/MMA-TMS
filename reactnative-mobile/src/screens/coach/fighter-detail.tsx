import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { useToastMessage } from "@/components/toast/app-toast";

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
import { eligibilityReasonLabel, measurementContextLabel } from "@/components/medical/medical-format";
import {
  AvatarInitials,
  CountRow,
  Divider,
  LinkRow,
  PersonHeader,
  PersonHeaderSkeleton,
  PLAN_STATUS_TONE,
  PlanStatusMark,
  SessionTimeline,
  SessionTypeMix,
  SkeletonBlock,
  SkeletonCards,
  StatusBlock,
  StatusChip,
  WeightChart,
} from "@/components/visuals";
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

function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

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
  useToastMessage(error, "error");
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

  const load = useCallback((mode?: unknown) => {
    if (!fighterId || isDemo) return;
    const seq = ++seqRef.current;
    setError("");
    if (mode !== "refresh") setLoading(true);
    return getFighter(fighterId)
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
        if (mode === "refresh" && !lostAccess(cause)) throw cause;
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
    <CoachScaffold title={fighter ? fighterDisplayName(fighter) : coach.fighterDetail} inStack onRefresh={() => load("refresh")}>
      {accessLost ? (
        <CoachCard onPress={() => router.replace(coachHref("/(coach)/fighters"))}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.backToRoster}</Text>
        </CoachCard>
      ) : null}
      {fighter ? (
        <PersonHeader
          colors={colors}
          name={fighterDisplayName(fighter)}
          stat={[
            `${coach.weightClass}: ${vi.weightClass[fighter.weightClass]}`,
            fighter.gym ? `${coach.gym}: ${fighter.gym}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      ) : loading ? (
        <>
          <PersonHeaderSkeleton colors={colors} label={coach.loading} />
          <SkeletonCards colors={colors} count={4} />
        </>
      ) : null}

      {fighter ? (
        <>
          <Text style={[type.title, { color: colors.ink }]}>{coach.medicalSummary}</Text>
          <CoachCard onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/medical`))}>
            {medical ? (
              <View style={{ gap: spacing.md }}>
                <View style={{ gap: spacing.xs }}>
                  <StatusBlock
                    colors={colors}
                    tone={medical.eligibility.training.eligible ? "success" : "danger"}
                    icon={medical.eligibility.training.eligible ? "checkmark" : "close"}
                    eyebrow={medicalCopy.eligibilityTraining}
                    label={
                      medical.eligibility.training.eligible ? medicalCopy.eligible : medicalCopy.notEligible
                    }
                  />
                  {medical.eligibility.training.reasons.map((code) => (
                    <Text key={code} style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                      {`• ${eligibilityReasonLabel(code)}`}
                    </Text>
                  ))}
                </View>
                {medical.openReviewRequests.length > 0 ? (
                  <CountRow
                    colors={colors}
                    count={medical.openReviewRequests.length}
                    label={medicalCopy.openRequests}
                  />
                ) : null}
              </View>
            ) : medicalError ? (
              <Text style={[type.body, { color: colors.inkMuted }]}>{medicalError}</Text>
            ) : loading ? (
              <SkeletonBlock colors={colors} height={80} label={coach.loading} />
            ) : (
              <Text style={[type.body, { color: colors.inkMuted }]}>—</Text>
            )}
            <Text style={[type.link, { color: colors.lotus }]}>{coach.openMedical}</Text>
          </CoachCard>

          <Text style={[type.title, { color: colors.ink }]}>{coach.sessionHistory}</Text>
          <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
            {coach.sessionHistoryHint}
          </Text>
          {sessions.length > 0 ? (
            <CoachCard>
              <SessionTimeline
                colors={colors}
                rows={sessions}
                whenLabel={formatWhen}
                typeLabel={(value) => coach.sessionTypeLabel[value]}
                statusLabel={(value) => coach.sessionStatus[value]}
                onPressRow={(row) => router.push(coachHref(`/(coach)/schedule/${row.id}`))}
              />
              <Divider colors={colors} />
              <SessionTypeMix
                colors={colors}
                sessions={sessions}
                typeLabel={(value) => coach.sessionTypeLabel[value]}
                title={`${coach.sessionType} · ${sessions.length}`}
              />
            </CoachCard>
          ) : loading ? (
            <SkeletonCards colors={colors} count={1} label={coach.loading} />
          ) : (
            <CoachBanner message={coach.emptySessions} />
          )}

          <CoachCard>
            <LinkRow
              colors={colors}
              label="Video võ sĩ"
              onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/videos`))}
            />
            <LinkRow
              colors={colors}
              label="Mục tiêu võ sĩ"
              onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/goals`))}
            />
            <LinkRow
              colors={colors}
              label="Hiệu suất võ sĩ"
              onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/performance`))}
            />
          </CoachCard>

          <Text style={[type.title, { color: colors.ink }]}>{coach.fighterPlans}</Text>
          <View style={{ gap: spacing.sm }}>
            {plans.length === 0 ? (
              loading ? (
                <SkeletonCards colors={colors} count={1} label={coach.loading} />
              ) : (
                <CoachBanner message={coach.emptyPlans} />
              )
            ) : null}
            {plans.map((row) => (
              <CoachCard
                key={row.id}
                onPress={() => router.push(coachHref(`/(coach)/plans/${row.id}`))}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                  <PlanStatusMark colors={colors} status={row.status} size={52} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Text style={[type.body, { color: colors.ink }]} numberOfLines={2}>
                      {row.title}
                    </Text>
                    <StatusChip
                      colors={colors}
                      label={coach.planStatus[row.status]}
                      tone={PLAN_STATUS_TONE[row.status]}
                    />
                  </View>
                </View>
                <Text style={[type.link, { color: colors.lotus, alignSelf: "flex-end" }]}>{coach.openPlan}</Text>
              </CoachCard>
            ))}
          </View>

          <Text style={[type.title, { color: colors.ink }]}>{coach.assignments}</Text>
          <View style={{ gap: spacing.sm }}>
            {assignments.length === 0 ? (
              loading ? (
                <SkeletonCards colors={colors} count={1} label={coach.loading} />
              ) : (
                <CoachBanner message={coach.emptyAssignments} />
              )
            ) : null}
            {assignments.map((row) => {
              const coachName = row.coachName ?? coach.coachFallback;
              return (
                <CoachCard key={row.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <AvatarInitials colors={colors} name={coachName} />
                    <View style={{ flex: 1, gap: spacing.xs }}>
                      <Text style={[type.body, { color: colors.ink }]} numberOfLines={1}>
                        {coachName}
                      </Text>
                      <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                        {formatWhen(row.startsAt)}
                        {row.endsAt ? ` – ${formatWhen(row.endsAt)}` : ""}
                        {row.coachGym ? ` · ${row.coachGym}` : ""}
                      </Text>
                      {row.endReason ? (
                        <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                          {coach.endReason}: {row.endReason}
                        </Text>
                      ) : null}
                      <StatusChip
                        colors={colors}
                        label={row.endsAt ? coach.assignmentEnded : coach.assignmentActive}
                        tone={row.endsAt ? "neutral" : "success"}
                      />
                    </View>
                  </View>
                </CoachCard>
              );
            })}
          </View>

          <Text style={[type.title, { color: colors.ink }]}>{coach.measurementTitle}</Text>
          {measurements.length === 0 ? (
            loading ? (
              <SkeletonCards colors={colors} count={1} label={coach.loading} />
            ) : (
              <CoachBanner message={coach.emptyMeasurements} />
            )
          ) : (
            <CoachCard>
              <WeightChart
                colors={colors}
                points={measurements.map((row) => ({
                  id: row.id,
                  weightKg: row.weightKg,
                  measuredAt: row.measuredAt,
                  caption: measurementContextLabel(row.measurementContext),
                }))}
                unit="kg"
                latestNote={(latest) => `${latest.caption ?? ""} · ${shortDate(latest.measuredAt)}`}
              />
              <Divider colors={colors} />
              {measurements.map((row) => (
                <View key={row.id} style={{ gap: 2 }}>
                  <Text style={[type.body, { color: colors.ink }]}>
                    {row.weightKg} kg · {measurementContextLabel(row.measurementContext)}
                  </Text>
                  <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                    {formatWhen(row.measuredAt)}
                  </Text>
                </View>
              ))}
            </CoachCard>
          )}
        </>
      ) : null}
    </CoachScaffold>
  );
}
