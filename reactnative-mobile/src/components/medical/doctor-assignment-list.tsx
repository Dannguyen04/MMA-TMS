import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { isApiError } from "@/api/errors";
import { listFighterDoctors } from "@/api/medical";
import type { DoctorAssignment } from "@/api/types";
import { useToastMessage } from "@/components/toast/app-toast";
import { formatMedicalWhen } from "@/components/medical/medical-format";
import {
  MedicalCard,
  MedicalLink,
  MedicalMuted,
  MedicalSection,
  medicalStyles,
} from "@/components/medical/medical-ui";
import { medical } from "@/i18n/medical";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";
import { SkeletonRows } from "@/components/loading";

const PAGE_SIZE = 20;

/** Read-only Doctor assignment history; assign/end belong to Admin/Doctor. */
export function DoctorAssignmentList({
  fighterId,
  enabled,
  onAccessLost,
}: {
  fighterId: string;
  enabled: boolean;
  onAccessLost?: () => void;
}) {
  const { colors } = useThemePreference();
  const [rows, setRows] = useState<DoctorAssignment[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useToastMessage(error, "error");
  const seqRef = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      if (!enabled || !fighterId) {
        setRows([]);
        setHasNext(false);
        return;
      }
      const seq = ++seqRef.current;
      setLoading(true);
      setError("");
      try {
        const result = await listFighterDoctors(fighterId, { page: nextPage, limit: PAGE_SIZE });
        if (seq !== seqRef.current) return;
        setRows((current) => (nextPage === 1 ? result.data : [...current, ...result.data]));
        setHasNext(result.hasNextPage);
        setPage(nextPage);
      } catch (cause: unknown) {
        if (seq !== seqRef.current) return;
        setRows([]);
        setHasNext(false);
        setError(mapApiMessage(cause));
        if (isApiError(cause) && (cause.status === 403 || cause.status === 404)) onAccessLost?.();
      } finally {
        if (seq === seqRef.current) setLoading(false);
      }
    },
    [enabled, fighterId, onAccessLost],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <View style={medicalStyles.stack}>
      <MedicalSection text={medical.doctors} />
      {error ? <MedicalLink label={medical.retry} onPress={() => void load(1)} /> : null}
      <MedicalCard>
        {loading && rows.length === 0 ? <SkeletonRows rows={2} /> : null}
        {!loading && rows.length === 0 && !error ? <MedicalMuted text={medical.doctorsEmpty} /> : null}
        {rows.map((row) => (
          <View key={row.id} style={medicalStyles.row}>
            <Text style={[type.body, { color: colors.ink }]}>
              {row.doctorName ?? medical.doctorFallback}
            </Text>
            <MedicalMuted
              text={`${row.endsAt ? medical.doctorEnded : medical.doctorActive} · ${formatMedicalWhen(row.startsAt)}${
                row.endsAt ? ` – ${formatMedicalWhen(row.endsAt)}` : ""
              }`}
              tone={row.endsAt ? "muted" : "ok"}
            />
            {row.endReason ? <MedicalMuted text={`${medical.endReason}: ${row.endReason}`} /> : null}
          </View>
        ))}
        {hasNext ? <MedicalLink label={medical.loadMore} onPress={() => void load(page + 1)} /> : null}
      </MedicalCard>
    </View>
  );
}
