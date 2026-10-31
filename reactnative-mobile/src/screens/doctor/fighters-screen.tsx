import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter, type Href } from "expo-router";

import {
  MEDICAL_STATUSES,
  listDoctorFighters,
  type MedicalStatus,
  type PublicFighter,
} from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { doctor } from "@/i18n/doctor";
import { vi } from "@/i18n/vi";
import { useSession } from "@/session/session-context";
import { FilterSelect } from "@/components/filter-sheet";
import { spacing, type, useThemePreference } from "@/theme";

import { medicalBadgeId } from "./badge-colors";
import {
  DoctorChrome,
  DoctorScroll,
  clinicalMessage,
  doctorMuted,
  doctorProfileId,
  doctorStyles,
  fighterInitials,
  fighterName,
} from "./doctor-chrome";
import { StatusBadge } from "./status-badge";
import { useSelectedFighter } from "./selected-fighter";
import { Icon } from "@/components/icon";
import { FadeInView, SkeletonList } from "@/components/motion";
import { StateView } from "@/components/state-view";

export function DoctorFightersScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { user, isDemo } = useSession();
  const { setFighter } = useSelectedFighter();
  const [rows, setRows] = useState<PublicFighter[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<MedicalStatus | "">("");
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial") => {
    if (isDemo || user?.role !== "DOCTOR") {
      setRows([]);
      setTotal(0);
      setError("");
      setLoading(false);
      return;
    }
    if (mode === "initial") {
      setLoading(true);
      setError("");
    }
    try {
      const doctorId = doctorProfileId(user);
      if (!doctorId) {
        setRows([]);
        setTotal(0);
        setError(doctor.roleOnly);
        return;
      }
      const page = await listDoctorFighters(doctorId, { page: 1, limit: 50 });
      setRows(page.data);
      setTotal(page.total);
    } catch (cause: unknown) {
      if (mode === "refresh") throw cause;
      setRows([]);
      setTotal(0);
      setError(clinicalMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [isDemo, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const openMedical = (row: PublicFighter) => {
    setFighter(row);
    router.push("/(doctor)/medical" as Href);
  };

  const muted = doctorMuted(colors);
  const visible = filter ? rows.filter((row) => row.currentMedicalStatus === filter) : rows;
  const chips: { id: MedicalStatus | ""; label: string }[] = [
    { id: "", label: doctor.fighters.filterAll },
    ...MEDICAL_STATUSES.map((status) => ({ id: status, label: doctor.status[status] })),
  ];

  return (
    <DoctorChrome
      title={doctor.fighters.title}
    >
      {loading && rows.length === 0 ? (
        <View style={doctorStyles.list}>
          <SkeletonList rows={4} height={72} />
        </View>
      ) : (
        <DoctorScroll contentContainerStyle={doctorStyles.list} onRefresh={() => load("refresh")}>
          <Text style={[type.body, { color: colors.ink }]}>{doctor.fighters.subtitle}</Text>
          {!error ? (
            <Text style={[type.caption, { color: muted }]}>
              {doctor.fighters.count(filter ? visible.length : total)}
            </Text>
          ) : null}
          <FilterSelect
            label={doctor.fighters.filterLabel}
            options={chips.map((chip) => ({ value: chip.id, label: chip.label }))}
            value={filter}
            allValue=""
            onChange={setFilter}
          />

          {error ? (
            <Pressable accessibilityRole="button" onPress={() => void load()} style={doctorStyles.link}>
              <Text style={[type.link, { color: colors.lotus }]}>{doctor.retry}</Text>
            </Pressable>
          ) : null}

          {!error && visible.length === 0 ? <StateView kind="empty" compact title={doctor.fighters.empty} /> : null}

          {visible.map((row, i) => {
            const weight = vi.weightClass[row.weightClass];
            const status = doctor.status[row.currentMedicalStatus];
            return (
              <FadeInView key={row.id} index={i}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openMedical(row)}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    paddingVertical: spacing.lg,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.line,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <View
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 23,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.surfaceMuted,
                  }}
                >
                  <Text style={[type.body, { color: colors.ink }]}>{fighterInitials(row)}</Text>
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={[type.body, { color: colors.ink }]}>{fighterName(row)}</Text>
                  <Text style={[type.caption, { color: muted }]}>
                    {weight}
                    {row.gym ? ` · ${row.gym}` : ""}
                  </Text>
                  <StatusBadge id={medicalBadgeId(row.currentMedicalStatus)} label={status} />
                </View>
                <Icon name="chevron" size={18} color={muted} />
              </Pressable>
              </FadeInView>
            );
          })}
        </DoctorScroll>
      )}
    </DoctorChrome>
  );
}
