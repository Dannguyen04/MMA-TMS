import type { CampDetail, CornerCard, RoundsResponse, Suspension } from "@/api/fight-camp";
export const previewBout: CampDetail = {
  id: "preview", fighterId: "preview-fighter", coachId: "preview-coach", eventName: "Lotus Fight Night", opponentName: "Somchai Prasert", venue: "Nhà thi đấu Lotus",
  weightClassCode: "LIGHTWEIGHT", weightLimitKg: 60, catchweightKg: null, weighInAt: "2026-10-29T09:00:00+07:00", boutAt: "2026-10-30T19:00:00+07:00", scheduledRounds: 3,
  status: "FIGHT_WEEK", officialWeightKg: null, madeWeight: null, hydrationCheck: null,
  opponentAnalysis: {
    profile: { stance: "ORTHODOX", style: "STRIKER", wins: 8, losses: 2, draws: 0, heightCm: 170, reachCm: 173, source: "Video trận gần nhất" },
    observations: [{ id: "o1", kind: "OPENING", text: "Hạ tay phải khi lùi sau tổ hợp đòn.", confidence: "REPEATED", evidenceNote: "Quan sát ở hai hiệp cuối", evidenceTime: "02:14" }],
    tactics: [
      { id: "t1", text: "Giữ khoảng cách, dùng đấm thẳng tay trước để dẫn nhịp.", round: null, observationIds: ["o1"], sessionIds: ["preview-session"], partnerBrief: "Ép nhẹ sau tổ hợp để luyện phản đòn." },
      { id: "t2", text: "Đổi góc sau jab; không đứng lại trước mặt đối thủ.", round: 2, observationIds: ["o1"], sessionIds: [], partnerBrief: null },
    ],
  },
  tacticsWithoutSessions: ["t2"], sessions: [{ id: "preview-session", title: "Đối luyện chiến thuật", scheduledAt: "2026-10-26T17:00:00+07:00" }],
  requirements: [{ code: "MEDICAL", label: "Hồ sơ y tế thi đấu", required: true, status: "CONFIRMED", validUntil: "2026-11-30" }],
  weight: { latestKg: 60.4, latestOn: "2026-10-26", remainingPct: 0.66, status: "ABOVE_TARGET", referencePath: [{ date: "2026-10-24", kg: 61 }, { date: "2026-10-29", kg: 60 }] },
  weightReminder: { active: true, level: "ASK_TODAY", daysSinceLastWeight: 1, messageCode: "WEIGHT_REMINDER_ASK_TODAY" },
  acuteLoss: { status: "WITHIN", startKg: 61, startOn: "2026-10-24", lossPct: 0.98, limitPct: 5 },
};
export const previewCorner: CornerCard = { acuteLossFlag: false, tactics: previewBout.opponentAnalysis.tactics!.map((t, i) => ({ id: t.id, text: t.text, round: t.round, trained: !!t.sessionIds.length, basis: i ? "ONCE" : "REPEATED", partnerBrief: t.partnerBrief ?? null })) };
export const previewRounds: RoundsResponse = { scheduledRounds: 3, rounds: [], advice: null };
/** Fake demo record (same sample the fighter suspension screen already showed). */
export const previewSuspension: Suspension = { id: "sample", reason: "MANDATORY_REST", status: "ACTIVE", startsOn: "2026-10-26", endsOn: "2026-11-01", blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING", "STRENGTH_CONDITIONING"], requiresClearance: false, clearedAt: null, clearanceNote: null, maxAllowedTier: 1, gradedReturn: null };
/** T-048 preview cases (fixed dates). Demo mode shows `active`. */
export const previewSuspensionCases: Record<"active" | "awaiting" | "graded" | "multiple", Suspension[]> = {
  active: [previewSuspension],
  awaiting: [{ ...previewSuspension, id: "sample-awaiting", reason: "MEDICAL", status: "AWAITING_CLEARANCE", endsOn: "2026-10-30", requiresClearance: true, blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING"], maxAllowedTier: 2 }],
  graded: [{ ...previewSuspension, id: "sample-graded", reason: "KO", status: "ENDED", startsOn: "2026-10-01", endsOn: "2026-10-30", blockedSessionTypes: [], maxAllowedTier: 3, gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-02" } }],
  multiple: [
    { ...previewSuspension, id: "sample-ko", reason: "KO", status: "ENDED", startsOn: "2026-10-01", endsOn: "2026-10-30", blockedSessionTypes: [], maxAllowedTier: 3, gradedReturn: { ceiling: 3, fullReturnOn: "2026-11-02" } },
    { ...previewSuspension, id: "sample-other", reason: "OTHER", endsOn: "2026-11-05", blockedSessionTypes: ["SPARRING", "GRAPPLING", "PAD_WORK", "HEAVY_BAG", "SHADOW_BOXING"], maxAllowedTier: 2 },
  ],
};
