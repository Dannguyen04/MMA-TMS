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
import { CoachBanner, CoachCard, CoachPrimaryButton, CoachScaffold, CoachEmpty } from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";
import { SkeletonList } from "@/components/motion";
import { FilterSelect } from "@/components/filter-sheet";

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

  const load = useCallback((mode?: unknown) => {
    if (isDemo) {
      setSessions([]);
      setFighters({});
      setError("");
      setLoading(false);
      return;
    }
    if (mode !== "refresh") setLoading(true);
    setError("");
    return listTrainingSessions({ limit: 50, ...(status ? { status } : {}) })
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
        if (mode === "refresh") throw cause;
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
      onRefresh={() => load("refresh")}
      title={coach.tabs.schedule}
      action={<CoachPrimaryButton title={coach.newSession} onPress={() => router.push(coachHref("/(coach)/schedule/new"))} />}
    >
      <FilterSelect
        label="Trạng thái"
        options={[{ value: "" as const, label: coach.filterAll }, ...SESSION_STATUSES.map((value) => ({ value, label: coach.sessionStatus[value] }))]}
        value={status}
        allValue=""
        onChange={setStatus}
      />
      {loading && sessions.length === 0 ? <SkeletonList rows={3} /> : null}
      {sessions.length === 0 && !loading && !error ? <CoachEmpty message={coach.emptySessions} /> : null}
      <View style={{ gap: spacing.md }}>
        {sessions.map((row, i) => {
          const fighter = fighters[row.fighterId];
          return (
            <CoachCard key={row.id} index={i} onPress={() => router.push(coachHref(`/(coach)/schedule/${row.id}`))}>
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
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => void load()}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
        </Pressable>
      ) : null}
    </CoachScaffold>
  );
}
