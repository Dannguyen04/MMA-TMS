import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import {
  listAssignedApplications,
  type ApplicationStatus,
  type StaffApplication,
} from "@/api/admissions";
import { useToastMessage } from "@/components/toast/app-toast";
import { vi } from "@/i18n/vi";
import { AdminApplicationListScreen } from "@/screens/admin/admin-applications";
import { AdmissionPage } from "@/screens/admissions/page";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

export function StaffListScreen({
  audience,
}: {
  audience: "admin" | "coach";
}) {
  const { colors } = useThemePreference();
  const router = useRouter();
  const [items, setItems] = useState<StaffApplication[]>([]);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (audience === "admin") return;
    const request = listAssignedApplications;
    void request({ page: 1, limit: 20 })
      .then((page) => {
        setItems(page.items);
        setTotal(page.total);
        setLoaded(true);
        setError("");
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [audience]);

  useEffect(() => {
    load();
  }, [load]);

  const open = (id: string) => {
    const href = audience === "admin" ? `/quan-tri/nhap-hoc/${id}` : `/danh-gia/${id}`;
    router.push(href as never);
  };

  if (audience === "admin") {
    return <AdminApplicationListScreen />;
  }

  return (
    <AdmissionPage title={vi.admission.roleCoach} onBack={false}>
      <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.assigned}</Text>
      {items.length === 0 ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.empty}</Text>
      ) : null}
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" onPress={() => open(item.id)}>
          <Text style={[type.body, { color: colors.ink }]}>
            {item.applicant.lastName} {item.applicant.firstName}
          </Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {vi.admission.status[item.status as ApplicationStatus]}
          </Text>
        </Pressable>
      ))}
    </AdmissionPage>
  );
}
