import { describe, expect, it } from 'vitest';
import {
  evaluateTactics,
  buildImprovementPoints,
  buildCornerCard,
  buildRoundAdvice,
  opponentAnalysisInputSchema,
  roundInputSchema,
  type OpponentAnalysis,
  type AnalysisRound,
} from './bout-analysis.model.js';

const observation = (id: string, confidence: 'ONCE' | 'REPEATED' = 'ONCE') => ({
  id,
  kind: 'OPENING' as const,
  text: id,
  evidenceNote: 'video',
  confidence,
});
const tactic = (
  id: string,
  observationIds = ['o1'],
  sessionIds: string[] = [],
) => ({
  id,
  text: id,
  observationIds,
  sessionIds,
  round: null,
});
const analysis: OpponentAnalysis = {
  observations: [observation('o1'), observation('o2', 'REPEATED')],
  tactics: [tactic('t1', ['o1'], ['session']), tactic('t2', ['o2'])],
};
const advice = (a: OpponentAnalysis, rounds: AnalysisRound[], scheduled = 3) =>
  buildRoundAdvice(a, rounds, scheduled);

describe('T-010 corner card and round advice', () => {
  it('R20 prioritizes repeated evidence before training, then training, keeping document order (AC1)', () => {
    const card = buildCornerCard(analysis);
    expect(card.tactics.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(card.tactics[0]).toMatchObject({
      trained: false,
      basis: 'REPEATED',
    });
    const a = {
      ...analysis,
      tactics: [
        tactic('t1', ['o2']),
        tactic('t2', ['o2'], ['session']),
        tactic('t3', ['o2']),
      ],
    };
    expect(buildCornerCard(a).tactics.map((t) => t.id)).toEqual([
      't2',
      't1',
      't3',
    ]);
    expect(
      buildCornerCard({ ...a, tactics: [{ ...tactic('t1'), round: 2 }] })
        .tactics[0]?.round,
    ).toBe(2);
    expect(buildCornerCard(a, [], { status: 'EXCEEDED' }).acuteLossFlag).toBe(
      true,
    );
    expect(buildCornerCard(a).acuteLossFlag).toBe(false);
  });

  it('R21 drops ineffective streaks and promotes unused tactics with shared evidence (AC2)', () => {
    const a = { ...analysis, tactics: [tactic('t1'), tactic('t2')] };
    const r = advice(a, [
      { roundNo: 1, tacticMarks: { t1: 'INEFFECTIVE' } },
      { roundNo: 2, tacticMarks: { t1: 'INEFFECTIVE' } },
    ]);
    expect(r.tactics.map((t) => t.id)).toEqual(['t2', 't1']);
    expect(r.tactics[1]).toMatchObject({ dropped: true, score: -2 });
    expect(
      advice(a, [
        { roundNo: 1, tacticMarks: { t1: 'INEFFECTIVE' } },
        { roundNo: 2, tacticMarks: { t1: 'EFFECTIVE' } },
      ]).tactics.find((t) => t.id === 't1'),
    ).toMatchObject({ score: 0, dropped: false });
    expect(
      advice(
        a,
        [
          { roundNo: 1, tacticMarks: { t1: 'INEFFECTIVE' } },
          { roundNo: 2 },
          { roundNo: 3, tacticMarks: { t1: 'INEFFECTIVE' } },
        ],
        5,
      ).tactics[1]?.dropped,
    ).toBe(true);
    const tied = {
      ...a,
      tactics: [tactic('t0', ['o2']), tactic('t1'), tactic('t2')],
    };
    expect(
      advice(tied, [
        { roundNo: 1, tacticMarks: { t1: 'EFFECTIVE' } },
        { roundNo: 2, tacticMarks: { t1: 'INEFFECTIVE' } },
      ]).tactics[0]?.id,
    ).toBe('t2');
  });

  it('R22 demotes only tactics whose entire evidence is unseen; SEEN upgrades confidence without mutation (AC3)', () => {
    const a = {
      ...analysis,
      tactics: [tactic('t3'), tactic('t4', ['o1', 'o2'])],
    };
    const before = JSON.stringify(a);
    const r = advice(a, [
      { roundNo: 1, observationMarks: { o1: 'NOT_SEEN' } },
      { roundNo: 2, observationMarks: { o1: 'NOT_SEEN' } },
    ]);
    expect(r.tactics.map((t) => t.id)).toEqual(['t4', 't3']);
    expect(r.tactics[1]?.note).toBe('OPPONENT_MAY_HAVE_CHANGED');
    expect(r.tactics[0]?.note).toBeUndefined();
    expect(
      buildCornerCard(a, [
        { roundNo: 1, observationMarks: { o1: 'SEEN' } },
      ]).tactics.find((t) => t.id === 't3')?.basis,
    ).toBe('REPEATED');
    expect(JSON.stringify(a)).toBe(before);
    expect(
      advice(
        a,
        [
          { roundNo: 1, observationMarks: { o1: 'NOT_SEEN' } },
          { roundNo: 3, observationMarks: { o1: 'NOT_SEEN' } },
        ],
        5,
      ).tactics.every((t) => !t.note),
    ).toBe(true);
  });

  it('R23 computes self-scored standing and counts unscored records as played (AC4)', () => {
    expect(
      advice({}, [
        { roundNo: 1, selfScore: 'LOSS' },
        { roundNo: 2, selfScore: 'LOSS' },
      ]).standing,
    ).toEqual({ kind: 'HARD_TO_WIN_ON_POINTS', selfScored: true });
    expect(
      advice({}, [
        { roundNo: 1, selfScore: 'LOSS' },
        { roundNo: 2, selfScore: 'WIN' },
      ]).standing,
    ).toEqual({ kind: 'NEED_WINS', needed: 1, remaining: 1, selfScored: true });
    expect(
      advice({}, [
        { roundNo: 1, selfScore: 'WIN' },
        { roundNo: 2, selfScore: 'WIN' },
        { roundNo: 3, selfScore: 'LOSS' },
      ]).standing,
    ).toEqual({ kind: 'AHEAD', selfScored: true });
    expect(
      advice({}, [{ roundNo: 1 }, { roundNo: 2, selfScore: 'CLOSE' }]).standing,
    ).toEqual({ kind: 'NEED_WINS', needed: 1, remaining: 1, selfScored: true });
  });

  it('R24 warns on cumulative knockdowns or the latest consecutive stunned rounds (AC5)', () => {
    expect(
      advice({}, [
        { roundNo: 1, knockdownsAgainst: 1 },
        { roundNo: 2, knockdownsAgainst: 1 },
      ]).safety,
    ).toEqual({ level: 'RED', reasons: ['KNOCKDOWNS'] });
    expect(
      advice({}, [{ roundNo: 1, knockdownsAgainst: 1 }]).safety,
    ).toBeNull();
    expect(
      advice({}, [
        { roundNo: 2, stunned: true },
        { roundNo: 3, stunned: true },
      ]).safety,
    ).toEqual({ level: 'RED', reasons: ['STUNNED_STREAK'] });
    expect(
      advice({}, [
        { roundNo: 1, stunned: true },
        { roundNo: 2 },
        { roundNo: 3, stunned: true },
      ]).safety,
    ).toBeNull();
    expect(
      advice({}, [
        { roundNo: 1, stunned: true },
        { roundNo: 3, stunned: true },
      ]).safety,
    ).toBeNull();
  });
});

describe('T-010 strict input validation (AC8)', () => {
  const input = {
    profile: {},
    observations: [observation('o1')],
    tactics: [tactic('t1')],
  };
  it('rejects a seventh observation, missing evidence and unsafe URL', () => {
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        observations: Array.from({ length: 7 }, (_, n) => observation(`o${n}`)),
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        observations: [{ ...observation('o1'), evidenceNote: null }],
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        observations: [
          { ...observation('o1'), evidenceUrl: 'javascript:alert(1)' },
        ],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate/invalid IDs, unknown keys, review injection and invalid enums', () => {
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        tactics: [tactic('o1')],
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        tactics: [tactic('T1')],
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({ ...input, review: {} }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        tactics: [{ ...tactic('t1'), review: { outcome: 'EFFECTIVE' } }],
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        profile: { stance: 'OTHER' },
      }).success,
    ).toBe(false);
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        tactics: Array.from({ length: 6 }, (_, n) => tactic(`t${n}`)),
      }).success,
    ).toBe(false);
    expect(
      roundInputSchema.safeParse({ stunned: true, unknown: 1 }).success,
    ).toBe(false);
    expect(roundInputSchema.safeParse({ knockdownsAgainst: 11 }).success).toBe(
      false,
    );
  });
  it('does not add undocumented 300-character caps to tactic text or partner briefs', () => {
    expect(
      opponentAnalysisInputSchema.safeParse({
        ...input,
        tactics: [
          {
            ...tactic('t1'),
            text: 'x'.repeat(301),
            partnerBrief: 'y'.repeat(301),
          },
        ],
      }).success,
    ).toBe(true);
  });
});

describe('T-010 report calculations', () => {
  it('R29 evaluates counts, ties, unused tactics and observation evidence without mutation (AC6)', () => {
    const a = {
      ...analysis,
      observations: [observation('o1'), observation('o2'), observation('o3')],
      tactics: [tactic('t1'), tactic('t2'), tactic('t3')],
    };
    const rounds: AnalysisRound[] = [
      {
        roundNo: 1,
        tacticMarks: { t1: 'EFFECTIVE', t2: 'EFFECTIVE' },
        observationMarks: { o1: 'NOT_SEEN', o2: 'SEEN' },
      },
      {
        roundNo: 2,
        tacticMarks: { t1: 'EFFECTIVE', t2: 'INEFFECTIVE' },
        observationMarks: { o1: 'NOT_SEEN', o2: 'NOT_SEEN' },
      },
      { roundNo: 3, tacticMarks: { t1: 'NOT_USED', t2: 'INEFFECTIVE' } },
    ];
    const before = structuredClone({ a, rounds });
    const evaluated = evaluateTactics(a, rounds);
    expect(evaluated.tactics).toEqual([
      {
        id: 't1',
        text: 't1',
        effectiveRounds: 2,
        ineffectiveRounds: 0,
        outcome: 'EFFECTIVE',
      },
      {
        id: 't2',
        text: 't2',
        effectiveRounds: 1,
        ineffectiveRounds: 2,
        outcome: 'INEFFECTIVE',
      },
      {
        id: 't3',
        text: 't3',
        effectiveRounds: 0,
        ineffectiveRounds: 0,
        outcome: 'NOT_USED',
      },
    ]);
    expect(evaluateTactics(a, rounds.slice(0, 2)).tactics[1]?.outcome).toBe(
      'EFFECTIVE',
    );
    expect(evaluated.observations.map((o) => o.notSeenInBout)).toEqual([
      true,
      false,
      false,
    ]);
    expect(evaluateTactics({}, [])).toEqual({ tactics: [], observations: [] });
    expect({ a, rounds }).toEqual(before);
  });

  it('R30 uses saved reviews before calculated outcomes and omits tactics without rounds (AC7, AC17)', () => {
    const a: OpponentAnalysis = {
      tactics: [
        { ...tactic('t1'), review: { outcome: 'INEFFECTIVE', auto: false } },
        { ...tactic('t2'), review: { outcome: 'EFFECTIVE', auto: true } },
        tactic('t3'),
      ],
    };
    const rounds: AnalysisRound[] = [
      {
        roundNo: 1,
        tacticMarks: { t1: 'EFFECTIVE', t2: 'INEFFECTIVE', t3: 'INEFFECTIVE' },
      },
    ];
    expect(buildImprovementPoints(a, rounds, null)).toEqual([
      { code: 'TACTIC_INEFFECTIVE', tacticId: 't1', text: 't1' },
      { code: 'TACTIC_INEFFECTIVE', tacticId: 't3', text: 't3' },
    ]);
    expect(buildImprovementPoints(a, [], { status: 'EXCEEDED' })).toEqual([
      { code: 'ACUTE_LOSS_EXCEEDED' },
    ]);
  });

  it('R30 detects only a consecutive fatigue suffix, sorting without mutation (AC7)', () => {
    const rounds = [4, 2, 3, 1].map((roundNo) => ({
      roundNo,
      fatigued: roundNo >= 2,
    }));
    const before = structuredClone(rounds);
    expect(buildImprovementPoints({}, rounds, { status: 'EXCEEDED' })).toEqual([
      { code: 'ACUTE_LOSS_EXCEEDED' },
      { code: 'FATIGUE_FROM_ROUND_2', fromRound: 2 },
    ]);
    expect(rounds).toEqual(before);
    for (const status of ['NO_DATA', 'WITHIN']) {
      expect(
        buildImprovementPoints(
          {},
          [
            { roundNo: 2, fatigued: true },
            { roundNo: 3 },
            { roundNo: 4, fatigued: true },
          ],
          { status },
        ),
      ).toEqual([]);
      expect(
        buildImprovementPoints(
          {},
          [
            { roundNo: 2, fatigued: true },
            { roundNo: 4, fatigued: true },
          ],
          { status },
        ),
      ).toEqual([]);
      expect(
        buildImprovementPoints(
          {},
          [
            { roundNo: 1, fatigued: true },
            { roundNo: 2, fatigued: true },
            { roundNo: 3 },
          ],
          { status },
        ),
      ).toEqual([]);
    }
  });
});


describe('T-037 next-round plans', () => {
  const plan = (over = {}) => ({ focusTacticIds: [], addedTactics: [], instructions: [], ...over });
  it('prioritizes coach order even when a focused tactic is dropped, without mutation', () => {
    const rounds: AnalysisRound[] = [
      { roundNo: 1, tacticMarks: { t1: 'INEFFECTIVE', t2: 'EFFECTIVE' } },
      { roundNo: 2, tacticMarks: { t1: 'INEFFECTIVE' }, nextRoundPlan: plan({ focusTacticIds: ['t1', 't2'] }) },
    ];
    const before = structuredClone(rounds);
    const result = advice(analysis, rounds);
    expect(result.tactics.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(result.tactics[0]).toMatchObject({ focus: true, dropped: true, addedRound: null });
    expect(result.nextRound.plan).toEqual(rounds[1]!.nextRoundPlan);
    expect(result.nextRound.roundNo).toBe(3);
    expect(rounds).toEqual(before);
  });
  it('merges added tactics from every round and uses only the latest plan', () => {
    const result = advice(analysis, [
      { roundNo: 2, nextRoundPlan: plan({ addedTactics: [{ id: 'new2', text: 'second', observationIds: [] }] }) },
      { roundNo: 1, observationMarks: { o1: 'SEEN' }, nextRoundPlan: plan({ focusTacticIds: ['new1'], addedTactics: [{ id: 'new1', text: 'new', observationIds: ['o1'] }] }) },
    ]);
    expect(result.tactics.find((t) => t.id === 'new1')).toMatchObject({ addedRound: 1, trained: false, basis: 'REPEATED', focus: false, round: null, partnerBrief: null });
    expect(result.tactics.find((t) => t.id === 'new2')?.addedRound).toBe(2);
    expect(advice(analysis, [{ roundNo: 1, nextRoundPlan: plan() }]).nextRound.plan).toBeNull();
    expect(advice(analysis, [{ roundNo: 1 }]).tactics.every((t) => !t.focus)).toBe(true);
  });
  it('suggests safety, newly dropped, up to two uses, then must-win in order', () => {
    const a = { ...analysis, tactics: [tactic('t1'), tactic('t2'), tactic('t3')] };
    const rounds: AnalysisRound[] = [
      { roundNo: 1, tacticMarks: { t1: 'INEFFECTIVE' }, stunned: true, selfScore: 'LOSS' },
      { roundNo: 2, tacticMarks: { t1: 'INEFFECTIVE' }, stunned: true, selfScore: 'WIN' },
    ];
    expect(advice(a, rounds).nextRound.suggested).toEqual([
      { code: 'SAFETY_CHECK' }, { code: 'STOP_TACTIC', tacticId: 't1' },
      { code: 'USE_TACTIC', tacticId: 't2' }, { code: 'USE_TACTIC', tacticId: 't3' },
      { code: 'MUST_WIN_ROUND' },
    ]);
    expect(advice(a, [...rounds, { roundNo: 3 }], 5).nextRound.suggested.some((i) => i.code === 'STOP_TACTIC')).toBe(false);
  });
  it('rechecks changed evidence after uses and reports hard-to-win points', () => {
    const result = advice(analysis, [
      { roundNo: 1, selfScore: 'LOSS', observationMarks: { o1: 'NOT_SEEN' } },
      { roundNo: 2, selfScore: 'LOSS', observationMarks: { o1: 'NOT_SEEN' } },
    ]);
    expect(result.nextRound.suggested).toEqual([
      { code: 'USE_TACTIC', tacticId: 't2' },
      { code: 'RECHECK_OPPONENT', tacticId: 't1' },
      { code: 'HARD_TO_WIN_ON_POINTS' },
    ]);
    expect(advice({}, [{ roundNo: 1, selfScore: 'WIN' }]).nextRound.suggested).toEqual([]);
  });
  it('caps suggestions at five in rule order', () => {
    const a = { tactics: Array.from({ length: 5 }, (_, i) => tactic('t' + i, [])) };
    const marks = Object.fromEntries(a.tactics.map((t) => [t.id, 'INEFFECTIVE' as const]));
    expect(advice(a, [{ roundNo: 1, tacticMarks: marks }, { roundNo: 2, tacticMarks: marks, knockdownsAgainst: 2 }]).nextRound.suggested).toEqual([
      { code: 'SAFETY_CHECK' }, ...a.tactics.slice(0, 4).map((t) => ({ code: 'STOP_TACTIC', tacticId: t.id })),
    ]);
  });
  it.each(['CUSTOM', 'USE_TACTIC', 'STOP_TACTIC', 'RECHECK_OPPONENT'])('requires instruction fields for %s', (code) => {
    expect(roundInputSchema.safeParse({ nextRoundPlan: { instructions: [{ code }] } }).success).toBe(false);
  });
  it('accepts trimmed custom text and enforces array, text and strict-key limits', () => {
    expect(roundInputSchema.parse({ nextRoundPlan: { instructions: [{ code: 'CUSTOM', text: '  act  ' }] } }).nextRoundPlan?.instructions[0]?.text).toBe('act');
    for (const nextRoundPlan of [
      { focusTacticIds: ['t1', 't2', 't3'] },
      { addedTactics: Array.from({ length: 3 }, (_, i) => ({ id: 't' + i, text: 'new' })) },
      { addedTactics: [{ id: 't1', text: 'x'.repeat(141) }] },
      { addedTactics: [{ id: 't1', text: 'new', observationIds: ['o1', 'o2', 'o3', 'o4'] }] },
      { instructions: Array.from({ length: 4 }, () => ({ code: 'SAFETY_CHECK' })) },
      { instructions: [{ code: 'CUSTOM', text: ' ' }] },
      { unknown: true },
    ]) expect(roundInputSchema.safeParse({ nextRoundPlan }).success).toBe(false);
  });
});
