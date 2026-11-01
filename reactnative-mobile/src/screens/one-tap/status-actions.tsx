import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";

import { isApiError } from "@/api";
import { oneTapApi } from "@/api/one-tap";
import { NEXT_PLAN, NEXT_SESSION, type PlanStatusValue, type SessionStatusValue } from "@/api/one-tap.types";
import { BottomSheet } from "@/components/filter-sheet";
import { Icon } from "@/components/icon";
import { eligibilityText } from "@/i18n/eligibility";
import { ot } from "@/i18n/one-tap";
import { TEXT } from "@/screens/fighter/bout-states";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { useSession } from "@/session/session-context";

import { ConfirmSheet, ForbiddenLine, SheetButton } from "./sheets";
import type { MoreItem } from "./video-actions";
import { closeIfOffline, useWrite } from "./write";

/** Phiên đăng nhập nếu có (màn được render ngoài SessionProvider trong test → null). Thứ tự hook luôn cố định. */
export function useOptionalSession(): { profileId: string | null; isDemo: boolean } {
  try {
    const s = useSession();
    return { profileId: s.user?.profile?.id ?? null, isDemo: Boolean(s.isDemo) };
  } catch {
    return { profileId: null, isDemo: false };
  }
}

export const CANCEL_MAX = 500;
export const REVOKE_MAX = 2000;
export const END_MAX = 500;

function infoToast(text: string) {
  Toast.show({ type: "info", text1: text, position: "top" });
}

/** Mã lý do y tế từ 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED → nhãn tiếng Việt (không in mã thô). */
export function medicalReasons(e: unknown): string[] {
  if (!isApiError(e) || e.code !== "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED") return [];
  const raw = (e.details as { reasons?: unknown } | undefined)?.reasons;
  const map = eligibilityText.reason as Record<string, string>;
  const list = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === "string") : [];
  const labels = list.map((r) => map[r]).filter(Boolean);
  return labels.length ? labels : [map.EXAMINATION_REQUIRED];
}

/* ───────────── Buổi tập (HLV) ───────────── */

type SessionSheet = "SKIPPED" | "ABANDONED" | "CANCELLED" | null;

/**
 * Nút chính theo trạng thái (Bắt đầu → Hoàn thành), mục ⋯ (Bỏ buổi / Kết thúc dở / Hủy buổi),
 * sheet xác nhận và sheet "Chưa thể bắt đầu buổi" khi 409 y tế.
 */
export function useSessionActions({
  sessionId,
  status,
  onChanged,
  onReload,
  onOpenMedical,
}: {
  sessionId: string;
  status: SessionStatusValue;
  onChanged: (next: SessionStatusValue) => void;
  onReload: () => void;
  onOpenMedical: () => void;
}) {
  const p = useFighterPalette();
  const w = useWrite(ot.sessionForbidden);
  const [sheet, setSheet] = useState<SessionSheet>(null);
  const [medical, setMedical] = useState<string[]>([]);
  const [pendingPrimary, setPendingPrimary] = useState(false);
  const next = NEXT_SESSION[status] ?? [];

  const send = (to: SessionStatusValue, reason?: string, fromSheet = false) => {
    let caught: unknown = null;
    return w
      .run(
        () =>
          oneTapApi.updateSessionStatus(sessionId, to === "CANCELLED" ? { status: to, cancellationReason: reason } : { status: to }).catch((e: unknown) => {
            caught = e;
            throw e;
          }),
        () => {
          setSheet(null);
          onChanged(to);
        },
      )
      .then((o) => {
        if (o === "offline" && fromSheet) setSheet(null);
        if (o === "conflict") {
          const reasons = medicalReasons(caught);
          setSheet(null);
          if (reasons.length) setMedical(reasons);
          else {
            infoToast(ot.sessionConflict);
            onReload();
          }
        }
      });
  };

  const primaryTo: SessionStatusValue | null = next.includes("IN_PROGRESS") ? "IN_PROGRESS" : next.includes("COMPLETED") ? "COMPLETED" : null;
  const primary: ReactNode = primaryTo ? (
    <View style={{ gap: 8 }}>
      <SheetButton
        testID="session-primary"
        label={primaryTo === "IN_PROGRESS" ? ot.sessionStart : ot.sessionComplete}
        loading={pendingPrimary && w.sending}
        disabled={w.sending && !pendingPrimary}
        onPress={() => {
          setPendingPrimary(true);
          void send(primaryTo).finally(() => setPendingPrimary(false));
        }}
      />
      {!sheet ? <ForbiddenLine text={w.forbidden} /> : null}
    </View>
  ) : null;

  const open = (s: SessionSheet) => () => {
    w.setForbidden("");
    setSheet(s);
  };
  const more: MoreItem[] = [
    ...(next.includes("SKIPPED") ? [{ key: "skip", label: ot.sessionSkip, icon: "ban" as const, danger: true, onPress: open("SKIPPED") }] : []),
    ...(next.includes("ABANDONED") ? [{ key: "abandon", label: ot.sessionAbandon, icon: "alertCircle" as const, danger: true, onPress: open("ABANDONED") }] : []),
    ...(next.includes("CANCELLED") ? [{ key: "cancel", label: ot.sessionCancel, icon: "xCircle" as const, danger: true, onPress: open("CANCELLED") }] : []),
  ];

  const sheets = (
    <>
      <ConfirmSheet
        visible={sheet === "SKIPPED" || sheet === "ABANDONED"}
        title={sheet === "ABANDONED" ? ot.sessionAbandonTitle : ot.sessionSkipTitle}
        body={sheet === "ABANDONED" ? ot.sessionAbandonBody : ot.sessionSkipBody}
        confirmLabel={sheet === "ABANDONED" ? ot.sessionAbandon : ot.sessionSkip}
        danger
        sending={w.sending}
        forbidden={w.forbidden}
        onCancel={() => setSheet(null)}
        onConfirm={() => void send(sheet as SessionStatusValue, undefined, true)}
      />
      <ConfirmSheet
        visible={sheet === "CANCELLED"}
        title={ot.sessionCancelTitle}
        body={ot.sessionCancelBody}
        confirmLabel={ot.sessionCancel}
        danger
        reasons={ot.sessionCancelReasons}
        otherMax={CANCEL_MAX}
        sending={w.sending}
        forbidden={w.forbidden}
        onCancel={() => setSheet(null)}
        onConfirm={(reason) => void send("CANCELLED", reason, true)}
      />
      <BottomSheet
        visible={medical.length > 0}
        onClose={() => setMedical([])}
        title={ot.medicalTitle}
        footer={
          <View style={styles.footer}>
            <View style={{ flex: 1 }}>
              <SheetButton testID="medical-close" label={ot.close} kind="outline" onPress={() => setMedical([])} />
            </View>
            <View style={{ flex: 1 }}>
              <SheetButton
                testID="medical-open"
                label={ot.medicalOpen}
                onPress={() => {
                  setMedical([]);
                  onOpenMedical();
                }}
              />
            </View>
          </View>
        }
      >
        <View testID="medical-sheet" style={{ gap: 12, paddingBottom: 8 }}>
          <Text style={[TEXT.body, { color: p.ink }]}>{ot.medicalBody}</Text>
          {medical.map((r) => (
            <View key={r} style={styles.reason}>
              <Icon name="alertCircle" size={20} color={p.danger} />
              <Text style={[TEXT.body, { color: p.ink, flex: 1 }]}>{r}</Text>
            </View>
          ))}
        </View>
      </BottomSheet>
    </>
  );
  return { primary, more, sheets };
}

/* ───────────── Giáo án (HLV) ───────────── */

type PlanCopy = { label: string; title: string; body: string; danger?: boolean };

export function planCopy(from: PlanStatusValue, to: PlanStatusValue): PlanCopy {
  if (to === "ACTIVE")
    return from === "DRAFT" ? { label: ot.planActivate, title: ot.planActivateTitle, body: ot.planActivateBody } : { label: ot.planReopen, title: ot.planReopenTitle, body: ot.planReopenBody };
  if (to === "COMPLETED") return { label: ot.planComplete, title: ot.planCompleteTitle, body: ot.planCompleteBody };
  if (to === "DRAFT") return { label: ot.planDraft, title: ot.planDraftTitle, body: ot.planDraftBody };
  return { label: ot.planCancel, title: ot.planCancelTitle, body: ot.planCancelBody, danger: true };
}

export function usePlanActions({ planId, status, onChanged, onReload }: { planId: string; status: PlanStatusValue; onChanged: (s: PlanStatusValue) => void; onReload: () => void }) {
  const w = useWrite(ot.planForbidden);
  const [to, setTo] = useState<PlanStatusValue | null>(null);
  const more: MoreItem[] = NEXT_PLAN[status].map((s) => {
    const c = planCopy(status, s);
    return {
      key: s,
      label: c.label,
      icon: s === "CANCELLED" ? ("xCircle" as const) : s === "COMPLETED" ? ("success" as const) : s === "DRAFT" ? ("edit" as const) : ("training" as const),
      danger: c.danger,
      onPress: () => {
        w.setForbidden("");
        setTo(s);
      },
    };
  });
  const c = to ? planCopy(status, to) : null;
  const sheets = (
    <ConfirmSheet
      visible={to != null}
      title={c?.title ?? ""}
      body={c?.body ?? ""}
      confirmLabel={to === "COMPLETED" ? ot.planCompleteShort : c?.label ?? ""}
      danger={c?.danger}
      sending={w.sending}
      forbidden={w.forbidden}
      onCancel={() => setTo(null)}
      onConfirm={() => {
        const target = to!;
        void w
          .run(
            () => oneTapApi.updatePlanStatus(planId, { status: target }),
            () => {
              setTo(null);
              onChanged(target);
            },
          )
          .then((o) => {
            if (o === "offline") setTo(null);
            if (o === "conflict") {
              setTo(null);
              infoToast(ot.planConflict);
              onReload();
            }
          });
      }}
    />
  );
  return { more, sheets };
}

/* ───────────── Thu hồi giấy phép (bác sĩ) ───────────── */

export function RevokeClearanceButton({ clearanceId, training, onDone }: { clearanceId: string; training: boolean; onDone: () => void }) {
  const p = useFighterPalette();
  const [open, setOpen] = useState(false);
  const w = useWrite(ot.clearanceForbidden);
  return (
    <>
      <View style={{ alignSelf: "stretch" }}>
        <SheetButtonDangerOutline
          testID={`revoke-${clearanceId}`}
          label={ot.clearanceRevoke}
          color={p.danger}
          onPress={() => {
            w.setForbidden("");
            setOpen(true);
          }}
        />
      </View>
      <ConfirmSheet
        visible={open}
        title={ot.clearanceRevokeTitle}
        body={ot.clearanceRevokeBody(training)}
        confirmLabel={ot.clearanceRevokeShort}
        danger
        reasons={ot.clearanceReasons}
        otherMax={REVOKE_MAX}
        sending={w.sending}
        forbidden={w.forbidden}
        onCancel={() => setOpen(false)}
        onConfirm={(reason) =>
          void w
            .run(
              () => oneTapApi.revokeClearance(clearanceId, { revokedReason: reason }),
              () => {
                setOpen(false);
                onDone();
              },
            )
            .then((o) => {
              closeIfOffline(setOpen)(o);
              if (o === "conflict") {
                setOpen(false);
                infoToast(ot.clearanceConflict);
                onDone();
              }
            })
        }
      />
    </>
  );
}

/** Nút viền danger (chữ danger trên nền surface; ≥48dp). */
export function SheetButtonDangerOutline({ label, onPress, color, testID }: { label: string; onPress: () => void; color: string; testID?: string }) {
  const p = useFighterPalette();
  return (
    <View>
      <SheetButtonBase testID={testID} label={label} onPress={onPress} fg={color} border={color} bg={p.surface} />
    </View>
  );
}

function SheetButtonBase({ label, onPress, fg, border, bg, testID }: { label: string; onPress: () => void; fg: string; border: string; bg: string; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[styles.btn, { borderColor: border, backgroundColor: bg }]}>
      <Text style={[TEXT.bodyBold, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

/* ───────────── Kết thúc phân công ───────────── */

export function useEndAssignment({
  kind,
  fighterId,
  own,
  onDone,
}: {
  kind: "coach" | "doctor";
  fighterId: string;
  /** Bác sĩ tự kết thúc phụ trách của mình. */
  own?: boolean;
  onDone: (assignmentId: string) => void;
}) {
  const w = useWrite(ot.endForbidden);
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const sheet = (
    <ConfirmSheet
      visible={target != null}
      title={own ? ot.endOwnTitle : ot.endAssignTitle(target?.name ?? "")}
      body={own ? ot.endOwnBody : ot.endAssignBody}
      confirmLabel={own ? ot.endOwnShort : ot.endAssign}
      danger
      reasons={kind === "doctor" ? ot.endReasonsDoctor : ot.endReasons}
      otherMax={END_MAX}
      sending={w.sending}
      forbidden={w.forbidden}
      onCancel={() => setTarget(null)}
      onConfirm={(endReason) => {
        const t = target!;
        const call = kind === "coach" ? oneTapApi.endCoachAssignment : oneTapApi.endDoctorAssignment;
        void w
          .run(
            () => call(fighterId, t.id, { endReason }),
            () => {
              setTarget(null);
              onDone(t.id);
            },
          )
          .then((o) => {
            if (o === "offline") setTarget(null);
            if (o === "conflict") {
              setTarget(null);
              infoToast(ot.endConflict);
              onDone(t.id);
            }
          });
      }}
    />
  );
  return {
    open: (id: string, name: string) => {
      w.setForbidden("");
      setTarget({ id, name });
    },
    sheet,
  };
}

const styles = StyleSheet.create({
  footer: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  reason: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  btn: { minHeight: 48, borderRadius: 12, borderWidth: 2, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
});
