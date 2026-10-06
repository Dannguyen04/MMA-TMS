import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { useToastMessage } from "@/components/toast/app-toast";

import {
  SESSION_STATUSES,
  listFighters,
  listTrainingSessions,
  type PublicFighter,
  type SessionStatus,
  type TrainingSession,
} from "@/api";
import { coach } from "@/i18n/coach";
import { coachErrorMessage, coachHref, fighterDisplayName, formatWhen } from "@/screens/coach/coach-error";
import { CoachBanner, CoachCard, CoachChip, CoachPrimaryButton, CoachScaffold } from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

export function CoachScheduleScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { isDemo } = useSession();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [fighters, setFighters] = useState<Record<string, PublicFighter>>({});
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SessionStatus | "">("");

  const load = useCallback(() => {
    if (isDemo) {
      setSessions([]);
      setFighters({});
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void listTrainingSessions({ limit: 50, ...(status ? { status } : {}) })
      .then(async (page) => {
        setSessions(page.data);
        try {
          const roster = await listFighters({ limit: 50 });
          const map: Record<string, PublicFighter> = {};
          for (const row of roster.data) map[row.id] = row;
          setFighters(map);
        } catch {
          /* names are optional; list sessions still shows */
        }
      })
      .catch((cause: unknown) => {
        setSessions([]);
        setError(coachErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [isDemo, status]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <CoachScaffold
      title={coach.tabs.schedule}
      action={<CoachPrimaryButton title={coach.newSession} onPress={() => router.push(coachHref("/(coach)/schedule/new"))} />}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <CoachChip
          value=""
          selected={status === ""}
          label={coach.filterAll}
          onPress={() => setStatus("")}
        />
        {SESSION_STATUSES.map((value) => (
          <CoachChip
            key={value}
            value={value}
            selected={status === value}
            label={coach.sessionStatus[value]}
            onPress={setStatus}
          />
        ))}
      </View>
      {loading && sessions.length === 0 ? <CoachBanner message={coach.loading} /> : null}
      {sessions.length === 0 && !loading && !error ? <CoachBanner message={coach.emptySessions} /> : null}
      <View style={{ gap: spacing.md }}>
        {sessions.map((row) => {
          const fighter = fighters[row.fighterId];
          return (
            <CoachCard key={row.id} onPress={() => router.push(coachHref(`/(coach)/schedule/${row.id}`))}>
              <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
              <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
                {formatWhen(row.scheduledAt)} · {coach.sessionStatus[row.status]}
              </Text>
              <Text style={[type.caption, { color: colors.inkSubtle, lineHeight: 16 }]}>
                {fighter ? fighterDisplayName(fighter) : row.fighterId} · {coach.sessionTypeLabel[row.sessionType]}
              </Text>
            </CoachCard>
          );
        })}
      </View>
      <Pressable accessibilityRole="button" onPress={load}>
        <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
      </Pressable>
    </CoachScaffold>
  );
}
