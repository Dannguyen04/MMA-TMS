import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import {
  getFighterMedical,
  listFighterMedicalHistory,
  type MedicalHistoryEntry,
  type MedicalInjury,
  type RecoveryPlan,
} from "@/api";
import { RecoveryPlanBlock } from "@/components/medical/medical-dossier-view";
import {
  describeSnapshot,
  formatMedicalWhen,
  injuryFromSnapshot,
  injuryStatusLabel,
  jointLabel,
  severityLabel,
} from "@/components/medical/medical-format";
import { MedicalFact, MedicalMuted } from "@/components/medical/medical-ui";
import { fighter } from "@/i18n/fighter";
import { medical } from "@/i18n/medical";
import {
  EmptyCopy,
  FighterScreen,
  GlassCard,
  SectionLabel,
  StatusLine,
} from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { spacing, type, useThemePreference } from "@/theme";
import { SkeletonRows } from "@/components/loading";

const HISTORY_PAGE = 100;
const HISTORY_MAX_PAGES = 5;

type InjuryDetail = {
  injury: MedicalInjury | null;
  plans: RecoveryPlan[];
  treatments: MedicalHistoryEntry[];
};

async function collectHistory(
  fighterId: string,
  recordType: "INJURY" | "TREATMENT",
  keep: (entry: MedicalHistoryEntry) => boolean,
): Promise<MedicalHistoryEntry[]> {
  const found: MedicalHistoryEntry[] = [];
  for (let page = 1; page <= HISTORY_MAX_PAGES; page += 1) {
    const result = await listFighterMedicalHistory(fighterId, { page, limit: HISTORY_PAGE, recordType });
    found.push(...result.data.filter(keep));
    if (!result.hasNextPage) break;
  }
  return found;
}

/**
 * The backend has no `GET /injuries/:id`: an active injury comes from the dossier,
 * a resolved one from its latest INJURY history snapshot.
 */
export function FighterInjuryDetailScreen() {
  const { colors } = useThemePreference();
  const { id } = useLocalSearchParams<{ id: string }>();
  const injuryId = typeof id === "string" ? id : "";
  const { fighterId, canFetch, isDemo } = useFighterId();

  const load = useCallback(async (): Promise<InjuryDetail> => {
    if (!fighterId || !injuryId) return { injury: null, plans: [], treatments: [] };
    const dossier = await getFighterMedical(fighterId);
    let injury = dossier.activeInjuries.find((row) => row.id === injuryId) ?? null;
    if (!injury) {
      const revisions = await collectHistory(fighterId, "INJURY", (entry) => entry.recordId === injuryId);
      const latest = revisions.reduce<MedicalHistoryEntry | null>(
        (best, entry) => (!best || entry.revision > best.revision ? entry : best),
        null,
      );
      injury = latest ? injuryFromSnapshot(latest) : null;
    }
    const treatments = injury
      ? await collectHistory(fighterId, "TREATMENT", (entry) => entry.snapshot?.injury_id === injuryId)
      : [];
    return {
      injury,
      plans: dossier.activeRecoveryPlans.filter((plan) => plan.injuryId === injuryId),
      treatments,
    };
  }, [fighterId, injuryId]);

  const { data, error, loading, reload, refresh } = useLoad(
    canFetch && !!injuryId,
    `${fighterId ?? "none"}:${injuryId}`,
    load,
  );
  const injury = data?.injury ?? null;

  return (
    <FighterScreen title={medical.injuryDetail} onBack refreshing={loading} onRefresh={refresh}>
      <StatusLine message={error} onRetry={reload} />
      {injury ? (
        <GlassCard>
          <Text style={[type.title, { color: colors.ink }]}>
            {jointLabel(injury.affectedJoint)} · {injury.injuryType}
          </Text>
          <MedicalFact label={fighter.tap.status} value={injuryStatusLabel(injury.status)} />
          <MedicalFact label={medical.severityTitle} value={severityLabel(injury.severity)} />
          <MedicalFact label={medical.occurredAt} value={formatMedicalWhen(injury.occurredAt)} />
          {injury.resolvedAt ? (
            <MedicalFact label={medical.resolvedAt} value={formatMedicalWhen(injury.resolvedAt)} />
          ) : null}
          {injury.description ? (
            <MedicalFact label={fighter.plans.description} value={injury.description} />
          ) : null}
          <MedicalMuted text={medical.disclaimer} />
        </GlassCard>
      ) : (
        <GlassCard>
          {!isDemo && canFetch && (loading || !data) ? (
            <SkeletonRows rows={3} />
          ) : (
            <EmptyCopy text={isDemo || !canFetch ? fighter.common.demoHint : medical.injuryMissing} />
          )}
        </GlassCard>
      )}

      {injury && data && data.plans.length > 0 ? (
        <>
          <SectionLabel text={medical.recoveryPlans} />
          <GlassCard>
            {data.plans.map((plan) => (
              <RecoveryPlanBlock key={plan.id} plan={plan} />
            ))}
          </GlassCard>
        </>
      ) : null}

      {injury && data && data.treatments.length > 0 ? (
        <>
          <SectionLabel text={medical.recordType.TREATMENT} />
          <GlassCard>
            {data.treatments.map((entry) => {
              const view = describeSnapshot(entry);
              return (
                <View key={`${entry.recordId}:${entry.revision}`} style={styles.row}>
                  {view.lines.map((line) => (
                    <MedicalFact key={line.label} label={line.label} value={line.value} />
                  ))}
                </View>
              );
            })}
          </GlassCard>
        </>
      ) : null}
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.xs, paddingVertical: spacing.sm },
});
