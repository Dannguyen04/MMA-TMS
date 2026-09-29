import { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { getFighterMedical } from "@/api";
import { MedicalDossierView } from "@/components/medical/medical-dossier-view";
import { ReviewRequestPanel } from "@/components/medical/review-request-panel";
import { listFighterMeasurements, type FighterMeasurement } from "@/screens/fighter/api";
import { isAccessLoss } from "@/screens/fighter/errors";
import { fighter } from "@/i18n/fighter";
import { medical } from "@/i18n/medical";
import { formatWhen } from "@/screens/fighter/format";
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

export function FighterBodyScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { fighterId, isDemo, canFetch } = useFighterId();

  const loadDossier = useCallback(async () => {
    if (!fighterId) throw new Error("missing");
    return getFighterMedical(fighterId);
  }, [fighterId]);

  const dossier = useLoad(canFetch, `dossier:${fighterId ?? "none"}`, loadDossier);

  /** Fighter baseline has no `fighter.measurement:read`; a 403 hides the section instead of failing the screen. */
  const loadMeasurements = useCallback(async (): Promise<FighterMeasurement[] | null> => {
    if (!fighterId) return [];
    try {
      const page = await listFighterMeasurements(fighterId, {
        page: 1,
        limit: 50,
        includeSuperseded: false,
      });
      return page.data;
    } catch (cause: unknown) {
      if (isAccessLoss(cause)) return null;
      throw cause;
    }
  }, [fighterId]);

  const measurements = useLoad(canFetch, `measure:${fighterId ?? "none"}`, loadMeasurements);
  const rows = measurements.data;

  return (
    <FighterScreen title={fighter.body.title} keyboard refreshing={dossier.loading}>
      {isDemo || !canFetch ? <EmptyCopy text={fighter.common.demoHint} /> : null}

      <StatusLine message={dossier.error} onRetry={dossier.reload} />
      {dossier.data ? (
        <MedicalDossierView
          dossier={dossier.data}
          onOpenInjury={(injuryId) => router.push(`/suc-khoe/chan-thuong/${injuryId}` as Href)}
        />
      ) : !dossier.error ? (
        <GlassCard>
          <EmptyCopy text={dossier.loading ? fighter.common.loading : medical.disclaimer} />
        </GlassCard>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/suc-khoe/lich-su" as Href)}
        style={styles.link}
      >
        <Text style={[type.link, { color: colors.lotus }]}>{medical.openHistory}</Text>
      </Pressable>

      {fighterId ? (
        <ReviewRequestPanel fighterId={fighterId} enabled={canFetch} onSubmitted={dossier.reload} />
      ) : null}

      {rows === null && !measurements.error ? null : (
        <>
          <SectionLabel text={fighter.body.measurements} />
          <StatusLine message={measurements.error} onRetry={measurements.reload} />
          <GlassCard>
            {rows && rows.length > 0 ? (
              rows.map((row) => (
                <View key={row.id} style={styles.row}>
                  <Text style={[type.body, { color: colors.ink }]}>
                    {row.weightKg} kg
                    {row.heightCm != null ? ` · ${row.heightCm} cm` : ""}
                    {row.reachCm != null ? ` · sải ${row.reachCm} cm` : ""}
                  </Text>
                  <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                    {formatWhen(row.measuredAt)}
                  </Text>
                  {row.notes ? (
                    <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                      {row.notes}
                    </Text>
                  ) : null}
                </View>
              ))
            ) : (
              <EmptyCopy text={measurements.loading ? fighter.common.loading : fighter.body.empty} />
            )}
          </GlassCard>
        </>
      )}
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  row: { gap: 2, paddingVertical: spacing.sm },
  meta: { lineHeight: 16 },
  link: { minHeight: 44, justifyContent: "center" },
});
