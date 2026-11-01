import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/session/session-context";
import { oneTapApi } from "@/api/one-tap";
import type { ActiveReference, ReanalyzeResult } from "@/api/one-tap.types";
import { videoAiApi } from "@/api/video-ai";
import type { AiCoachingState, AiMovementReviews } from "@/api/video-ai.types";
import { BottomSheet } from "@/components/filter-sheet";
import { Icon, type IconName } from "@/components/icon";
import type { EvidenceWindow, ResultFinding } from "@/components/video/pose-model";
import { ot } from "@/i18n/one-tap";
import { RoCard, StatusChip } from "@/screens/coach/readonly/ro-ui";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { mmss } from "@/screens/video-ai/ai-model";

import { ConfirmSheet, ForbiddenLine, SheetButton } from "./sheets";
import { closeIfOffline, uuid4, useWrite } from "./write";

/* ───────────── Phân tích lại ───────────── */

/** Sheet "Phân tích lại video này?" + gửi POST reanalyze; thành công → onDone (mở video/job mới). */
export function useReanalyze(videoId: string, fighterId: string | null, onDone: (r: ReanalyzeResult) => void) {
  const [open, setOpen] = useState(false);
  const w = useWrite(ot.reanalyzeForbidden);
  const sheet = (
    <ConfirmSheet
      visible={open}
      title={ot.reanalyzeTitle}
      body={ot.reanalyzeBody}
      confirmLabel={ot.reanalyze}
      sending={w.sending}
      forbidden={w.forbidden}
      onCancel={() => setOpen(false)}
      onConfirm={() => {
        if (!fighterId) return;
        void w.run(
          () => oneTapApi.reanalyzeVideo(videoId, { fighterId }),
          (r) => {
            setOpen(false);
            onDone(r);
          },
        ).then(closeIfOffline(setOpen));
      }}
    />
  );
  return {
    open: () => {
      w.setForbidden("");
      setOpen(true);
    },
    sheet,
  };
}

/** Nút outlined "Phân tích lại" (thẻ thất bại). */
export function ReanalyzeButton({ onPress }: { onPress: () => void }) {
  return <SheetButton testID="reanalyze-btn" label={ot.reanalyze} kind="outline" onPress={onPress} />;
}

/* ───────────── Menu ⋯ ───────────── */

export type MoreItem = { key: string; label: string; icon: IconName; onPress: () => void; danger?: boolean };

export function MoreMenu({ items }: { items: MoreItem[] }) {
  const p = useFighterPalette();
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <Pressable
        testID="more-btn"
        accessibilityRole="button"
        accessibilityLabel={ot.more}
        onPress={() => setOpen(true)}
        style={[styles.round, { backgroundColor: p.surface2 }]}
      >
        <Icon name="more" size={24} color={p.ink} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={ot.more}>
        <View style={{ gap: 4, paddingBottom: 8 }}>
          {items.map((it) => (
            <Pressable
              key={it.key}
              accessibilityRole="button"
              accessibilityLabel={it.label}
              onPress={() => {
                setOpen(false);
                it.onPress();
              }}
              style={({ pressed }) => [styles.menuRow, { backgroundColor: pressed ? p.surface2 : "transparent" }]}
            >
              <Icon name={it.icon} size={24} color={it.danger ? p.danger : p.ink} />
              <Text style={[TEXT.bodyBold, { color: it.danger ? p.danger : p.ink }]}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </>
  );
}

/* ───────────── Chuẩn tham chiếu ───────────── */

/** Chuẩn đang áp dụng cho video này (nguồn duy nhất: GET /coaching/loop-state/:fighterId). */
export function useVideoReference(fighterId: string | null, videoId: string, enabled: boolean) {
  const [ref, setRef] = useState<ActiveReference | null>(null);
  useEffect(() => {
    let live = true;
    if (!enabled || !fighterId) return undefined;
    oneTapApi
      .listActiveReferences(fighterId)
      .then((list) => live && setRef(list.find((r) => r.videoId === videoId) ?? null))
      .catch(() => live && setRef(null));
    return () => {
      live = false;
    };
  }, [fighterId, videoId, enabled]);
  return { ref, clear: () => setRef(null) };
}

/** Chip "Chuẩn" (mực + sao, không chỉ màu). */
export function ReferenceChip({ technique }: { technique?: string | null }) {
  const p = useFighterPalette();
  return (
    <View testID="ref-chip" accessible accessibilityLabel={[ot.reference, technique ? ot.technique(technique) : ""].filter(Boolean).join(", ")} style={[styles.refChip, { borderColor: p.ink }]}>
      <Icon name="star" size={16} color={p.ink} />
      <Text style={[TEXT.captionBold, { color: p.ink }]}>{ot.reference}</Text>
    </View>
  );
}

export function useRevokeReference(reference: ActiveReference | null, onDone: () => void) {
  const { user } = useSession();
  const coachId = user?.profile?.id ?? "";
  const [open, setOpen] = useState(false);
  const w = useWrite(ot.revokeForbidden);
  const sheet = (
    <ConfirmSheet
      visible={open}
      title={ot.revokeTitle}
      body={ot.revokeBody}
      confirmLabel={ot.revoke}
      danger
      reasons={ot.revokeReasons}
      sending={w.sending}
      forbidden={w.forbidden}
      onCancel={() => setOpen(false)}
      onConfirm={(reason) => {
        if (!reference) return;
        void w.run(
          () => oneTapApi.revokeReference({ coachId, referenceId: reference.id, reason }),
          () => {
            setOpen(false);
            onDone();
          },
        ).then(closeIfOffline(setOpen));
      }}
    />
  );
  return {
    open: () => {
      w.setForbidden("");
      setOpen(true);
    },
    sheet,
  };
}

/* ───────────── Duyệt phát hiện AI (HLV) ───────────── */

type Decision = "approved" | "rejected";

function latestFindingDecision(state: AiCoachingState | null, findingId: string): Decision | null {
  const rows = (state?.findingReviews ?? []).filter((r) => r.findingId === findingId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const s = rows[0]?.status;
  return s === "approved" || s === "rejected" ? s : null;
}

export function FindingsCard({ jobId, state }: { jobId: string; state: AiCoachingState | null }) {
  const [findings, setFindings] = useState<ResultFinding[] | null>(null);
  useEffect(() => {
    let live = true;
    videoAiApi
      .getJobResult(jobId)
      .then((r) => live && setFindings(r.findings.filter((f) => f.actionId)))
      .catch(() => live && setFindings([]));
    return () => {
      live = false;
    };
  }, [jobId]);
  const analysisId = state?.analysisId ?? null;
  if (!findings || findings.length === 0 || !analysisId) return null;
  return (
    <RoCard title={ot.findings}>
      {findings.map((f, i) => (
        <FindingRow key={f.id} first={i === 0} finding={f} analysisId={analysisId} initial={latestFindingDecision(state, f.id)} />
      ))}
    </RoCard>
  );
}

export function FindingRow({ finding, analysisId, initial, first }: { finding: ResultFinding; analysisId: string; initial: Decision | null; first?: boolean }) {
  const p = useFighterPalette();
  const [decision, setDecision] = useState<Decision | null>(initial);
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState<Decision | null>(null);
  const w = useWrite(ot.findingForbidden);
  const send = (status: Decision) => {
    setPending(status);
    void w
      .run(
        () => oneTapApi.reviewFinding({ analysisId, actionId: finding.actionId!, findingId: finding.id, status }),
        () => {
          setDecision(status);
          setEditing(false);
        },
      )
      .finally(() => setPending(null));
  };
  const showButtons = decision == null || editing;
  return (
    <View testID={`finding-${finding.id}`} style={[{ gap: 8 }, !first && { borderTopWidth: 1, borderColor: p.line, paddingTop: 12 }]}>
      <Text style={[TEXT.bodyBold, { color: p.ink }]}>
        {mmss(finding.timeMs)} · {finding.title}
      </Text>
      {finding.description ? <Text style={[TEXT.body, { color: p.ink }]}>{finding.description}</Text> : null}
      {showButtons ? (
        <View style={styles.pair}>
          {(["approved", "rejected"] as const).map((d) => {
            const label = d === "approved" ? ot.findingRight : ot.findingWrong;
            return (
              <View key={d} style={{ flex: 1 }}>
                <SheetButton
                  testID={`finding-${d}`}
                  label={label}
                  kind="outline"
                  loading={pending === d}
                  disabled={w.sending && pending !== d}
                  onPress={() => send(d)}
                />
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.rowWrap}>
          <StatusChip spec={decision === "approved" ? { label: ot.findingApproved, tone: "success", icon: "success" } : { label: ot.findingRejected, tone: "neutral", icon: "ban" }} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${ot.change}: ${finding.title}`} onPress={() => setEditing(true)} style={styles.link}>
            <Text style={[TEXT.bodyBold, { color: p.link, textDecorationLine: "underline" }]}>{ot.change}</Text>
          </Pressable>
        </View>
      )}
      <ForbiddenLine text={w.forbidden} />
    </View>
  );
}

/* ───────────── Duyệt đoạn chuyển động (HLV, bác sĩ) ───────────── */

type MoveDecision = "confirmed" | "rejected";

/** Lần duyệt mới nhất của chính người dùng cho đoạn → expectedRevision (0 nếu chưa có). */
export function myLatest(moves: AiMovementReviews | null, windowId: string, meId: string | null) {
  const mine = (moves?.reviews ?? []).filter((r) => r.windowId === windowId && r.reviewerId === meId);
  const top = mine.sort((a, b) => b.revision - a.revision)[0];
  return { revision: top?.revision ?? 0, decision: (top?.decision === "confirmed" || top?.decision === "rejected" ? top.decision : null) as MoveDecision | null };
}

export function MovementCard({ jobId, meId, onSeek }: { jobId: string; meId: string | null; onSeek?: (ms: number) => void }) {
  const [windows, setWindows] = useState<EvidenceWindow[] | null>(null);
  const [moves, setMoves] = useState<AiMovementReviews | null>(null);
  const load = useCallback(() => {
    void videoAiApi.getMovementReviews(jobId).then(setMoves).catch(() => undefined);
  }, [jobId]);
  useEffect(() => {
    let live = true;
    videoAiApi
      .getJobResult(jobId)
      .then((r) => live && setWindows(r.movementEvidence?.windows ?? []))
      .catch(() => live && setWindows([]));
    load();
    return () => {
      live = false;
    };
  }, [jobId, load]);
  const ink = useFighterPalette().ink;
  if (!windows || windows.length === 0) return null;
  return (
    <RoCard title={ot.windows}>
      {windows.map((win, i) => (
        <WindowRow key={win.id} first={i === 0} jobId={jobId} win={win} mine={myLatest(moves, win.id, meId)} onSaved={load} onSeek={onSeek} />
      ))}
      {onSeek ? <Text style={[TEXT.detail, { color: ink }]}>{ot.seekHint}</Text> : null}
      <Text style={[TEXT.detail, { color: ink }]}>{ot.correctOnWeb}</Text>
    </RoCard>
  );
}

function WindowRow({ jobId, win, mine, onSaved, first, onSeek }: { jobId: string; win: EvidenceWindow; mine: { revision: number; decision: MoveDecision | null }; onSaved: () => void; first?: boolean; onSeek?: (ms: number) => void }) {
  const p = useFighterPalette();
  const [ask, setAsk] = useState<MoveDecision | null>(null);
  const [done, setDone] = useState<{ decision: MoveDecision; revision: number } | null>(null);
  const [conflict, setConflict] = useState(false);
  const w = useWrite(ot.moveForbidden);
  const current = done && done.revision >= mine.revision ? done : mine.decision ? { decision: mine.decision, revision: mine.revision } : null;
  const reasons = ask === "rejected" ? ot.moveRejectReasons : ot.moveConfirmReasons;
  const label = ot.windowLabel(mmss(win.startMs), mmss(win.endMs));
  const requestId = useMemo(() => uuid4(), [ask]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View testID={`window-${win.id}`} style={[{ gap: 8 }, !first && { borderTopWidth: 1, borderColor: p.line, paddingTop: 12 }]}>
      <Pressable
        testID={`seek-${win.id}`}
        accessibilityRole="button"
        accessibilityLabel={onSeek ? ot.seekTo(label) : label}
        disabled={!onSeek}
        onPress={() => onSeek?.(win.startMs)}
        style={({ pressed }) => [styles.rowWrap, { minHeight: 48, opacity: pressed ? 0.7 : 1 }]}
      >
        {onSeek ? <Ionicons name="play-circle-outline" size={22} color={p.ink} /> : null}
        <Text style={[TEXT.bodyBold, { color: p.ink }]}>{label}</Text>
        {current ? (
          <StatusChip spec={current.decision === "confirmed" ? { label: ot.moveConfirmed, tone: "success", icon: "success" } : { label: ot.moveRejected, tone: "neutral", icon: "ban" }} />
        ) : (
          <Text testID={`pending-${win.id}`} style={[TEXT.bodyBold, { color: p.activeInk }]}>
            {ot.movePending}
          </Text>
        )}
      </Pressable>
      {/* Đã duyệt (có chip) thì ẩn nút; chỉ đoạn chưa duyệt mới có Xác nhận / Bác bỏ. */}
      {current ? null : (
      <View style={styles.pair}>
        <View style={{ flex: 1 }}>
          <SheetButton testID="move-confirm" label={ot.confirmMove} kind="outline" onPress={() => (w.setForbidden(""), setAsk("confirmed"))} />
        </View>
        <View style={{ flex: 1 }}>
          <SheetButton testID="move-reject" label={ot.rejectMove} kind="outline" onPress={() => (w.setForbidden(""), setAsk("rejected"))} />
        </View>
      </View>
      )}
      {conflict ? <ForbiddenLine text={ot.moveConflict} /> : null}
      <ConfirmSheet
        visible={ask != null}
        title={ask === "rejected" ? ot.moveRejectTitle : ot.moveConfirmTitle}
        body={`${label}. ${ot.moveBody}`}
        confirmLabel={ask === "rejected" ? ot.rejectMove : ot.confirmMove}
        reasons={reasons}
        sending={w.sending}
        forbidden={w.forbidden}
        onCancel={() => setAsk(null)}
        onConfirm={(notes) => {
          const decision = ask!;
          const expectedRevision = current?.revision ?? 0;
          setConflict(false);
          void w
            .run(
              () => oneTapApi.reviewMovement(jobId, { requestId, windowId: win.id, expectedRevision, decision, notes }),
              (r) => {
                setDone({ decision, revision: r.revision });
                setAsk(null);
                onSaved();
              },
            )
            .then((o) => {
              if (o === "offline") setAsk(null);
              if (o === "conflict") {
                setAsk(null);
                setConflict(true);
                onSaved();
              }
            });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  round: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  menuRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 8, borderRadius: 12 },
  refChip: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 2, borderRadius: 16, paddingHorizontal: 10, minHeight: 32, alignSelf: "flex-start" },
  pair: { flexDirection: "row", gap: 12 },
  rowWrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  link: { minHeight: 48, minWidth: 48, justifyContent: "center", paddingHorizontal: 8 },
});
