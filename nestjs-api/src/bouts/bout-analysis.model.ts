import { z } from 'zod';

// Proposed thresholds, pending specialist approval (R21/R22/R24).
export const INEFFECTIVE_STREAK_TO_DROP = 2;
export const NOT_SEEN_STREAK_TO_DEMOTE = 2;
export const KNOCKDOWN_WARN_TOTAL = 2;
export const STUNNED_STREAK_WARN = 2;

export const analysisIdSchema = z.string().regex(/^[a-z0-9_-]{1,20}$/);
export const tacticOutcomeSchema = z.enum([
  'EFFECTIVE',
  'INEFFECTIVE',
  'NOT_USED',
]);
const text = z.string().trim().min(1).max(300);
const evidenceText = z.string().trim().min(1);
export const opponentProfileSchema = z.strictObject({
  wins: z.number().int().nonnegative().optional(),
  losses: z.number().int().nonnegative().optional(),
  draws: z.number().int().nonnegative().optional(),
  stance: z.enum(['ORTHODOX', 'SOUTHPAW', 'SWITCH']).optional(),
  style: z.enum(['STRIKER', 'WRESTLER', 'GRAPPLER', 'ALL_ROUND']).optional(),
  heightCm: z.number().positive().optional(),
  reachCm: z.number().positive().optional(),
  source: z.string().optional(),
});
export const observationSchema = z
  .strictObject({
    id: analysisIdSchema,
    kind: z.enum(['STRENGTH', 'OPENING', 'HABIT']),
    text,
    evidenceUrl: z
      .url({ protocol: /^https?$/ })
      .nullable()
      .optional(),
    evidenceTime: z.string().nullable().optional(),
    evidenceNote: evidenceText.nullable().optional(),
    confidence: z.enum(['ONCE', 'REPEATED']),
  })
  .refine((o) => Boolean(o.evidenceUrl || o.evidenceNote), {
    message: 'Evidence URL or note is required',
  });
export const tacticSchema = z.strictObject({
  id: analysisIdSchema,
  text: z.string().trim().min(1),
  round: z.number().int().min(1).max(12).nullable(),
  observationIds: z.array(analysisIdSchema).default([]),
  sessionIds: z.array(z.uuid()),
  partnerBrief: z.string().nullable().optional(),
});
export const tacticReviewSchema = z.strictObject({
  outcome: tacticOutcomeSchema,
  note: z.string().max(300).nullable().optional(),
  auto: z.boolean().optional(),
});
export const opponentAnalysisInputSchema = z
  .strictObject({
    profile: opponentProfileSchema,
    observations: z.array(observationSchema).max(6),
    tactics: z.array(tacticSchema).max(5),
  })
  .refine(
    (a) => {
      const ids = [...a.observations, ...a.tactics].map((x) => x.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'Analysis IDs must be unique' },
  );
export type OpponentAnalysisInput = z.infer<typeof opponentAnalysisInputSchema>;
export const opponentAnalysisSchema = z.strictObject({
  profile: opponentProfileSchema.optional(),
  observations: z.array(observationSchema).optional(),
  tactics: z
    .array(tacticSchema.extend({ review: tacticReviewSchema.optional() }))
    .optional(),
  updatedAt: z.iso.datetime().optional(),
  updatedById: z.uuid().optional(),
});
export type OpponentAnalysis = z.infer<typeof opponentAnalysisSchema>;
export const opponentReviewInputSchema = z
  .strictObject({
    reviews: z
      .array(
        z.strictObject({
          tacticId: analysisIdSchema,
          outcome: tacticOutcomeSchema,
          note: z.string().max(300).optional(),
        }),
      )
      .max(5),
  })
  .refine(
    (v) => new Set(v.reviews.map((r) => r.tacticId)).size === v.reviews.length,
    { message: 'Review tactic IDs must be unique' },
  );
export type OpponentReviewInput = z.infer<typeof opponentReviewInputSchema>;
export const roundInputSchema = z.strictObject({
  tacticMarks: z.record(analysisIdSchema, tacticOutcomeSchema).optional(),
  observationMarks: z
    .record(analysisIdSchema, z.enum(['SEEN', 'NOT_SEEN']))
    .optional(),
  selfScore: z.enum(['WIN', 'LOSS', 'CLOSE']).nullable().optional(),
  knockdownsAgainst: z.number().int().min(0).max(10).optional(),
  stunned: z.boolean().optional(),
  bleeding: z.boolean().optional(),
  fatigued: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
});
export type RoundInput = z.infer<typeof roundInputSchema>;
export type AnalysisRound = RoundInput & { roundNo: number };
export const roundParamsSchema = z.strictObject({
  id: z.uuid(),
  roundNo: z.coerce.number().int().min(1).max(12),
});
export const priorContextQuerySchema = z.strictObject({
  fighterId: z.uuid(),
  opponentName: z.string().trim().min(1).max(200),
});

export function normalizeOpponentName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export const cornerTacticSchema = z.object({
  id: analysisIdSchema,
  text: z.string(),
  round: z.number().nullable(),
  partnerBrief: z.string().nullable(),
  trained: z.boolean(),
  basis: z.enum(['REPEATED', 'ONCE']),
});
export const cornerCardSchema = z.object({
  tactics: z.array(cornerTacticSchema),
  acuteLossFlag: z.boolean(),
});

export function buildCornerCard(
  analysis: OpponentAnalysis,
  roundsSoFar: readonly AnalysisRound[] = [],
  acuteLoss: { status: string } | null = null,
) {
  const repeated = new Set(
    (analysis.observations ?? [])
      .filter(
        (o) =>
          o.confidence === 'REPEATED' ||
          roundsSoFar.some((r) => r.observationMarks?.[o.id] === 'SEEN'),
      )
      .map((o) => o.id),
  );
  return {
    tactics: (analysis.tactics ?? [])
      .map((t) => ({
        id: t.id,
        text: t.text,
        round: t.round,
        partnerBrief: t.partnerBrief ?? null,
        trained: t.sessionIds.length > 0,
        basis: t.observationIds.some((id) => repeated.has(id))
          ? ('REPEATED' as const)
          : ('ONCE' as const),
      }))
      .sort(
        (a, b) =>
          Number(b.basis === 'REPEATED') - Number(a.basis === 'REPEATED') ||
          Number(b.trained) - Number(a.trained),
      ),
    acuteLossFlag: acuteLoss?.status === 'EXCEEDED',
  };
}

/** Missing tactic marks and NOT_USED neither add to nor reset an ineffective streak. */
function ineffectiveStreak(
  rounds: readonly AnalysisRound[],
  id: string,
): number {
  let count = 0;
  for (const r of [...rounds].reverse()) {
    const mark = r.tacticMarks?.[id];
    if (mark === 'EFFECTIVE') break;
    if (mark === 'INEFFECTIVE') count++;
  }
  return count;
}
function unseenStreak(rounds: readonly AnalysisRound[], id: string): number {
  let count = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    const r = rounds[i]!;
    if (r.observationMarks?.[id] !== 'NOT_SEEN') break;
    if (i < rounds.length - 1 && rounds[i + 1]!.roundNo !== r.roundNo + 1)
      break;
    count++;
  }
  return count;
}
export const roundAdviceSchema = z.object({
  tactics: z.array(
    cornerTacticSchema.extend({
      score: z.number(),
      dropped: z.boolean(),
      note: z.literal('OPPONENT_MAY_HAVE_CHANGED').optional(),
    }),
  ),
  standing: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('HARD_TO_WIN_ON_POINTS'),
      selfScored: z.literal(true),
    }),
    z.object({
      kind: z.literal('NEED_WINS'),
      needed: z.number(),
      remaining: z.number(),
      selfScored: z.literal(true),
    }),
    z.object({ kind: z.literal('AHEAD'), selfScored: z.literal(true) }),
  ]),
  safety: z
    .object({
      level: z.literal('RED'),
      reasons: z.array(z.enum(['KNOCKDOWNS', 'STUNNED_STREAK'])),
    })
    .nullable(),
});
export function buildRoundAdvice(
  analysis: OpponentAnalysis,
  inputRounds: readonly AnalysisRound[],
  scheduledRounds: number,
): z.infer<typeof roundAdviceSchema> {
  const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
  const tactics = analysis.tactics ?? [];
  const used = new Set(
    tactics
      .filter((t) =>
        rounds.some((r) =>
          ['EFFECTIVE', 'INEFFECTIVE'].includes(r.tacticMarks?.[t.id] ?? ''),
        ),
      )
      .map((t) => t.id),
  );
  const usedBasis = new Set(
    tactics.filter((t) => used.has(t.id)).flatMap((t) => t.observationIds),
  );
  const demoted = new Set(
    (analysis.observations ?? [])
      .filter((o) => unseenStreak(rounds, o.id) >= NOT_SEEN_STREAK_TO_DEMOTE)
      .map((o) => o.id),
  );
  const ranked = buildCornerCard(analysis, rounds)
    .tactics.map((t) => {
      const source = tactics.find((x) => x.id === t.id)!;
      const changed =
        source.observationIds.length > 0 &&
        source.observationIds.every((id) => demoted.has(id));
      return {
        ...t,
        score: rounds.reduce(
          (sum, r) =>
            sum +
            (r.tacticMarks?.[t.id] === 'EFFECTIVE'
              ? 1
              : r.tacticMarks?.[t.id] === 'INEFFECTIVE'
                ? -1
                : 0),
          0,
        ),
        dropped: ineffectiveStreak(rounds, t.id) >= INEFFECTIVE_STREAK_TO_DROP,
        ...(changed ? { note: 'OPPONENT_MAY_HAVE_CHANGED' as const } : {}),
        promote:
          !used.has(t.id) &&
          source.observationIds.some((id) => usedBasis.has(id)),
      };
    })
    .sort(
      (a, b) =>
        Number(a.dropped || Boolean(a.note)) -
          Number(b.dropped || Boolean(b.note)) ||
        b.score - a.score ||
        Number(b.promote) - Number(a.promote),
    );
  const w = rounds.filter((r) => r.selfScore === 'WIN').length;
  const l = rounds.filter((r) => r.selfScore === 'LOSS').length;
  const remaining = scheduledRounds - rounds.length;
  const needed = l - w + 1;
  const standing: z.infer<typeof roundAdviceSchema>['standing'] =
    l < w
      ? { kind: 'AHEAD', selfScored: true }
      : needed > remaining
        ? { kind: 'HARD_TO_WIN_ON_POINTS', selfScored: true }
        : { kind: 'NEED_WINS', needed, remaining, selfScored: true };
  const reasons: ('KNOCKDOWNS' | 'STUNNED_STREAK')[] = [];
  if (
    rounds.reduce((sum, r) => sum + (r.knockdownsAgainst ?? 0), 0) >=
    KNOCKDOWN_WARN_TOTAL
  )
    reasons.push('KNOCKDOWNS');
  let stunned = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (
      !rounds[i]!.stunned ||
      (i < rounds.length - 1 &&
        rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)
    )
      break;
    stunned++;
  }
  if (stunned >= STUNNED_STREAK_WARN) reasons.push('STUNNED_STREAK');
  return {
    tactics: ranked.map(({ promote: _promote, ...t }) => t),
    standing,
    safety: reasons.length ? { level: 'RED', reasons } : null,
  };
}

export const roundResponseSchema = z.object({
  id: z.uuid(),
  boutId: z.uuid(),
  roundNo: z.number(),
  tacticMarks: z.record(z.string(), tacticOutcomeSchema),
  observationMarks: z.record(z.string(), z.enum(['SEEN', 'NOT_SEEN'])),
  selfScore: z.enum(['WIN', 'LOSS', 'CLOSE']).nullable(),
  knockdownsAgainst: z.number(),
  stunned: z.boolean(),
  bleeding: z.boolean(),
  fatigued: z.boolean(),
  note: z.string().nullable(),
  recordedById: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const roundsResponseSchema = z.object({
  scheduledRounds: z.number().nullable(),
  rounds: z.array(roundResponseSchema),
  advice: roundAdviceSchema.nullable(),
});
export const fighterAnalysisSchema = z.object({
  tactics: z.array(
    tacticSchema.pick({
      id: true,
      text: true,
      round: true,
      partnerBrief: true,
      sessionIds: true,
    }),
  ),
});
export const analysisSessionsSchema = z.array(
  z.object({ id: z.uuid(), title: z.string(), scheduledAt: z.iso.datetime() }),
);
export function evaluateTactics(
  analysis: OpponentAnalysis,
  rounds: readonly AnalysisRound[],
) {
  return {
    tactics: (analysis.tactics ?? []).map((t) => {
      const effectiveRounds = rounds.filter(
        (r) => r.tacticMarks?.[t.id] === 'EFFECTIVE',
      ).length;
      const ineffectiveRounds = rounds.filter(
        (r) => r.tacticMarks?.[t.id] === 'INEFFECTIVE',
      ).length;
      const outcome: z.infer<typeof tacticOutcomeSchema> =
        ineffectiveRounds > effectiveRounds
          ? 'INEFFECTIVE'
          : effectiveRounds > 0
            ? 'EFFECTIVE'
            : 'NOT_USED';
      return {
        id: t.id,
        text: t.text,
        effectiveRounds,
        ineffectiveRounds,
        outcome,
      };
    }),
    observations: (analysis.observations ?? []).map((o) => {
      const marks = rounds
        .map((r) => r.observationMarks?.[o.id])
        .filter((m) => m !== undefined);
      return {
        id: o.id,
        text: o.text,
        notSeenInBout: marks.length > 0 && marks.every((m) => m === 'NOT_SEEN'),
      };
    }),
  };
}

export const improvementPointSchema = z.union([
  z.object({
    code: z.literal('TACTIC_INEFFECTIVE'),
    tacticId: analysisIdSchema,
    text: z.string(),
  }),
  z.object({ code: z.literal('ACUTE_LOSS_EXCEEDED') }),
  z.object({
    code: z.string().regex(/^FATIGUE_FROM_ROUND_([1-9]|1[0-2])$/),
    fromRound: z.number().int().min(1).max(12),
  }),
]);
export type ImprovementPoint = z.infer<typeof improvementPointSchema>;

export function buildImprovementPoints(
  analysis: OpponentAnalysis,
  inputRounds: readonly AnalysisRound[],
  acuteLoss: { status: string } | null,
): ImprovementPoint[] {
  const points: ImprovementPoint[] = [];
  // Without round records R25 only permits the acute-loss flag, even with saved reviews.
  if (inputRounds.length) {
    const evaluation = evaluateTactics(analysis, inputRounds);
    for (const t of analysis.tactics ?? []) {
      const outcome =
        t.review?.outcome ??
        evaluation.tactics.find((e) => e.id === t.id)!.outcome;
      if (outcome === 'INEFFECTIVE')
        points.push({
          code: 'TACTIC_INEFFECTIVE',
          tacticId: t.id,
          text: t.text,
        });
    }
  }
  if (acuteLoss?.status === 'EXCEEDED')
    points.push({ code: 'ACUTE_LOSS_EXCEEDED' });
  const rounds = [...inputRounds].sort((a, b) => a.roundNo - b.roundNo);
  let streak = 0;
  for (let i = rounds.length - 1; i >= 0; i--) {
    if (
      !rounds[i]!.fatigued ||
      (i < rounds.length - 1 &&
        rounds[i + 1]!.roundNo !== rounds[i]!.roundNo + 1)
    )
      break;
    streak++;
  }
  if (streak >= 2) {
    const fromRound = rounds[rounds.length - streak]!.roundNo;
    points.push({ code: `FATIGUE_FROM_ROUND_${fromRound}`, fromRound });
  }
  return points;
}

export const priorContextResponseSchema = z.object({
  improvementPoints: z.array(improvementPointSchema).nullable(),
  copyableAnalysis: z
    .object({
      boutId: z.uuid(),
      eventName: z.string(),
      opponentName: z.string().nullable(),
      opponentAnalysis: z.union([
        opponentAnalysisSchema,
        fighterAnalysisSchema,
      ]),
    })
    .nullable(),
});
