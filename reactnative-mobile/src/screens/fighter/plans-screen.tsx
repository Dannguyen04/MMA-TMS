import { useCallback } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter, type Href } from "expo-router";

import { listPlansForFighter } from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import { formatDay, planStatusLabel } from "@/screens/fighter/format";
import { EmptyCopy, FighterScreen, GlassCard, StatusLine } from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { type, useThemePreference } from "@/theme";

export function FighterPlansScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { fighterId, isDemo, canFetch } = useFighterId();

  const load = useCallback(async () => {
    if (!fighterId) return [];
    const page = await listPlansForFighter(fighterId, { page: 1, limit: 50 });
    return page.data;
  }, [fighterId]);

  const { data, error, loading, reload } = useLoad(canFetch, fighterId ?? "none", load);
  const rows = data ?? [];
  const emptyHint = isDemo || !canFetch ? fighter.common.demoHint : fighter.plans.empty;

  return (
    <FighterScreen title={fighter.plans.title} refreshing={loading}>
      <StatusLine message={error} onRetry={reload} />
      <GlassCard>
        {rows.length > 0 ? (
          rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/giao-an/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {planStatusLabel(row.status)} · {formatDay(row.startDate)}
                {row.endDate ? ` – ${formatDay(row.endDate)}` : ""}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyCopy text={emptyHint} />
        )}
      </GlassCard>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/giao-an/bai-tap" as Href)}
        style={styles.link}
      >
        <Text style={[type.link, { color: colors.lotus }]}>{fighter.exercises.openLibrary}</Text>
      </Pressable>
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 48, justifyContent: "center", gap: 2 },
  meta: { lineHeight: 16 },
  link: { minHeight: 44, justifyContent: "center" },
});
