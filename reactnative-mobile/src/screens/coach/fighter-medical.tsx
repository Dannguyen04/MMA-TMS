import { useCallback, useRef, useState } from "react";
import { Text } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";

import { getFighterMedical, isApiError, type MedicalDossier } from "@/api";
import { useToastMessage } from "@/components/toast/app-toast";
import { DoctorAssignmentList } from "@/components/medical/doctor-assignment-list";
import { MedicalDossierView } from "@/components/medical/medical-dossier-view";
import { ReviewRequestPanel } from "@/components/medical/review-request-panel";
import { coach } from "@/i18n/coach";
import { coachErrorMessage, coachHref } from "@/screens/coach/coach-error";
import { CoachBanner, CoachCard, CoachScaffold } from "@/screens/coach/coach-ui";
import { MedicalHistoryContent } from "@/screens/medical/medical-history-screen";
import { useSession } from "@/session/session-context";
import { type, useThemePreference } from "@/theme";

function useCoachFighterId() {
  const params = useLocalSearchParams<{ id: string }>();
  return typeof params.id === "string" ? params.id : "";
}

/** On 403/404 (MEDICAL_ACCESS_DENIED / FORBIDDEN / gone) drop cached clinical data and leave the Fighter. */
function useAccessLoss(clear: () => void) {
  const router = useRouter();
  return useCallback(() => {
    clear();
    router.replace(coachHref("/(coach)/fighters"));
  }, [clear, router]);
}

/** Read-only clinical view for a currently assigned Fighter; the only write is a review request. */
export function CoachFighterMedicalScreen() {
  const { colors } = useThemePreference();
  const router = useRouter();
  const { isDemo } = useSession();
  const fighterId = useCoachFighterId();
  const [dossier, setDossier] = useState<MedicalDossier | null>(null);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const [loading, setLoading] = useState(false);
  const [closed, setClosed] = useState(false);
  const seqRef = useRef(0);

  const clear = useCallback(() => {
    seqRef.current += 1;
    setDossier(null);
    setClosed(true);
  }, []);
  const onAccessLost = useAccessLoss(clear);

  const load = useCallback(() => {
    if (!fighterId || isDemo) return;
    const seq = ++seqRef.current;
    setLoading(true);
    setError("");
    void getFighterMedical(fighterId)
      .then((next) => {
        if (seq !== seqRef.current) return;
        setDossier(next);
        setClosed(false);
      })
      .catch((cause: unknown) => {
        if (seq !== seqRef.current) return;
        setDossier(null);
        if (isApiError(cause) && (cause.status === 403 || cause.status === 404)) {
          onAccessLost();
          return;
        }
        setError(coachErrorMessage(cause));
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false);
      });
  }, [fighterId, isDemo, onAccessLost]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const enabled = !!fighterId && !isDemo && !closed;

  return (
    <CoachScaffold title={coach.medicalTitle} keyboard inStack>
      {error ? (
        <CoachCard onPress={load}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.retry}</Text>
        </CoachCard>
      ) : null}
      {dossier ? (
        <MedicalDossierView dossier={dossier} />
      ) : loading ? (
        <CoachBanner message={coach.loading} />
      ) : null}
      {enabled ? (
        <CoachCard onPress={() => router.push(coachHref(`/(coach)/fighters/${fighterId}/medical-history`))}>
          <Text style={[type.link, { color: colors.lotus }]}>{coach.openHistory}</Text>
        </CoachCard>
      ) : null}
      {enabled ? (
        <ReviewRequestPanel
          fighterId={fighterId}
          enabled={enabled}
          onSubmitted={load}
          onAccessLost={onAccessLost}
        />
      ) : null}
      {enabled ? (
        <DoctorAssignmentList fighterId={fighterId} enabled={enabled} onAccessLost={onAccessLost} />
      ) : null}
    </CoachScaffold>
  );
}

export function CoachFighterMedicalHistoryScreen() {
  const { isDemo } = useSession();
  const fighterId = useCoachFighterId();
  const [closed, setClosed] = useState(false);
  const clear = useCallback(() => setClosed(true), []);
  const onAccessLost = useAccessLoss(clear);

  return (
    <CoachScaffold title={coach.medicalHistoryTitle} inStack>
      {!closed && fighterId && !isDemo ? (
        <MedicalHistoryContent fighterId={fighterId} enabled onAccessLost={onAccessLost} />
      ) : (
        <CoachBanner message={isDemo ? coach.emptyFighters : coach.accessLost} />
      )}
    </CoachScaffold>
  );
}
