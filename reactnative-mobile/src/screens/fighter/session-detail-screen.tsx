import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { getTrainingSession } from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import {
  formatMinutes,
  formatWhen,
  sessionStatusLabel,
  sessionTypeLabel,
} from "@/screens/fighter/format";
import { EmptyCopy, FighterScreen, GlassCard, StatusLine } from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { type, useThemePreference } from "@/theme";

/** Fighter baseline reads Training only: no status changes, RPE or result writes here. */
export function FighterSessionDetailScreen() {
  const { colors } = useThemePreference();
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = typeof id === "string" ? id : "";
  const { canFetch, isDemo } = useFighterId();

  const load = useCallback(async () => {
    if (!sessionId) throw new Error("missing");
    return getTrainingSession(sessionId);
  }, [sessionId]);

  const { data, error, loading, reload } = useLoad(canFetch && !!sessionId, sessionId, load);

  const row = data;

  return (
    <FighterScreen title={fighter.tap.detailTitle} onBack refreshing={loading}>
      <StatusLine message={error} onRetry={reload} />
      {row ? (
        <GlassCard>
          <Text style={[type.title, { color: colors.ink }]}>{row.title}</Text>
          <Fact label={fighter.tap.when} value={formatWhen(row.scheduledAt)} />
          <Fact label={fighter.tap.type} value={sessionTypeLabel(row.sessionType)} />
          <Fact label={fighter.tap.status} value={sessionStatusLabel(row.status)} />
          <Fact label={fighter.tap.place} value={row.location ?? "—"} />
          <Fact label={fighter.tap.rounds} value={String(row.roundCount)} />
          <Fact label={fighter.tap.planned} value={formatMinutes(row.plannedDurationSec)} />
          <Fact label={fighter.tap.actual} value={formatMinutes(row.actualDurationSec)} />
          {row.checkedInAt ? (
            <Fact label={fighter.tap.checkedIn} value={formatWhen(row.checkedInAt)} />
          ) : null}
          {row.completedAt ? (
            <Fact label={fighter.tap.completedAt} value={formatWhen(row.completedAt)} />
          ) : null}
          {row.reportedRpe != null ? (
            <Fact label={fighter.tap.rpe} value={String(row.reportedRpe)} />
          ) : null}
          {row.cancellationReason ? (
            <Fact label={fighter.tap.cancelReason} value={row.cancellationReason} />
          ) : null}
          {row.coachNotes ? <Fact label={fighter.tap.notes} value={row.coachNotes} /> : null}
        </GlassCard>
      ) : (
        <GlassCard>
          <EmptyCopy
            text={isDemo || !canFetch ? fighter.common.demoHint : loading ? fighter.common.loading : fighter.tap.empty}
          />
        </GlassCard>
      )}
    </FighterScreen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  const { colors } = useThemePreference();
  return (
    <View style={styles.fact}>
      <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>{label}</Text>
      <Text style={[type.body, { color: colors.ink }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fact: { gap: 2 },
  meta: { lineHeight: 16 },
});
