import type { Analysis, CampDetail, CampRound, CornerCard, RoundInput, RoundsResponse } from "@/api/fight-camp";

/** Sample mode only. Mirrors Nest bout-analysis.model R20–R24; never used for live advice. */
const INEFFECTIVE_STREAK_TO_DROP = 2;
const NOT_SEEN_STREAK_TO_DEMOTE = 2;
const KNOCKDOWN_WARN_TOTAL = 2;
const STUNNED_STREAK_WARN = 2;

type RecordedRound = RoundInput & { roundNo: number };
export function previewCornerCard(analysis: Analysis, rounds: readonly RecordedRound[] = [], acuteLoss: CampDetail["acuteLoss"] = null): CornerCard {
  const repeated = new Set((analysis.observations ?? []).filter(o => o.confidence === "REPEATED" || rounds.some(r => r.observationMarks?.[o.id] === "SEEN")).map(o => o.id));
  return {
    tactics: (analysis.tactics ?? []).map(t => ({
      id: t.id, text: t.text, round: t.round, partnerBrief: t.partnerBrief ?? null,
      trained: t.sessionIds.length > 0,
      basis: t.observationIds.some(id => repeated.has(id)) ? "REPEATED" : "ONCE",
    })).sort((a, b) => Number(b.basis === "REPEATED") - Number(a.basis === "REPEATED") || Number(b.trained) - Number(a.trained)),
    acuteLossFlag: acuteLoss?.status === "EXCEEDED",
  };
}
function ineffectiveStreak(rounds: readonly RecordedRound[], id: string) {
  let count = 0;
  // NOT_USED/unmarked rounds neither add to nor reset the streak, as on the server.
  for (const r of [...rounds].reverse()) {
    if (r.tacticMarks?.[id] === "EFFECTIVE") break;
    if (r.tacticMarks?.[id] === "INEFFECTIVE") count++;
  }
  return count;
}
function unseenStreak(rounds: readonly RecordedRound[], id: string) {
  let count = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (rounds[i].observationMarks?.[id] !== "NOT_SEEN") break;
    if (i < rounds.length - 1 && rounds[i + 1].roundNo !== rounds[i].roundNo + 1) break;
    count++;
  }
  return count;
}
export function previewRoundAdvice(analysis: Analysis, input: readonly RecordedRound[], scheduledRounds: number): NonNullable<RoundsResponse["advice"]> {
  const rounds = [...input].sort((a, b) => a.roundNo - b.roundNo);
  const tactics = analysis.tactics ?? [];
  const used = new Set(tactics.filter(t => rounds.some(r => ["EFFECTIVE", "INEFFECTIVE"].includes(r.tacticMarks?.[t.id] ?? ""))).map(t => t.id));
  const usedBasis = new Set(tactics.filter(t => used.has(t.id)).flatMap(t => t.observationIds));
  const demoted = new Set((analysis.observations ?? []).filter(o => unseenStreak(rounds, o.id) >= NOT_SEEN_STREAK_TO_DEMOTE).map(o => o.id));
  const ranked = previewCornerCard(analysis, rounds).tactics.map(t => {
    const source = tactics.find(s => s.id === t.id)!;
    const changed = source.observationIds.length > 0 && source.observationIds.every(id => demoted.has(id));
    return {
      ...t,
      score: rounds.reduce((sum, r) => sum + (r.tacticMarks?.[t.id] === "EFFECTIVE" ? 1 : r.tacticMarks?.[t.id] === "INEFFECTIVE" ? -1 : 0), 0),
      dropped: ineffectiveStreak(rounds, t.id) >= INEFFECTIVE_STREAK_TO_DROP,
      ...(changed ? { note: "OPPONENT_MAY_HAVE_CHANGED" as const } : {}),
      promote: !used.has(t.id) && source.observationIds.some(id => usedBasis.has(id)),
    };
  }).sort((a, b) => Number(a.dropped || !!a.note) - Number(b.dropped || !!b.note) || b.score - a.score || Number(b.promote) - Number(a.promote));
  const wins = rounds.filter(r => r.selfScore === "WIN").length;
  const losses = rounds.filter(r => r.selfScore === "LOSS").length;
  const remaining = scheduledRounds - rounds.length;
  const needed = losses - wins + 1;
  const standing = losses < wins ? { kind: "AHEAD", selfScored: true } : needed > remaining ? { kind: "HARD_TO_WIN_ON_POINTS", selfScored: true } : { kind: "NEED_WINS", needed, remaining, selfScored: true };
  const reasons: string[] = [];
  if (rounds.reduce((n, r) => n + (r.knockdownsAgainst ?? 0), 0) >= KNOCKDOWN_WARN_TOTAL) reasons.push("KNOCKDOWNS");
  let stunned = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (!rounds[i].stunned || (i < rounds.length - 1 && rounds[i + 1].roundNo !== rounds[i].roundNo + 1)) break;
    stunned++;
  }
  if (stunned >= STUNNED_STREAK_WARN) reasons.push("STUNNED_STREAK");
  return { tactics: ranked.map(({ promote: _promote, ...t }) => t), standing, safety: reasons.length ? { level: "RED", reasons } : null };
}
export function previewRoundsResponse(bout: CampDetail, rounds: readonly CampRound[]): RoundsResponse {
  const sorted = [...rounds].sort((a, b) => a.roundNo - b.roundNo);
  const total = bout.scheduledRounds;
  return { scheduledRounds: total, rounds: sorted, advice: total != null && total > sorted.length && sorted.length > 0 ? previewRoundAdvice(bout.opponentAnalysis, sorted, total) : null };
}
