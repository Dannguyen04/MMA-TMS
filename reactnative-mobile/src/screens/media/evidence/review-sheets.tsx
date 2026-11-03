import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  appendMovementReview,
  reviewFinding,
  submitCoachCorrection,
  type FindingReviewStatus,
  type MovementDecision,
} from "@/api/evidence";
import { BottomSheet } from "@/components/filter-sheet";
import { showAppToast } from "@/components/toast/app-toast";
import type { EvidenceWindow, ResultFinding } from "@/components/video/pose-model";
import { ev } from "@/i18n/video-evidence";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { evidenceError } from "@/screens/media/evidence/errors";
import { formatPrecise } from "@/screens/media/evidence/evidence-model";
import { FINDING_DECISIONS, uuidV4 } from "@/screens/media/evidence/review-model";
import { SheetOption } from "@/screens/media/evidence/sheet-option";

function Field({ label, value, onChange, placeholder, multiline, testID, maxLength }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean; testID?: string; maxLength?: number }) {
  const c = useFighterPalette();
  return (
    <View style={styles.field}>
      <Text style={{ color: c.muted, fontSize: 13 }}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        multiline={multiline}
        maxLength={maxLength}
        style={[styles.input, multiline && styles.multi, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }]}
      />
    </View>
  );
}

function SaveButton({ busy, disabled, onPress, testID }: { busy: boolean; disabled: boolean; onPress: () => void; testID: string }) {
  const c = useFighterPalette();
  const off = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      style={[styles.save, { backgroundColor: off ? c.disabled : c.accent }]}
    >
      {busy ? <ActivityIndicator color={c.onAccent} size="small" /> : null}
      <Text style={{ color: off ? c.disabledInk : c.onAccent, fontWeight: "700", fontSize: 15 }}>{busy ? ev.saving : ev.save}</Text>
    </Pressable>
  );
}

function useSubmit(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = (work: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    void work()
      .then(() => {
        showAppToast(ev.saved, "success");
        onDone();
      })
      .catch((e: unknown) => setError(evidenceError(e)))
      .finally(() => setBusy(false));
  };
  return { busy, error, run, reset: () => setError("") };
}

function ErrorLine({ text }: { text: string }) {
  const c = useFighterPalette();
  return text ? <Text style={{ color: c.warning, fontSize: 13 }}>{text}</Text> : null;
}

function Shell({ visible, title, onClose, footer, children }: { visible: boolean; title: string; onClose: () => void; footer: ReactNode; children: ReactNode }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} footer={footer}>
      <View style={styles.body}>{children}</View>
    </BottomSheet>
  );
}

/** Coach: approve / correct / reject one AI finding (POST /coaching/findings/review). */
export function FindingReviewSheet({ finding, analysisId, onClose, onSaved }: { finding: ResultFinding | null; analysisId: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<FindingReviewStatus>("approved");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const submit = useSubmit(() => {
    onSaved();
    onClose();
  });
  useEffect(() => {
    setStatus("approved");
    setLabel("");
    setNotes("");
    submit.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finding?.id]);
  const invalid = status === "corrected" && !label.trim();
  const save = () =>
    finding &&
    submit.run(() =>
      reviewFinding({
        analysisId,
        actionId: finding.actionId ?? finding.id,
        findingId: finding.id,
        status,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        ...(status === "corrected" ? { correctedLabel: label.trim() } : {}),
      }),
    );
  return (
    <Shell
      visible={Boolean(finding)}
      title={ev.reviewFinding}
      onClose={onClose}
      footer={<SaveButton busy={submit.busy} disabled={invalid} onPress={save} testID="finding-review-save" />}
    >
      {finding ? <SheetTitle title={finding.title} detail={formatPrecise(finding.timeMs)} /> : null}
      {FINDING_DECISIONS.map((d) => (
        <SheetOption key={d} label={ev.decision[d]!} selected={status === d} onPress={() => setStatus(d)} testID={`finding-decision-${d}`} />
      ))}
      {status === "corrected" ? <Field label={ev.correctedLabel} value={label} onChange={setLabel} placeholder={ev.correctedLabelHint} maxLength={120} testID="finding-label" /> : null}
      <Field label={ev.notes} value={notes} onChange={setNotes} placeholder={ev.notesHint} multiline testID="finding-notes" />
      <ErrorLine text={submit.error} />
    </Shell>
  );
}

function SheetTitle({ title, detail }: { title: string; detail?: string }) {
  const c = useFighterPalette();
  return (
    <View style={{ gap: 2, paddingBottom: 4 }}>
      <Text style={{ color: c.ink, fontWeight: "700", fontSize: 15 }}>{title}</Text>
      {detail ? <Text style={{ color: c.muted, fontSize: 13 }}>{detail}</Text> : null}
    </View>
  );
}

/** Coach: overall 1–5 rating + text, as on the web (POST /coaching/corrections). */
export function SummarySheet({ visible, analysisId, initial, onClose, onSaved }: { visible: boolean; analysisId: string; initial: { rating: number | null; text: string } | null; onClose: () => void; onSaved: () => void }) {
  const c = useFighterPalette();
  const [rating, setRating] = useState<number | null>(null);
  const [text, setText] = useState("");
  const submit = useSubmit(() => {
    onSaved();
    onClose();
  });
  useEffect(() => {
    if (!visible) return;
    setRating(initial?.rating != null ? Math.min(5, Math.max(1, Math.round(initial.rating))) : null);
    setText(initial?.text ?? "");
    submit.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const save = () => rating != null && submit.run(() => submitCoachCorrection({ analysisId, reviewText: text.trim(), techniqueRating: rating }));
  return (
    <Shell
      visible={visible}
      title={ev.summary}
      onClose={onClose}
      footer={<SaveButton busy={submit.busy} disabled={rating == null || !text.trim()} onPress={save} testID="summary-save" />}
    >
      <Text style={{ color: c.muted, fontSize: 13 }}>{ev.rating}</Text>
      <View style={styles.rating}>
        {[1, 2, 3, 4, 5].map((n) => {
          const on = rating === n;
          return (
            <Pressable
              key={n}
              testID={`rating-${n}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={ev.ratingOf(n)}
              onPress={() => setRating(n)}
              style={[styles.rate, { borderColor: on ? c.accent : c.line, backgroundColor: on ? c.accent : c.surface }]}
            >
              <Text style={{ color: on ? c.onAccent : c.ink, fontWeight: "700", fontSize: 16 }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
      <Field label={ev.summaryText} value={text} onChange={setText} placeholder={ev.notesHint} multiline testID="summary-text" />
      <ErrorLine text={submit.error} />
    </Shell>
  );
}

const WINDOW_DECISIONS: MovementDecision[] = ["confirmed", "corrected", "rejected"];

/** Coach or doctor: review one movement evidence window (append-only, expectedRevision guarded). */
export function WindowReviewSheet({
  jobId,
  window: w,
  expectedRevision,
  playheadMs,
  onClose,
  onSaved,
}: {
  jobId: string;
  window: EvidenceWindow | null;
  expectedRevision: number;
  playheadMs: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const c = useFighterPalette();
  const [decision, setDecision] = useState<MovementDecision>("confirmed");
  const [notes, setNotes] = useState("");
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [requestId, setRequestId] = useState(() => uuidV4());
  const submit = useSubmit(() => {
    onSaved();
    onClose();
  });
  useEffect(() => {
    setDecision("confirmed");
    setNotes("");
    setRange(w ? [w.startMs, w.endMs] : [0, 0]);
    setRequestId(uuidV4());
    submit.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w?.id]);
  if (!w) return <Shell visible={false} title={ev.reviewWindow} onClose={onClose} footer={null}>{null}</Shell>;
  const rangeOk = range[0] >= w.startMs && range[1] <= w.endMs && range[0] < range[1];
  const invalid = !notes.trim() || (decision === "corrected" && !rangeOk);
  const inWindow = playheadMs >= w.startMs && playheadMs <= w.endMs;
  const save = () =>
    submit.run(() =>
      appendMovementReview(jobId, {
        requestId,
        windowId: w.id,
        expectedRevision,
        decision,
        notes: notes.trim().slice(0, 2000),
        ...(decision === "corrected" ? { startMs: Math.round(range[0]), endMs: Math.round(range[1]) } : {}),
      }),
    );
  return (
    <Shell visible title={ev.reviewWindow} onClose={onClose} footer={<SaveButton busy={submit.busy} disabled={invalid} onPress={save} testID="window-review-save" />}>
      <SheetTitle title={`${formatPrecise(w.startMs)} – ${formatPrecise(w.endMs)}`} detail={ev.frames(w.sampleCount)} />
      {WINDOW_DECISIONS.map((d) => (
        <SheetOption key={d} label={ev.windowDecision[d]!} selected={decision === d} onPress={() => setDecision(d)} testID={`window-decision-${d}`} />
      ))}
      {decision === "corrected" ? (
        <View style={styles.field}>
          <Text style={{ color: c.muted, fontSize: 13 }}>{ev.rangeHint}</Text>
          <View style={styles.rating}>
            {([0, 1] as const).map((k) => (
              <Pressable
                key={k}
                testID={`window-set-${k ? "end" : "start"}`}
                accessibilityRole="button"
                disabled={!inWindow}
                onPress={() => setRange((r) => (k ? [r[0], playheadMs] : [playheadMs, r[1]]))}
                style={[styles.rangeBtn, { borderColor: c.line, backgroundColor: c.surface, opacity: inWindow ? 1 : 0.5 }]}
              >
                <Text style={{ color: c.ink, fontWeight: "600", fontSize: 13 }}>
                  {k ? ev.setEnd(formatPrecise(range[1])) : ev.setStart(formatPrecise(range[0]))}
                </Text>
              </Pressable>
            ))}
          </View>
          {!rangeOk ? <ErrorLine text={ev.rangeInvalid} /> : null}
        </View>
      ) : null}
      <Field label={ev.notesRequired} value={notes} onChange={setNotes} placeholder={ev.notesHint} multiline maxLength={2000} testID="window-notes" />
      <ErrorLine text={submit.error} />
    </Shell>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 8 },
  field: { gap: 6 },
  input: { minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multi: { minHeight: 84, textAlignVertical: "top" },
  save: { minHeight: 48, borderRadius: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  rating: { flexDirection: "row", gap: 8 },
  rate: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  rangeBtn: { flex: 1, minHeight: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
});
