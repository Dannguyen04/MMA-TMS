import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import { SESSION_STATUSES, type SessionStatus } from "@/api";
import { listSessionsForFighter } from "@/screens/fighter/api";
import { fighter } from "@/i18n/fighter";
import { formatWhen, sessionStatusLabel, sessionTypeLabel } from "@/screens/fighter/format";
import {
  EmptyCopy,
  FighterScreen,
  GlassCard,
  StatusLine,
} from "@/screens/fighter/screen";
import { useFighterId } from "@/screens/fighter/use-fighter-id";
import { useLoad } from "@/screens/fighter/use-load";
import { spacing, type, useThemePreference } from "@/theme";

export function FighterSessionsScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { fighterId, isDemo, canFetch } = useFighterId();
  const [status, setStatus] = useState<SessionStatus | "">("");

  const load = useCallback(async () => {
    if (!fighterId) return [];
    const page = await listSessionsForFighter({
      page: 1,
      limit: 50,
      ...(status ? { status } : {}),
    });
    return page.data;
  }, [fighterId, status]);

  const { data, error, loading, reload } = useLoad(
    canFetch,
    `${fighterId ?? "none"}:${status || "all"}`,
    load,
  );
  const rows = data ?? [];
  const emptyHint = isDemo || !canFetch ? fighter.common.demoHint : fighter.tap.empty;

  return (
    <FighterScreen title={fighter.tap.title} refreshing={loading}>
      <View style={styles.chips}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: status === "" }}
          onPress={() => setStatus("")}
          style={[
            styles.chip,
            {
              borderColor: status === "" ? colors.lotus : colors.line,
              backgroundColor: status === "" ? colors.surface : colors.bg,
            },
          ]}
        >
          <Text style={[type.caption, { color: colors.ink }]}>{fighter.tap.filterAll}</Text>
        </Pressable>
        {SESSION_STATUSES.map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: status === value }}
            onPress={() => setStatus(value)}
            style={[
              styles.chip,
              {
                borderColor: status === value ? colors.lotus : colors.line,
                backgroundColor: status === value ? colors.surface : colors.bg,
              },
            ]}
          >
            <Text style={[type.caption, { color: colors.ink }]}>{sessionStatusLabel(value)}</Text>
          </Pressable>
        ))}
      </View>
      <StatusLine message={error} onRetry={reload} />
      <GlassCard>
        {rows.length > 0 ? (
          rows.map((row) => (
            <Pressable
              key={row.id}
              accessibilityRole="button"
              onPress={() => router.push(`/tap/${row.id}` as Href)}
              style={styles.row}
            >
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, styles.meta, { color: colors.inkMuted }]}>
                {formatWhen(row.scheduledAt)} · {sessionTypeLabel(row.sessionType)} ·{" "}
                {sessionStatusLabel(row.status)}
              </Text>
            </Pressable>
          ))
        ) : (
          <EmptyCopy text={emptyHint} />
        )}
      </GlassCard>
    </FighterScreen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: "center",
  },
  row: { minHeight: 48, justifyContent: "center", gap: 2 },
  meta: { lineHeight: 16 },
});
