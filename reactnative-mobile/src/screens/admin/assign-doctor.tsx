import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";

import {
  assignFighterDoctor,
  listFighterDoctors,
  listFighters,
  listUsers,
  type DoctorAssignment,
  type PublicFighter,
  type PublicUser,
} from "@/api";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import { vi } from "@/i18n/vi";
import { AdminPage } from "@/screens/admin/admin-page";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

function profileId(user: PublicUser): string | null {
  return user.profile && typeof user.profile.id === "string" ? user.profile.id : null;
}

function displayName(user: PublicUser): string {
  const profile = user.profile;
  if (profile && "firstName" in profile) return `${profile.lastName} ${profile.firstName}`.trim();
  return user.email;
}

export function AssignDoctorScreen() {
  const { colors } = useThemePreference();
  const params = useLocalSearchParams<{ fighterId?: string }>();
  const initialFighterId = typeof params.fighterId === "string" ? params.fighterId : "";
  const [fighters, setFighters] = useState<PublicFighter[]>([]);
  const [doctors, setDoctors] = useState<PublicUser[]>([]);
  const [fighterId, setFighterId] = useState(initialFighterId);
  const [doctorId, setDoctorId] = useState("");
  const [assignments, setAssignments] = useState<DoctorAssignment[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
  const [busy, setBusy] = useState(false);

  const loadAssignments = useCallback((id: string) => {
    if (!id) {
      setAssignments([]);
      return;
    }
    void listFighterDoctors(id, { page: 1, limit: 20 })
      .then((page) => setAssignments(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, []);

  useEffect(() => {
    void listFighters({ page: 1, limit: 50 })
      .then((page) => setFighters(page.data))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
    void listUsers({ role: "DOCTOR", status: "ACTIVE", page: 1, limit: 50 })
      .then((page) => setDoctors(page.items.filter((row) => profileId(row))))
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, []);

  useEffect(() => {
    loadAssignments(fighterId);
  }, [fighterId, loadAssignments]);

  const active = assignments.find((row) => row.endsAt == null);
  const selectedDoctor = doctors.find((row) => profileId(row) === active?.doctorId);

  const onAssign = () => {
    if (busy || !fighterId || !doctorId || active) return;
    setBusy(true);
    setError("");
    setNotice("");
    void assignFighterDoctor(fighterId, doctorId)
      .then(() => {
        setNotice("Đã phân công bác sĩ. Bước tiếp theo là khám baseline, chưa tập.");
        loadAssignments(fighterId);
      })
      .catch((cause: unknown) => {
        setError(mapApiMessage(cause));
        loadAssignments(fighterId);
      })
      .finally(() => setBusy(false));
  };

  return (
    <AdminPage title={vi.admission.assignDoctor} onBack blockedNotice={false}>
      <Text style={[type.label, { color: colors.inkMuted }]}>Võ sĩ</Text>
      {fighters.map((row) => (
        <Pressable key={row.id} onPress={() => setFighterId(row.id)}>
          <Text style={[type.body, { color: fighterId === row.id ? colors.lotus : colors.ink }]}>
            {row.lastName} {row.firstName}
          </Text>
        </Pressable>
      ))}
      {active ? (
        <Text style={[type.body, { color: colors.ink }]}>
          Đã có bác sĩ phụ trách{selectedDoctor ? `: ${displayName(selectedDoctor)}` : ""}. Không ghi phân công trùng.
        </Text>
      ) : (
        <>
          <Text style={[type.label, { color: colors.inkMuted }]}>Bác sĩ</Text>
          {doctors.map((row) => {
            const id = profileId(row);
            if (!id) return null;
            return (
              <Pressable key={row.id} onPress={() => setDoctorId(id)}>
                <Text style={[type.body, { color: doctorId === id ? colors.lotus : colors.ink }]}>{displayName(row)}</Text>
              </Pressable>
            );
          })}
          <AuthButton title={vi.admission.assignDoctor} onPress={onAssign} loading={busy} disabled={busy || !fighterId || !doctorId} />
        </>
      )}
    </AdminPage>
  );
}
