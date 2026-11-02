import { apiFetch } from "./client";
import { withQuery } from "./query";

/** Verified against Nest bouts and suspensions controllers, 27 October 2026. */
export type CampStatus = "SCHEDULED" | "CAMP" | "FIGHT_WEEK" | "WEIGHED_IN" | "COMPLETED" | "CANCELLED";
export type WeightStatus = "ON_TRACK" | "ABOVE_TARGET" | "OVER_LIMIT" | "NOT_WEIGHED" | "NEUTRAL";
export type CursorPage<T> = { data: T[]; hasNextPage: boolean; nextCursor: string | null };
export type WeightTrack = {
  limitKg: number | null; points: { date: string; kg: number }[];
  latestKg: number | null; latestOn: string | null; remainingPct: number | null;
  status: WeightStatus; referencePath: { date: string; kg: number }[];
};
export type Observation = {
  id: string; kind: "STRENGTH" | "OPENING" | "HABIT"; text: string;
  confidence: "ONCE" | "REPEATED"; evidenceUrl?: string | null;
  evidenceNote?: string | null; evidenceTime?: string | null;
};
export type TacticOutcome = "EFFECTIVE" | "INEFFECTIVE" | "NOT_USED";
export type Tactic = {
  id: string; text: string; round: number | null; observationIds: string[];
  sessionIds: string[]; partnerBrief?: string | null;
  review?: { outcome: TacticOutcome; note?: string | null; auto?: boolean };
};
export type OpponentProfile = {
  wins?: number; losses?: number; draws?: number; heightCm?: number; reachCm?: number;
  stance?: "ORTHODOX" | "SOUTHPAW" | "SWITCH";
  style?: "STRIKER" | "WRESTLER" | "GRAPPLER" | "ALL_ROUND"; source?: string;
};
export type Analysis = { profile?: OpponentProfile; observations?: Observation[]; tactics?: Tactic[] };
export type AnalysisInput = { profile: OpponentProfile; observations: Observation[]; tactics: Omit<Tactic, "review">[] };
export type CampBout = {
  id: string; fighterId: string; coachId: string; eventName: string; opponentName: string | null;
  venue: string | null; weightClassCode: string; weightLimitKg: number; catchweightKg: number | null;
  weighInAt: string; boutAt: string; scheduledRounds: number | null; status: CampStatus;
  officialWeightKg: number | null; madeWeight: boolean | null; hydrationCheck: Hydration | null;
};
export type CampDetail = CampBout & {
  opponentAnalysis: Analysis; tacticsWithoutSessions: string[];
  sessions?: { id: string; title: string; scheduledAt: string }[];
  requirements: { code: string; label: string; required: boolean; status: string; validUntil: string | null }[];
  weight: Omit<WeightTrack, "boutId" | "points" | "limitKg">;
  weightReminder: { active: boolean; level: string | null; daysSinceLastWeight: number | null; messageCode: string | null };
  acuteLoss: { status: "EXCEEDED" | "WITHIN" | "NO_DATA"; startKg: number | null; startOn: string | null; lossPct: number | null; limitPct: number } | null;
};
export type Hydration = "NOT_APPLICABLE" | "PASSED" | "FAILED";
export type WeighResult = CampDetail & { weighIn: {
  outcome: "PASSED" | "FAILED"; reason: "OVER_LIMIT" | "HYDRATION_FAILED" | null;
  overByKg: number | null; overByPct: number | null; options: ("CATCHWEIGHT" | "CANCEL")[];
} };
export type InstructionCode = "SAFETY_CHECK" | "STOP_TACTIC" | "USE_TACTIC" | "RECHECK_OPPONENT" | "MUST_WIN_ROUND" | "HARD_TO_WIN_ON_POINTS" | "CUSTOM";
export type RoundInstruction = { code: InstructionCode; tacticId?: string; text?: string };
export type NextRoundPlan = {
  focusTacticIds: string[];
  addedTactics: { id: string; text: string; observationIds: string[] }[];
  instructions: RoundInstruction[];
};
export type RoundInput = {
  nextRoundPlan?: NextRoundPlan;
  tacticMarks?: Record<string, TacticOutcome>; observationMarks?: Record<string, "SEEN" | "NOT_SEEN">;
  selfScore?: "WIN" | "LOSS" | "CLOSE" | null; knockdownsAgainst?: number;
  stunned?: boolean; bleeding?: boolean; fatigued?: boolean; note?: string | null;
};
export type CampRound = RoundInput & { id: string; roundNo: number };
export type RoundsResponse = {
  scheduledRounds: number | null; rounds: CampRound[];
  advice: null | {
    nextRound: { roundNo: number; suggested: RoundInstruction[]; plan: NextRoundPlan | null };
    tactics: (CornerCard["tactics"][number] & { score: number; dropped: boolean; focus: boolean; addedRound: number | null; note?: "OPPONENT_MAY_HAVE_CHANGED" })[];
    standing: { kind: string; needed?: number; remaining?: number; selfScored: boolean };
    safety: null | { level: string; reasons: string[] };
  };
};
export type CornerCard = { tactics: { id: string; text: string; round: number | null; partnerBrief: string | null; trained: boolean; basis: string }[]; acuteLossFlag: boolean };
export type ImprovementPoint = { code: string; tacticId?: string; text?: string; fromRound?: number };
export type CampReport = {
  result: { result: string; method: string; resultRound: number | null; knockedDown: boolean | null };
  tactics: { id: string; text: string; effectiveRounds: number; ineffectiveRounds: number; outcome: TacticOutcome | null; review: { outcome: TacticOutcome; note?: string | null; auto?: boolean } | null }[];
  observations: { id: string; text: string; notSeenInBout: boolean }[];
  acuteLoss: CampDetail["acuteLoss"]; improvementPoints: ImprovementPoint[]; roundsRecorded: number;
};
export type PriorContext = { improvementPoints: ImprovementPoint[] | null; copyableAnalysis: { boutId: string; eventName: string; opponentName: string; opponentAnalysis: Analysis } | null };
export type Suspension = {
  id: string; reason: string; status: "UPCOMING" | "ACTIVE" | "AWAITING_CLEARANCE" | "ENDED";
  startsOn: string; endsOn: string; blockedSessionTypes: string[]; requiresClearance: boolean;
  clearedAt: string | null; clearanceNote: string | null;
  /** T-045 A: highest intensity tier allowed now, integer 0–5 (suspensions.model.ts:966). */
  maxAllowedTier: number;
  /** Only for KO/TKO on the 2 days after ENDED (suspensions.model.ts:187-218, :951-953). */
  gradedReturn: { ceiling: 3 | 4; fullReturnOn: string } | null;
};
/** T-038 A, verified against Nest origin/fight-camp b92d391: bouts.controller.ts:370 and :415, bout-analysis.model.ts:13-31. */
export type AiSuggestionKind = "PRE_BOUT_TACTICS" | "BETWEEN_ROUNDS" | "VIDEO_OBSERVATIONS";
export type AiSuggestion = {
  id: string; kind: AiSuggestionKind; roundNo: number | null; status: "OK" | "FAILED";
  /** NOT_CONFIGURED | TIMEOUT | QUOTA | UPSTREAM | EMPTY; null when OK. */
  errorCode: string | null; model: string;
  /** BETWEEN_ROUNDS: `instructions: { id: "ai1".., text, tacticId? }[]` (≤3) and `safety?: "RED"`. Read defensively. */
  output: Record<string, unknown>; cached: boolean; createdAt: string;
};
export type AiDecision = { decision: "ACCEPTED" | "PARTIAL" | "REJECTED"; acceptedItemIds: string[] };
/** History row (aiHistoryResponseSchema): newest first, ≤20, FAILED rows included, `cached` always false. */
export type AiHistoryItem = AiSuggestion & { decision: AiDecision["decision"] | null; acceptedItemIds: string[]; decidedAt: string | null };
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });
export const campApi = {
  list: (query?: { fighterId?: string; status?: CampStatus; cursor?: string; limit?: number }) =>
    apiFetch<CursorPage<CampBout>>(withQuery("/bouts", query)),
  detail: (id: string) => apiFetch<CampDetail>(`/bouts/${id}`),
  weightTrack: (id: string) => apiFetch<WeightTrack>(`/bouts/${id}/weight-track`),
  weigh: (id: string, body: { weightKg: number; hydrationCheck: Hydration; notes?: string }) =>
    apiFetch<WeighResult>(`/bouts/${id}/weigh-in`, json("POST", body)),
  catchweight: (id: string, body: { catchweightKg: number; note?: string }) =>
    apiFetch<CampDetail>(`/bouts/${id}/catchweight`, json("POST", body)),
  cancel: (id: string, reason: string) => apiFetch<CampDetail>(`/bouts/${id}/cancel`, json("POST", { reason })),
  corner: (id: string) => apiFetch<CornerCard>(`/bouts/${id}/corner-card`),
  rounds: (id: string) => apiFetch<RoundsResponse>(`/bouts/${id}/rounds`),
  saveRound: (id: string, roundNo: number, body: RoundInput) => apiFetch<CampRound>(`/bouts/${id}/rounds/${roundNo}`, json("PUT", body)),
  /** Allowed only for roundNo ≥ 2 that equals the last saved round + 1, bout WEIGHED_IN or COMPLETED; otherwise BOUT_ROUND_OUT_OF_RANGE. */
  roundAdvice: (id: string, roundNo: number, signal?: AbortSignal) =>
    apiFetch<{ suggestion: AiSuggestion }>(`/bouts/${id}/ai/round-advice/${roundNo}`, { method: "POST", signal }),
  /** GET bouts/:id/ai/suggestions?kind= (bouts.controller.ts:400). Read only: never calls Gemini. */
  aiHistory: (id: string, kind: AiSuggestionKind) =>
    apiFetch<{ suggestions: AiHistoryItem[] }>(withQuery(`/bouts/${id}/ai/suggestions`, { kind })),
  /** One decision per suggestion; a second one is 409 BOUT_AI_ALREADY_DECIDED. */
  decideAi: (id: string, suggestionId: string, body: AiDecision) =>
    apiFetch<{ suggestion: AiSuggestion }>(`/bouts/${id}/ai/suggestions/${suggestionId}`, json("PATCH", body)),
  prior: (fighterId: string, opponentName: string) => apiFetch<PriorContext>(withQuery("/bouts/prior-context", { fighterId, opponentName })),
  saveAnalysis: (id: string, body: AnalysisInput) => apiFetch<{ opponentAnalysis: Analysis; tacticsWithoutSessions: string[] }>(`/bouts/${id}/opponent-analysis`, json("PUT", body)),
  report: (id: string) => apiFetch<CampReport>(`/bouts/${id}/report`),
  review: (id: string, reviews: { tacticId: string; outcome: TacticOutcome; note?: string }[]) =>
    apiFetch<{ opponentAnalysis: Analysis; tacticsWithoutSessions: string[] }>(`/bouts/${id}/opponent-analysis/review`, json("PUT", { reviews })),
  /** `fighterId` narrows the scope-aware list (nestjs-api suspensions.model.ts:383, ListSuspensionsQuery). */
  suspensions: (query?: string | { cursor?: string; fighterId?: string }) => {
    const q = typeof query === "string" ? { cursor: query } : query;
    return apiFetch<CursorPage<Suspension>>(withQuery("/suspensions", { cursor: q?.cursor, fighterId: q?.fighterId, limit: 50 }));
  },
};
