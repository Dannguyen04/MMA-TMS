import { useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { createFighterReviewRequest, listFighterReviewRequests } from "@/api/medical";
import { isApiError } from "@/api/errors";
import {
  REVIEW_REQUEST_STATUSES,
  type MedicalReviewRequest,
  type ReviewRequestStatus,
} from "@/api/types";
import { AuthButton } from "@/components/auth/auth-button";
import { useToastMessage } from "@/components/toast/app-toast";
import { AuthTextField } from "@/components/auth/auth-text-field";
import {
  formatMedicalWhen,
  requesterRoleLabel,
  reviewStatusLabel,
} from "@/components/medical/medical-format";
import {
  MedicalCard,
  MedicalChip,
  MedicalLink,
  MedicalMuted,
  MedicalSection,
  medicalStyles,
} from "@/components/medical/medical-ui";
import { medical } from "@/i18n/medical";
import { mapApiMessage } from "@/session/map-api-message";
import { type, useThemePreference } from "@/theme";

export const REVIEW_REASON_MAX = 2000;
const PAGE_SIZE = 20;

/** A lost response (network drop, 5xx) may still have created the request. */
function outcomeUnknown(error: unknown): boolean {
  return !isApiError(error) || error.status === 0 || error.status >= 500;
}

function isAccessLoss(error: unknown): boolean {
  return isApiError(error) && (error.status === 403 || error.status === 404);
}

export function ReviewRequestPanel({
  fighterId,
  enabled,
  onSubmitted,
  onAccessLost,
}: {
  fighterId: string;
  enabled: boolean;
  onSubmitted?: () => void;
  onAccessLost?: () => void;
}) {
  const { colors } = useThemePreference();
  const [status, setStatus] = useState<ReviewRequestStatus | "">("");
  const [rows, setRows] = useState<MedicalReviewRequest[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsRecheck, setNeedsRecheck] = useState(false);
  const requestSeq = useRef(0);
  useToastMessage(listError, "error");
  useToastMessage(formError, needsRecheck ? "info" : "error");
  useToastMessage(notice, "success");

  const load = useCallback(
    async (nextPage: number) => {
      if (!enabled || !fighterId) {
        setRows([]);
        setHasNext(false);
        return;
      }
      const seq = ++requestSeq.current;
      setLoading(true);
      setListError("");
      try {
        const result = await listFighterReviewRequests(fighterId, {
          page: nextPage,
          limit: PAGE_SIZE,
          ...(status ? { status } : {}),
        });
        if (seq !== requestSeq.current) return;
        setRows((current) => (nextPage === 1 ? result.data : [...current, ...result.data]));
        setHasNext(result.hasNextPage);
        setPage(nextPage);
        setNeedsRecheck(false);
      } catch (cause: unknown) {
        if (seq !== requestSeq.current) return;
        setRows([]);
        setHasNext(false);
        setListError(mapApiMessage(cause));
        if (isAccessLoss(cause)) onAccessLost?.();
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [enabled, fighterId, status, onAccessLost],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const trimmed = reason.trim();
  const tooLong = trimmed.length > REVIEW_REASON_MAX;

  const submit = () => {
    if (sending || !enabled || !fighterId) return;
    if (!trimmed) {
      setFormError(medical.reviewReason);
      return;
    }
    if (tooLong) {
      setFormError(medical.reviewTooLong);
      return;
    }
    setSending(true);
    setFormError("");
    setNotice("");
    void createFighterReviewRequest(fighterId, { reason: trimmed })
      .then(() => {
        setReason("");
        setNotice(medical.reviewSent);
        onSubmitted?.();
        void load(1);
      })
      .catch((cause: unknown) => {
        if (outcomeUnknown(cause)) {
          setNeedsRecheck(true);
          setFormError(medical.reviewRecheck);
          void load(1);
          return;
        }
        setFormError(mapApiMessage(cause));
        if (isAccessLoss(cause)) onAccessLost?.();
      })
      .finally(() => setSending(false));
  };

  return (
    <View style={medicalStyles.stack}>
      <MedicalSection text={medical.reviewTitle} />
      <View style={medicalStyles.chips}>
        <MedicalChip label={medical.filterAll} selected={status === ""} onPress={() => setStatus("")} />
        {REVIEW_REQUEST_STATUSES.map((value) => (
          <MedicalChip
            key={value}
            label={reviewStatusLabel(value)}
            selected={status === value}
            onPress={() => setStatus(value)}
          />
        ))}
      </View>
      {listError ? <MedicalLink label={medical.retry} onPress={() => void load(1)} /> : null}
      <MedicalCard>
        {loading && rows.length === 0 ? <MedicalMuted text={medical.loading} /> : null}
        {!loading && rows.length === 0 && !listError ? <MedicalMuted text={medical.reviewEmpty} /> : null}
        {rows.map((row) => (
          <View key={row.id} style={medicalStyles.row}>
            <Text style={[type.body, { color: colors.ink }]}>{row.reason}</Text>
            <MedicalMuted
              text={`${reviewStatusLabel(row.status)} · ${requesterRoleLabel(row.requesterRole)} · ${formatMedicalWhen(row.requestedAt)}`}
              tone={row.status === "OPEN" ? "danger" : "muted"}
            />
            {row.status === "RESOLVED" ? (
              <MedicalMuted
                text={`${medical.resolvedAt} ${formatMedicalWhen(row.resolvedAt)} · ${medical.reviewResolvedNote}`}
              />
            ) : null}
          </View>
        ))}
        {hasNext ? <MedicalLink label={medical.loadMore} onPress={() => void load(page + 1)} /> : null}
      </MedicalCard>

      <MedicalCard>
        <MedicalMuted text={medical.reviewHint} />
        <AuthTextField
          label={medical.reviewReason}
          value={reason}
          onChangeText={setReason}
          multiline
          editable={!sending}
          helper={`${trimmed.length}/${REVIEW_REASON_MAX}`}
          helperPersistent
          error={tooLong ? medical.reviewTooLong : undefined}
        />
        <AuthButton
          title={medical.reviewSubmit}
          onPress={submit}
          loading={sending}
          disabled={sending || !enabled || !trimmed || tooLong || (needsRecheck && loading)}
        />
      </MedicalCard>
    </View>
  );
}
