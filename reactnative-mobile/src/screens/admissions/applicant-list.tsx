import { useCallback, useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";

import {
  listOwnApplications,
  type ApplicantApplication,
} from "@/api/admissions";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { useSession } from "@/session/session-context";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

export function ApplicantListScreen({
  detailHref,
  showSubmit,
}: {
  detailHref: (id: string) => string;
  showSubmit?: boolean;
}) {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { signOut, user } = useSession();
  const [items, setItems] = useState<ApplicantApplication[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    void listOwnApplications({ page: 1, limit: 20 })
      .then((page) => {
        setItems(page.items);
        setError("");
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <AdmissionPage title={showSubmit ? vi.admission.roleGuest : vi.admission.mine} onBack={!showSubmit}>
      {showSubmit ? (
        <>
          <Text style={[type.body, { color: colors.ink }]}>
            {user?.email ?? ""}
          </Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>{vi.admission.guestIntro}</Text>
        </>
      ) : null}
      <AuthFormError message={error} />
      {loading ? <Text style={[type.body, { color: colors.inkMuted }]}>...</Text> : null}
      {!loading && items.length === 0 ? (
        <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.empty}</Text>
      ) : null}
      {items.map((item) => (
        <Pressable
          key={item.id}
          accessibilityRole="button"
          onPress={() => router.push(detailHref(item.id) as never)}
        >
          <Text style={[type.body, { color: colors.ink }]}>
            {item.applicant.lastName} {item.applicant.firstName}
          </Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>
            {vi.admission.status[item.status]}
          </Text>
        </Pressable>
      ))}
      {showSubmit ? (
        <>
          <AuthButton title={vi.admission.submit} onPress={() => router.push("/ho-so/new" as never)} />
          <AuthButton
            title={vi.dashboard.logout}
            variant="secondary"
            onPress={() => {
              void signOut().then(() => router.replace("/login"));
            }}
          />
        </>
      ) : null}
    </AdmissionPage>
  );
}
