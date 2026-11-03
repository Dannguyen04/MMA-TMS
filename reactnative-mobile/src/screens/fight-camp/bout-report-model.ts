import type { Analysis, CampDetail, CampReport, ImprovementPoint, RoundInput, TacticOutcome } from "@/api/fight-camp";

/**
 * T-041 R8: chép nguyên logic backend để bản demo ra cùng kết quả.
 * Nguồn: nestjs-api/src/bouts/bout-analysis.model.ts (origin/fight-camp a40c499) dòng 436-473 và 489-525.
 */
export type ReportRound = RoundInput & { roundNo: number };
type ReviewedAnalysis = Analysis;

export function evaluateTactics(analysis: ReviewedAnalysis, rounds: readonly ReportRound[]) {
  return {
    tactics: (analysis.tactics ?? []).map(t => {
      const effectiveRounds = rounds.filter(r => r.tacticMarks?.[t.id] === "EFFECTIVE").length;
      const ineffectiveRounds = rounds.filter(r => r.tacticMarks?.[t.id] === "INEFFECTIVE").length;
      const outcome: TacticOutcome = ineffectiveRounds > effectiveRounds ? "INEFFECTIVE" : effectiveRounds > 0 ? "EFFECTIVE" : "NOT_USED";
      return { id: t.id, text: t.text, effectiveRounds, ineffectiveRounds, outcome };
    }),
    observations: (analysis.observations ?? []).map(o => {
      const marks = rounds.map(r => r.observationMarks?.[o.id]).filter(m => m !== undefined);
      return { id: o.id, text: o.text, notSeenInBout: marks.length > 0 && marks.every(m => m === "NOT_SEEN") };
    }),
  };
}

export function buildImprovementPoints(analysis: ReviewedAnalysis, inputRounds: readonly ReportRound[], acuteLoss: { status: string } | null): ImprovementPoint[] {
  const points: ImprovementPoint[] = [];
  // Không có hiệp nào thì R25 chỉ cho cờ giảm cân, kể cả khi đã có đánh giá.
  if (inputRounds.length) {
    const evaluation = evaluateTactics(analysis, inputRounds);
    for (const t of analysis.tactics ?? []) {
      const outcome = t.review?.outcome ?? evaluation.tactics.find(e => e.id === t.id)!.outcome;
      if (outcome === "INEFFECTIVE") points.push({ code: "TACTIC_INEFFECTIVE", tacticId: t.id, text: t.text });
    }
  }
  if (acuteLoss?.status === "EXCEEDED") points.push({ code: "ACUTE_LOSS_EXCEEDED" });
  const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (!rounds[i]!.fatigued || (i < rounds.length - 1 && rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)) break;
    streak++;
  }
  if (streak >= 2) {
    const fromRound = rounds[rounds.length - streak]!.roundNo;
    points.push({ code: `FATIGUE_FROM_ROUND_${fromRound}`, fromRound });
  }
  return points;
}

/** Đánh giá HLV đã lưu trong bản demo (giữ trong bộ nhớ như các hiệp demo). */
const previewReviews = new Map<string, Record<string, { outcome: TacticOutcome; note: string | null }>>();
export function savePreviewReview(boutId: string, reviews: { tacticId: string; outcome: TacticOutcome; note?: string }[]) {
  const saved = { ...previewReviews.get(boutId) };
  for (const r of reviews) saved[r.tacticId] = { outcome: r.outcome, note: r.note ?? null };
  previewReviews.set(boutId, saved);
}
export function resetPreviewReviews(boutId: string) { previewReviews.delete(boutId); }

/**
 * Báo cáo demo dựng giống getReport (bouts.service.ts:646-676). Kết quả trận demo cố định "Thắng, tính điểm";
 * hiệp kết thúc và bị đánh ngã lấy như getResultPrefill (:678-691). Chưa có đánh giá thì app điền sẵn (auto),
 * như khi backend ghi kết quả (:1707-1713).
 */
export function previewReportFrom(bout: CampDetail, rounds: readonly ReportRound[]): CampReport {
  const saved = previewReviews.get(bout.id) ?? {};
  const evaluation = evaluateTactics(bout.opponentAnalysis, rounds);
  const analysis: Analysis = { ...bout.opponentAnalysis, tactics: (bout.opponentAnalysis.tactics ?? []).map(t => {
    const own = saved[t.id]; const auto = evaluation.tactics.find(e => e.id === t.id)!.outcome;
    return { ...t, review: own ? { outcome: own.outcome, note: own.note, auto: false } : rounds.length ? { outcome: auto, note: null, auto: true } : undefined };
  }) };
  return {
    result: { result: "WIN", method: "DECISION", resultRound: rounds.length ? Math.max(...rounds.map(r => r.roundNo)) : null, knockedDown: rounds.length ? rounds.some(r => (r.knockdownsAgainst ?? 0) > 0) : null },
    tactics: evaluation.tactics.map(t => ({ ...t, outcome: rounds.length ? t.outcome : null, review: analysis.tactics!.find(s => s.id === t.id)?.review ?? null })),
    observations: evaluation.observations,
    acuteLoss: bout.acuteLoss,
    improvementPoints: buildImprovementPoints(analysis, rounds, bout.acuteLoss),
    roundsRecorded: rounds.length,
  };
}
