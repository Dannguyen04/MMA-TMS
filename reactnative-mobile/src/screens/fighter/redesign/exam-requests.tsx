import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { createFighterReviewRequest, listFighterReviewRequests } from "@/api/medical";
import { isApiError } from "@/api/errors";
import { REVIEW_REQUEST_STATUSES, type MedicalReviewRequest, type ReviewRequestStatus } from "@/api/types";
import { reviewStatusLabel, formatMedicalWhen } from "@/components/medical/medical-format";
import { useToastMessage } from "@/components/toast/app-toast";
import { medical } from "@/i18n/medical";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { canSubmitReviewReason, REVIEW_REASON_MAX, reviewReasonIssue } from "@/screens/fighter/redesign/review-reason";
import { mapApiMessage } from "@/session/map-api-message";
import { FilterSelect } from "@/components/filter-sheet";
import { SkeletonRows } from "@/components/loading";

function outcomeUnknown(error: unknown): boolean {
  return !isApiError(error) || error.status === 0 || error.status >= 500;
}

export function ExamRequestSection({
  fighterId,
  enabled,
  onSubmitted,
  status,
  onStatusChange,
  reason,
  onReasonChange,
}: {
  fighterId: string;
  enabled: boolean;
  onSubmitted?: () => void;
  status: ReviewRequestStatus | "";
  onStatusChange: (next: ReviewRequestStatus | "") => void;
  reason: string;
  onReasonChange: (next: string) => void;
}) {
  const colors = useFighterPalette();
  const [rows, setRows] = useState<MedicalReviewRequest[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  useToastMessage(listError, "error");
  useToastMessage(formError, "error");
  const sendingRef = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(
    async (nextPage: number) => {
      if (!enabled || !fighterId) {
        setRows([]);
        setTotal(0);
        setHasNext(false);
        return;
      }
      const seq = ++requestSeq.current;
      setLoading(true);
      setListError("");
      try {
        const result = await listFighterReviewRequests(fighterId, {
          page: nextPage,
          limit: 20,
          ...(status ? { status } : {}),
        });
        if (seq !== requestSeq.current) return;
        setRows((current) => (nextPage === 1 ? result.data : [...current, ...result.data]));
        setTotal(result.total);
        setHasNext(result.hasNextPage);
        setPage(nextPage);
      } catch (cause: unknown) {
        if (seq !== requestSeq.current) return;
        setRows([]);
        setTotal(null);
        setHasNext(false);
        setListError(mapApiMessage(cause));
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [enabled, fighterId, status],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  const issue = reviewReasonIssue(reason);
  const count = reason.trim().length;

  const submit = () => {
    if (sendingRef.current || !canSubmitReviewReason(reason, sending)) return;
    if (!enabled || !fighterId) return;
    sendingRef.current = true;
    setSending(true);
    setFormError("");
    void createFighterReviewRequest(fighterId, { reason: reason.trim() })
      .then(() => {
        onReasonChange("");
        onSubmitted?.();
        void load(1);
      })
      .catch((cause: unknown) => {
        if (outcomeUnknown(cause)) {
          setFormError(medical.reviewRecheck);
          void load(1);
          onSubmitted?.();
          return;
        }
        setFormError(mapApiMessage(cause));
      })
      .finally(() => {
        sendingRef.current = false;
        setSending(false);
      });
  };

  return (
    <View style={styles.stack}>
      <View style={styles.rowBetween}>
        <Text style={[styles.section, { color: colors.ink }]}>Danh sách</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>
          {listError ? "" : total === null ? "" : `${total} yêu cầu`}
        </Text>
      </View>
      <FilterSelect
        label="Trạng thái"
        options={[{ value: "" as const, label: "Tất cả" }, ...REVIEW_REQUEST_STATUSES.map((value) => ({ value, label: reviewStatusLabel(value) }))]}
        value={status}
        allValue=""
        onChange={onStatusChange}
      />
      {listError ? (
        <Pressable accessibilityRole="button" onPress={() => void load(1)}>
          <Text style={[styles.meta, { color: colors.accent }]}>Thử lại</Text>
        </Pressable>
      ) : null}
      {loading && rows.length === 0 && !listError ? (
        <SkeletonRows rows={2} />
      ) : null}
      {!loading && !listError && rows.length === 0 ? (
        <Text style={[styles.meta, { color: colors.muted }]}>
          {status ? "Không có yêu cầu ở bộ lọc này." : "Chưa có yêu cầu khám."}
        </Text>
      ) : null}
      {rows.map((row) => (
        <View key={row.id} style={[styles.request, { borderBottomColor: colors.line }]}>
          <Text style={[styles.body, { color: colors.ink }]}>{row.reason}</Text>
          <Text style={[styles.meta, { color: row.status === "OPEN" ? colors.warning : colors.muted }]}>
            {reviewStatusLabel(row.status)} · {formatMedicalWhen(row.requestedAt)}
          </Text>
          {row.status === "RESOLVED" ? (
            <Text style={[styles.meta, { color: colors.muted }]}>{medical.reviewResolvedNote}</Text>
          ) : null}
        </View>
      ))}
      {hasNext ? (
        <Pressable accessibilityRole="button" onPress={() => void load(page + 1)}>
          <Text style={{ color: colors.accent, fontWeight: "600" }}>{medical.loadMore}</Text>
        </Pressable>
      ) : null}

      <Text style={[styles.section, { color: colors.ink }]}>Lý do cần khám</Text>
      <View style={[styles.field, { backgroundColor: colors.surface2, borderColor: colors.line }]}>
        <TextInput
          accessibilityLabel="Lý do cần khám"
          value={reason}
          onChangeText={onReasonChange}
          editable={!sending}
          multiline
          maxLength={REVIEW_REASON_MAX + 200}
          placeholder="Mô tả triệu chứng hoặc điều bạn muốn trao đổi với bác sĩ…"
          placeholderTextColor={colors.muted}
          style={[styles.input, { color: colors.ink }]}
        />
        <Text style={[styles.counter, { color: issue === "tooLong" ? colors.warning : colors.muted }]}>
          {count} / {REVIEW_REASON_MAX} ký tự
        </Text>
      </View>
      <View style={[styles.warn, { backgroundColor: colors.warningSoft }]}>
        <MaterialCommunityIcons name="alert-outline" size={20} color={colors.warning} />
        <View style={styles.flex}>
          <Text style={[styles.warnTitle, { color: colors.warning }]}>Gửi là tạm dừng bắt đầu buổi tập</Text>
          <Text style={[styles.meta, { color: colors.warning }]}>
            Sau khi gửi, bạn không thể bắt đầu buổi tập cho đến khi bác sĩ khám. Không thể hủy yêu cầu đã gửi.
          </Text>
        </View>
      </View>
      {issue === "tooLong" ? <Text style={[styles.meta, { color: colors.warning }]}>{medical.reviewTooLong}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSubmitReviewReason(reason, sending) || !enabled }}
        disabled={!canSubmitReviewReason(reason, sending) || !enabled}
        onPress={submit}
        style={[
          styles.submit,
          {
            backgroundColor:
              canSubmitReviewReason(reason, sending) && enabled ? colors.accent : colors.disabled,
          },
        ]}
      >
        <Text
          style={{
            color: canSubmitReviewReason(reason, sending) && enabled ? colors.onAccent : colors.disabledInk,
            fontWeight: "600",
            fontSize: 14,
          }}
        >
          {sending ? "Đang gửi…" : "Gửi yêu cầu khám"}
        </Text>
      </Pressable>
      <Text style={[styles.meta, { color: colors.muted }]}>Nhập lý do để gửi • Tối đa 2000 ký tự</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  section: { fontSize: 16, lineHeight: 22, fontWeight: "700" },
  meta: { fontSize: 12, lineHeight: 17 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderRadius: 99, paddingHorizontal: 11, paddingVertical: 8 },
  request: { gap: 3, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { fontSize: 14, lineHeight: 20 },
  field: { minHeight: 124, borderRadius: 12, borderWidth: 1, padding: 14, justifyContent: "space-between" },
  input: { fontSize: 13, lineHeight: 18, minHeight: 72, textAlignVertical: "top" },
  counter: { fontSize: 11, textAlign: "right" },
  warn: { flexDirection: "row", gap: 10, borderRadius: 12, padding: 12 },
  warnTitle: { fontSize: 12, fontWeight: "700", lineHeight: 17 },
  flex: { flex: 1, gap: 4 },
  submit: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
