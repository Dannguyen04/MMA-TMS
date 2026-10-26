import { useCallback, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { useToastMessage } from "@/components/toast/app-toast";

import {
  MEDICAL_STATUSES,
  listFighters,
  listTrainingSessions,
  type MedicalStatus,
  type PublicFighter,
  type TrainingSession,
} from "@/api";
import { coach } from "@/i18n/coach";
import { vi } from "@/i18n/vi";
import { coachErrorMessage, coachHref, fighterDisplayName, formatWhen } from "@/screens/coach/coach-error";
import {
  CoachBanner,
  CoachCard,
  CoachField,
  CoachScaffold,
  CoachEmpty,
} from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";
import { SkeletonList } from "@/components/motion";
import { FilterSelect } from "@/components/filter-sheet";

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function CoachFightersScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { isDemo } = useSession();
  const [search, setSearch] = useState("");
  const [medical, setMedical] = useState<MedicalStatus | "">("");
  const [rows, setRows] = useState<PublicFighter[]>([]);
  const [today, setToday] = useState<TrainingSession[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);
  const searchRef = useRef(search);
  searchRef.current = search;
  const medicalRef = useRef(medical);
  medicalRef.current = medical;

  const load = useCallback((query?: string, status?: MedicalStatus | "", mode?: "refresh") => {
    if (isDemo) {
      setRows([]);
      setToday([]);
      setError("");
      setLoading(false);
      return;
    }
    if (mode !== "refresh") setLoading(true);
    setError("");
    return Promise.all([
      listFighters({
        search: query?.trim() || undefined,
        medicalStatus: status || undefined,
        limit: 50,
      }),
      listTrainingSessions({ limit: 50 }),
    ])
      .then(([page, sessions]) => {
        setRows(page.data);
        setToday(sessions.data.filter((row) => isToday(row.scheduledAt)));
      })
      .catch((cause: unknown) => {
        if (mode === "refresh") throw cause;
        setRows([]);
        setToday([]);
        setError(coachErrorMessage(cause));
      })
      .finally(() => setLoading(false));
  }, [isDemo]);

  useFocusEffect(
    useCallback(() => {
      load(searchRef.current, medicalRef.current);
    }, [load]),
  );

  return (
    <CoachScaffold title={coach.tabs.fighters} keyboard onRefresh={() => load(search, medical, "refresh")}>
      <Text style={[type.title, { color: colors.ink }]}>{coach.today}</Text>
      {today.length === 0 && !loading ? <CoachEmpty message={coach.emptyToday} /> : null}
      <View style={{ gap: spacing.sm }}>
        {today.map((row, i) => (
          <CoachCard
            key={row.id}
            index={i}
            onPress={() => router.push(coachHref(`/(coach)/schedule/${row.id}`))}
          >
            <Text style={[type.body, { color: colors.ink }]}>{row.title}</Text>
            <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
              {formatWhen(row.scheduledAt)} · {coach.sessionStatus[row.status]}
            </Text>
          </CoachCard>
        ))}
      </View>

      <CoachField
        label={coach.search}
        helper={coach.searchHint}
        value={search}
        onChangeText={setSearch}
        onSubmitEditing={() => load(search, medical)}
        returnKeyType="search"
      />
      <FilterSelect
        label={coach.filterMedical}
        options={[{ value: "" as const, label: coach.filterAll }, ...MEDICAL_STATUSES.map((value) => ({ value, label: coach.medicalStatus[value] }))]}
        value={medical}
        allValue=""
        onChange={(next) => {
          setMedical(next);
          load(search, next);
        }}
      />
      {loading && rows.length === 0 ? <SkeletonList rows={3} /> : null}
      {rows.length === 0 && !loading && !error ? <CoachEmpty message={coach.emptyFighters} /> : null}
      <View style={{ gap: spacing.md }}>
        {rows.map((row, i) => (
          <CoachCard
            key={row.id}
            index={i}
            onPress={() => router.push(coachHref(`/(coach)/fighters/${row.id}`))}
          >
            <Text style={[type.body, { color: colors.ink }]}>{fighterDisplayName(row)}</Text>
            <Text style={[type.caption, { color: colors.inkMuted, lineHeight: 16 }]}>
              {coach.weightClass}: {vi.weightClass[row.weightClass]} · {coach.medicalStatus[row.currentMedicalStatus]}
            </Text>
            {row.gym ? (
              <Text style={[type.caption, { color: colors.inkSubtle, lineHeight: 16 }]}>
                {coach.gym}: {row.gym}
              </Text>
            ) : null}
          </CoachCard>
        ))}
      </View>
      {error ? (
        <Pressable accessibilityRole="button" onPress={() => void load(search, medical)}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
        </Pressable>
      ) : null}
    </CoachScaffold>
  );
}
