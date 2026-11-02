import type { Suspension } from "@/api/fight-camp";
import { useThemePreference } from "@/theme";
import { Copy, Fact, Frame } from "./camp-ui";
import { allowedTodayLine, dateLabel, suspensionHeadline, suspensionReasonLabel, suspensionStatusLabel } from "./camp-rules";
import { UNKNOWN_VALUE } from "@/i18n/backend-codes";
import { campText } from "@/i18n/fight-camp";

/**
 * One suspension record, shared by coach and fighter. Only fields the API returns
 * (status, reason, dates, blockedSessionTypes, gradedReturn, requiresClearance, clearedAt, clearanceNote).
 * Phase 5 B (1A): one allowed line computed like the server gate; no "bị chặn / không bị chặn" lists.
 */
export function SuspensionCard({ s }: { s: Suspension }) {
  const { colors: c } = useThemePreference();
  const live = s.status === "ACTIVE" || s.status === "AWAITING_CLEARANCE";
  const allowed = allowedTodayLine(s);
  // Phase 5 B (2a): ENDED with gradedReturn is still a graded return; same headline as the fighter card.
  const grading = s.status === "ENDED" && !!s.gradedReturn;
  return <Frame tone={live ? "danger" : undefined}>
    <Copy large strong color={live ? c.danger : undefined}>{grading ? suspensionHeadline(s) : suspensionStatusLabel[s.status] ?? UNKNOWN_VALUE}</Copy>
    <Fact label={campText.campSuspension.lyDo} value={suspensionReasonLabel[s.reason] ?? UNKNOWN_VALUE}/>
    <Fact label={campText.campSuspension.batDau} value={dateLabel(s.startsOn)}/><Fact label={campText.campSuspension.ngayHetThoiHan} value={dateLabel(s.endsOn)}/>
    {allowed ? <Copy strong>{allowed}</Copy> : null}
    {grading ? null : s.status === "ENDED" ? <Copy>{campText.campSuspension.dinhChiNayDaKet}</Copy> : <>
      <Copy muted>{s.requiresClearance && !s.clearedAt ? campText.campSuspension.canXacNhanChoTap : campText.campSuspension.duKienSauNgayNeu(dateLabel(s.endsOn))}</Copy>
    </>}
    {s.clearanceNote ? <Copy muted>{s.clearanceNote}</Copy> : null}
  </Frame>;
}
