import { Pressable, StyleSheet, Text, View } from "react-native";

import type { HealthAlert } from "@/api/media";
import { jointLabel, severityLabel } from "@/components/medical/medical-format";
import { ev } from "@/i18n/video-evidence";
import { useFighterPalette } from "@/screens/fighter/redesign/palette";
import { formatPrecise } from "@/screens/media/evidence/evidence-model";
import type { FindingReview, WindowReview } from "@/screens/media/evidence/review-model";
import { useTypography } from "@/theme";

export function StatusLine({ text, tone, action, onAction, testID }: { text: string; tone: "done" | "wait" | "no"; action?: string; onAction?: () => void; testID?: string }) {
  const c = useFighterPalette();
  const color = tone === "done" ? c.success : tone === "no" ? c.warning : c.muted;
  return (
    <View style={styles.status}>
      <Text style={{ color, fontSize: 12, fontWeight: "600", flex: 1 }}>{text}</Text>
      {action && onAction ? (
        <Pressable testID={testID} accessibilityRole="button" onPress={onAction} hitSlop={6} style={[styles.action, { borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function findingStatusText(r: FindingReview | null): { text: string; tone: "done" | "wait" | "no" } {
  if (!r) return { text: ev.waitingReview, tone: "wait" };
  const base = ev.decisionDone[r.status] ?? r.status;
  return { text: r.status === "corrected" && r.correctedLabel ? `${base}: ${r.correctedLabel}` : base, tone: r.status === "rejected" ? "no" : "done" };
}

export function windowStatusText(r: WindowReview | null): { text: string; tone: "done" | "wait" | "no" } {
  if (!r) return { text: ev.waitingReview, tone: "wait" };
  const who = ev.reviewedBy[r.reviewerRole] ?? "";
  const range = r.decision === "corrected" && r.startMs != null && r.endMs != null ? ` ${formatPrecise(r.startMs)}–${formatPrecise(r.endMs)}` : "";
  return { text: `${ev.windowDone[r.decision] ?? r.decision}${range}${who ? ` · ${who}` : ""}`, tone: r.decision === "rejected" ? "no" : "done" };
}

export function SummaryCard({ rating, text, canEdit, onEdit }: { rating: number | null; text: string | null; canEdit: boolean; onEdit: () => void }) {
  const c = useFighterPalette();
  const live = useTypography();
  const has = rating != null || Boolean(text);
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]} testID="summary-card">
      <View style={styles.cardHead}>
        <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>{ev.summary}</Text>
        {rating != null ? <Text style={{ color: c.ink, fontFamily: live.faces.bold, fontSize: 18 }}>{ev.ratingOf(Math.round(rating))}</Text> : null}
      </View>
      <Text style={{ color: has ? c.ink : c.muted, fontSize: 14 }}>{text || ev.summaryEmpty}</Text>
      {canEdit ? (
        <Pressable testID="summary-edit" accessibilityRole="button" onPress={onEdit} style={[styles.action, styles.cardBtn, { borderColor: c.line }]}>
          <Text style={{ color: c.ink, fontSize: 13, fontWeight: "600" }}>{has ? ev.summaryUpdate : ev.summaryRate}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function HealthAlertsSection({ alerts, onSeek }: { alerts: HealthAlert[]; onSeek: (ms: number) => void }) {
  const c = useFighterPalette();
  const live = useTypography();
  return (
    <View style={styles.section} testID="health-alerts">
      <Text style={{ color: c.ink, fontFamily: live.faces.semibold, fontSize: 16 }}>{ev.healthAlerts}</Text>
      {alerts.length === 0 ? <Text style={{ color: c.muted }}>{ev.noHealthAlerts}</Text> : null}
      {alerts.map((a, i) => (
        <Pressable
          key={`${a.joint}-${i}`}
          accessibilityRole="button"
          onPress={() => onSeek(a.windowStartMs ?? a.triggerTimeMs)}
          style={[styles.alert, { borderColor: c.line, backgroundColor: c.surface }]}
          testID={`health-alert-${i}`}
        >
          <Text style={{ color: c.muted, fontSize: 13, width: 52 }}>{formatPrecise(a.triggerTimeMs)}</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: c.warning, fontFamily: live.faces.semibold, fontSize: 14 }}>
              {jointLabel(a.joint)} · {severityLabel(a.severity)}
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {[Number.isFinite(a.avgRomRatio) ? ev.romRatio(Math.round(a.avgRomRatio * 100)) : null, a.recommendation].filter(Boolean).join(" · ")}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 68, paddingBottom: 8 },
  action: { minHeight: 32, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, justifyContent: "center" },
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  cardHead: { flexDirection: "row", alignItems: "center" },
  cardBtn: { alignSelf: "flex-start", marginTop: 4 },
  section: { gap: 8 },
  alert: { flexDirection: "row", gap: 12, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
});
