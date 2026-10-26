import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";

import { getMe } from "@/api/auth";
import { activateAdmission, getOwnApplication, type ApplicantApplication } from "@/api/admissions";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import {
  APPLICATION_STATUS_ICON,
  APPLICATION_STATUS_TONE,
  InfoRow,
  PersonHeader,
  PersonHeaderSkeleton,
  SkeletonBlock,
  SkeletonCards,
  StatusBlock,
  VisualCard,
} from "@/components/visuals";
import { vi } from "@/i18n/vi";
import { AdmissionPage } from "@/screens/admissions/page";
import { formatDay, weightClassLabel } from "@/screens/fighter/format";
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
  useToastMessage(error, "error");
  useToastMessage(notice, "success");
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
  const loading = item === null && !error;

  return (
    <AdmissionPage title={vi.admission.title}>
      {loading ? (
        <>
          <PersonHeaderSkeleton colors={colors} />
          <SkeletonBlock colors={colors} height={80} />
          <SkeletonCards colors={colors} count={1} />
        </>
      ) : null}
      {item ? (
        <>
          <PersonHeader
            colors={colors}
            name={`${item.applicant.lastName} ${item.applicant.firstName}`}
            stat={weightClassLabel(item.applicant.weightClass)}
          />
          <StatusBlock
            colors={colors}
            tone={APPLICATION_STATUS_TONE[item.status]}
            icon={APPLICATION_STATUS_ICON[item.status]}
            eyebrow={vi.admission.title}
            label={vi.admission.status[item.status]}
          />
          {item.activation || waitingPassword ? (
            <VisualCard colors={colors}>
              {item.activation ? (
                <InfoRow
                  colors={colors}
                  label={vi.admission.activationStatusLabel}
                  value={vi.admission.activationStatus[item.activation.status]}
                />
              ) : null}
              {waitingPassword ? (
                <Text style={[type.body, { color: colors.ink }]}>{vi.admission.waitPassword}</Text>
              ) : null}
            </VisualCard>
          ) : null}
          {canActivate ? (
            <AuthButton title={vi.admission.activate} onPress={onActivate} loading={busy} disabled={busy} />
          ) : null}
          {item.assessment || item.decision ? (
            <VisualCard colors={colors}>
              {item.assessment ? (
                <InfoRow
                  colors={colors}
                  label={`${vi.admission.assessment} · ${formatDay(item.assessment.assessedAt)}`}
                  value={item.assessment.conclusion === "PASS" ? vi.admission.pass : vi.admission.fail}
                />
              ) : null}
              {item.decision ? (
                <InfoRow
                  colors={colors}
                  label={`${vi.admission.decision} · ${formatDay(item.decision.decidedAt)}`}
                  value={vi.admission.status[item.decision.decision]}
                />
              ) : null}
            </VisualCard>
          ) : null}
          <VisualCard colors={colors}>
            <InfoRow colors={colors} label={vi.admission.submittedAt} value={formatDay(item.submittedAt)} />
            <InfoRow colors={colors} label={vi.register.email} value={item.applicant.email} />
            <InfoRow colors={colors} label={vi.register.dateOfBirth} value={formatDay(item.applicant.dateOfBirth)} />
            {item.applicant.nationality ? (
              <InfoRow colors={colors} label={vi.admission.nationality} value={item.applicant.nationality} />
            ) : null}
            {item.applicant.contactPhone ? (
              <InfoRow colors={colors} label={vi.admission.phone} value={item.applicant.contactPhone} />
            ) : null}
            {item.applicant.trainingBackground ? (
              <InfoRow colors={colors} label={vi.admission.training} value={item.applicant.trainingBackground} />
            ) : null}
            {item.applicant.competitionBackground ? (
              <InfoRow colors={colors} label={vi.admission.competition} value={item.applicant.competitionBackground} />
            ) : null}
            {item.applicant.motivation ? (
              <InfoRow colors={colors} label={vi.admission.motivation} value={item.applicant.motivation} />
            ) : null}
          </VisualCard>
        </>
      ) : null}
    </AdmissionPage>
  );
}
