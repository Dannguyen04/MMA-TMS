import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";

import { getMe } from "@/api/auth";
import { activateAdmission, getOwnApplication, type ApplicantApplication } from "@/api/admissions";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthFormError } from "@/components/auth/auth-form-error";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { mapApiMessage } from "@/session/map-api-message";
import { homeHrefForGate, useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

export function ApplicantDetailScreen({ id }: { id: string }) {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { applyRegisteredSession } = useSession();
  const [item, setItem] = useState<ApplicantApplication | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    void getOwnApplication(id)
      .then((next) => {
        setItem(next);
        setError("");
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onActivate = () => {
    if (busy) return;
    setBusy(true);
    setNotice("");
    void activateAdmission()
      .then(async (result) => {
        setNotice(result.alreadyActive ? vi.admission.activated : vi.admission.activated);
        const me = await getMe();
        const gate = applyRegisteredSession(me);
        router.replace(homeHrefForGate(gate));
      })
      .catch((cause: unknown) => setError(mapApiMessage(cause)))
      .finally(() => setBusy(false));
  };

  const canActivate = item?.status === "APPROVED" && item.activation?.status === "PASSWORD_SET";
  const waitingPassword = item?.status === "APPROVED" && item.activation?.status !== "PASSWORD_SET" && item.activation?.status !== "COMPLETED";

  return (
    <AdmissionPage title={vi.admission.title}>
      <AuthFormError message={error} />
      <AuthFormError message={notice} tone="success" />
      {item ? (
        <>
          <Text style={[type.title, { color: colors.ink }]}>
            {item.applicant.lastName} {item.applicant.firstName}
          </Text>
          <Text style={[type.body, { color: colors.inkMuted }]}>{vi.admission.status[item.status]}</Text>
          <Text style={[type.caption, { color: colors.inkMuted }]}>{item.applicant.email}</Text>
          {waitingPassword ? (
            <Text style={[type.body, { color: colors.ink }]}>{vi.admission.waitPassword}</Text>
          ) : null}
          {canActivate ? (
            <AuthButton title={vi.admission.activate} onPress={onActivate} loading={busy} disabled={busy} />
          ) : null}
        </>
      ) : null}
    </AdmissionPage>
  );
}
