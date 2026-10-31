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
  CoachChip,
  CoachField,
  CoachScaffold,
} from "@/screens/coach/coach-ui";
import { useSession } from "@/session/session-context";
import { spacing, type, useThemePreference } from "@/theme";

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

  const load = useCallback((query?: string, status?: MedicalStatus | "") => {
    if (isDemo) {
      setRows([]);
      setToday([]);
      setError("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    void Promise.all([
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
    <CoachScaffold title={coach.tabs.fighters} keyboard>
      <Text style={[type.title, { color: colors.ink }]}>{coach.today}</Text>
      {today.length === 0 && !loading ? <CoachBanner message={coach.emptyToday} /> : null}
      <View style={{ gap: spacing.sm }}>
        {today.map((row) => (
          <CoachCard
            key={row.id}
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
      <Text style={[type.label, { color: colors.inkMuted, lineHeight: 18 }]}>
        {coach.filterMedical}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        <CoachChip
          value=""
          selected={medical === ""}
          label={coach.filterAll}
          onPress={() => {
            setMedical("");
            load(search, "");
          }}
        />
        {MEDICAL_STATUSES.map((value) => (
          <CoachChip
            key={value}
            value={value}
            selected={medical === value}
            label={coach.medicalStatus[value]}
            onPress={(next) => {
              setMedical(next);
              load(search, next);
            }}
          />
        ))}
      </View>
      {loading && rows.length === 0 ? <CoachBanner message={coach.loading} /> : null}
      {rows.length === 0 && !loading && !error ? <CoachBanner message={coach.emptyFighters} /> : null}
      <View style={{ gap: spacing.md }}>
        {rows.map((row) => (
          <CoachCard
            key={row.id}
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
      <Pressable accessibilityRole="button" onPress={() => load(search, medical)}>
        <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
      </Pressable>
    </CoachScaffold>
  );
}
