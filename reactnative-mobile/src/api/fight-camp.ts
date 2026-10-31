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
export type RoundInput = {
  tacticMarks?: Record<string, TacticOutcome>; observationMarks?: Record<string, "SEEN" | "NOT_SEEN">;
  selfScore?: "WIN" | "LOSS" | "CLOSE" | null; knockdownsAgainst?: number;
  stunned?: boolean; bleeding?: boolean; fatigued?: boolean; note?: string | null;
};
export type CampRound = RoundInput & { id: string; roundNo: number };
export type RoundsResponse = {
  scheduledRounds: number | null; rounds: CampRound[];
  advice: null | {
    tactics: (CornerCard["tactics"][number] & { score: number; dropped: boolean; note?: "OPPONENT_MAY_HAVE_CHANGED" })[];
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
};
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
  prior: (fighterId: string, opponentName: string) => apiFetch<PriorContext>(withQuery("/bouts/prior-context", { fighterId, opponentName })),
  saveAnalysis: (id: string, body: AnalysisInput) => apiFetch<{ opponentAnalysis: Analysis; tacticsWithoutSessions: string[] }>(`/bouts/${id}/opponent-analysis`, json("PUT", body)),
  report: (id: string) => apiFetch<CampReport>(`/bouts/${id}/report`),
  review: (id: string, reviews: { tacticId: string; outcome: TacticOutcome; note?: string }[]) =>
    apiFetch<{ opponentAnalysis: Analysis; tacticsWithoutSessions: string[] }>(`/bouts/${id}/opponent-analysis/review`, json("PUT", { reviews })),
  suspensions: (cursor?: string) => apiFetch<CursorPage<Suspension>>(withQuery("/suspensions", { cursor, limit: 50 })),
};
