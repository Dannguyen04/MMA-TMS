import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
} from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  MEDICAL_STATUSES,
  isApiError,
  listDoctorFighters,
  type MedicalStatus,
  type PublicFighter,
  type PublicUser,
} from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { doctor } from "@/i18n/doctor";
import { vi } from "@/i18n/vi";
import { mapApiMessage } from "@/session/map-api-message";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

import { DoctorCard, DoctorChrome, doctorStyles, fighterName } from "./doctor-chrome";
import { useSelectedFighter } from "./selected-fighter";

function profileId(user: PublicUser | null): string | null {
  const profile = user?.profile;
  if (!profile || typeof profile.id !== "string") return null;
  return profile.id;
}

export function DoctorFightersScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, isDemo } = useSession();
  const { fighter: selected, setFighter } = useSelectedFighter();
  const [rows, setRows] = useState<PublicFighter[]>([]);
  const [filter, setFilter] = useState<MedicalStatus | "">("");
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (soft = false) => {
    if (isDemo || user?.role !== "DOCTOR") {
      setRows([]);
      setError("");
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const doctorId = profileId(user);
      if (!doctorId) {
        setRows([]);
        setError(doctor.roleOnly);
        return;
      }
      const page = await listDoctorFighters(doctorId, { page: 1, limit: 50 });
      setRows(page.data);
    } catch (cause: unknown) {
      setRows([]);
      if (isApiError(cause) && cause.status === 403) {
        setError(doctor.roleOnly);
      } else {
        setError(mapApiMessage(cause));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isDemo, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMedical = (row: PublicFighter) => {
    setFighter(row);
    router.navigate("/(doctor)/medical" as Href);
  };

  const visible = filter
    ? rows.filter((row) => row.currentMedicalStatus === filter)
    : rows;
  const counts = MEDICAL_STATUSES.map((status) => ({
    status,
    count: rows.filter((row) => row.currentMedicalStatus === status).length,
  }));

  return (
    <DoctorChrome title={doctor.fighters.title} subtitle={doctor.fighters.subtitle}>
      {loading ? (
        <ActivityIndicator color={colors.lotus} />
      ) : (
        <ScrollView
          contentContainerStyle={doctorStyles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
          }
        >
          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void load()} style={doctorStyles.link}>
              <Text style={[type.link, { color: colors.lotus }]}>{doctor.retry}</Text>
            </Pressable>
          ) : null}

          <DoctorCard>
            <Text style={[type.label, { color: colors.lotus }]}>{doctor.fighters.overview}</Text>
            {counts.map((item) => (
              <Pressable
                key={item.status}
                accessibilityRole="button"
                onPress={() => setFilter(filter === item.status ? "" : item.status)}
              >
                <Text style={[type.body, { color: colors.ink }]}>
                  {doctor.status[item.status]}: {item.count}
                </Text>
              </Pressable>
            ))}
            <Pressable accessibilityRole="button" onPress={() => setFilter("")}>
              <Text style={[type.link, { color: colors.lotus }]}>{doctor.fighters.filterAll}</Text>
            </Pressable>
          </DoctorCard>

          {!error && visible.length === 0 ? (
            <DoctorCard>
              <Text style={[type.label, { color: colors.inkMuted }]}>{doctor.fighters.empty}</Text>
            </DoctorCard>
          ) : null}

          {visible.map((row) => {
            const active = selected?.id === row.id;
            const weight = vi.weightClass[row.weightClass];
            const status = doctor.status[row.currentMedicalStatus];
            return (
              <Pressable
                key={row.id}
                accessibilityRole="button"
                onPress={() => openMedical(row)}
              >
                <DoctorCard>
                  <Text style={[type.body, { color: colors.ink }]}>{fighterName(row)}</Text>
                  <Text style={[type.label, { color: colors.inkMuted }]}>
                    {weight}
                    {row.gym ? ` · ${row.gym}` : ""}
                    {` · ${status}`}
                  </Text>
                  {active ? (
                    <Text style={[type.caption, { color: colors.lotus }]}>{doctor.fighters.openMedical}</Text>
                  ) : (
                    <Text style={[type.link, { color: colors.lotus }]}>{doctor.fighters.openMedical}</Text>
                  )}
                </DoctorCard>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </DoctorChrome>
  );
}
