import { Text, View } from "react-native";

import type { HealthAlert } from "@/api/media";
import { StaggerList } from "@/components/motion";
import { jointLabel, severityLabel } from "@/components/medical/medical-format";
import { ev } from "@/i18n/video-evidence";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { sentences } from "@/screens/fight-camp/camp-ui";
import { EvHead, EvRow, type Word } from "@/screens/media/evidence/evidence-panels";
import { formatPrecise } from "@/screens/media/evidence/evidence-model";
import type { FindingReview, WindowReview } from "@/screens/media/evidence/review-model";
import { useThemePreference } from "@/theme";
import { readableTextStyle, lh } from "@/theme/typography";

/** The coach's decision on a finding as a word: Chờ duyệt (red, waiting on the coach), Đã xác nhận / Đã sửa (green), Đã bác bỏ. */
export function findingStatusText(r: FindingReview | null): Word {
  if (!r) return { word: ev.waitingReview, tone: "warn" };
  const base = ev.decisionDone[r.status] ?? UNKNOWN_VALUE;
  return { word: r.status === "corrected" && r.correctedLabel ? `${base}: ${r.correctedLabel}` : base, tone: r.status === "rejected" ? undefined : "ok" };
}

export function windowStatusText(r: WindowReview | null): Word {
  if (!r) return { word: ev.waitingReview, tone: "warn" };
  const who = ev.reviewedBy[r.reviewerRole] ?? "";
  const range = r.decision === "corrected" && r.startMs != null && r.endMs != null ? ` ${formatPrecise(r.startMs)}–${formatPrecise(r.endMs)}` : "";
  return { word: `${ev.windowDone[r.decision] ?? UNKNOWN_VALUE}${range}${who ? ` · ${who}` : ""}`, tone: r.decision === "rejected" ? undefined : "ok" };
}

/**
 * Đánh giá tổng (redesign step 19): one row with the technique rating as the lead ("4/5", "–" before rating); the coach
 * taps it to rate. The written review follows, one sentence per line.
 */
export function SummaryCard({ rating, text, canEdit, onEdit }: { rating: number | null; text: string | null; canEdit: boolean; onEdit: () => void }) {
  const { colors: c } = useThemePreference();
  const has = rating != null || Boolean(text);
  const lead = rating != null ? `${Math.round(rating)}/5` : "–";
  const line = canEdit ? (has ? ev.summaryUpdate : ev.summaryRate) : has ? "" : ev.summaryEmpty;
  return (
    <View testID="summary-card" style={{ gap: 10 }}>
      <EvRow testID={canEdit ? "summary-edit" : undefined} lead={lead} leadTone={rating != null ? undefined : "dim"} title={ev.summary} line={line} last
        a11y={[ev.summary, rating != null ? `${ev.rating} ${ev.ratingOf(Math.round(rating))}` : ev.summaryEmpty, canEdit ? line : ""].filter(Boolean).join(", ")}
        onPress={canEdit ? onEdit : undefined}/>
      {text ? <View style={{ gap: 4 }}>{sentences(text).map((s, i) => <Text key={i} style={{ ...readableTextStyle(15), lineHeight: lh(22), color: c.ink }}>{s}</Text>)}</View> : null}
    </View>
  );
}

/** Doctor: health alerts as rows (time, joint, severity word in red, range of motion and advice). A tap seeks. */
export function HealthAlertsSection({ alerts, onSeek }: { alerts: HealthAlert[]; onSeek: (ms: number) => void }) {
  const { colors: c } = useThemePreference();
  return (
    <View style={{ gap: 8 }} testID="health-alerts">
      <EvHead title={ev.healthAlerts} aside={alerts.length ? String(alerts.length) : undefined}/>
      {alerts.length === 0 ? <Text style={{ ...readableTextStyle(15), color: c.ink }}>{ev.noHealthAlerts}</Text> : null}
      {alerts.length ? <StaggerList>
        {alerts.map((a, i) => {
          const line = [Number.isFinite(a.avgRomRatio) ? ev.romRatio(Math.round(a.avgRomRatio * 100)) : null, a.recommendation].filter(Boolean).join(" · ");
          const sev = severityLabel(a.severity);
          return <EvRow key={`${a.joint}-${i}`} testID={`health-alert-${i}`} lead={formatPrecise(a.triggerTimeMs)} title={jointLabel(a.joint)} word={{ word: sev, tone: "warn" }} line={line}
            a11y={`${jointLabel(a.joint)}, ${sev}, ${ev.at(formatPrecise(a.triggerTimeMs))}${line ? `, ${line}` : ""}`}
            onPress={() => onSeek(a.windowStartMs ?? a.triggerTimeMs)} last={i === alerts.length - 1}/>;
        })}
      </StaggerList> : null}
    </View>
  );
}
