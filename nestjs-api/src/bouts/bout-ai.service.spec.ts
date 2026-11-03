import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  BoutAiSuggestionRow,
  BoutRow,
  BoutRoundRow,
} from '../database/schema.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import { BoutsService } from './bouts.service.js';
import { BoutsRepository } from './bouts.repo.js';
import { BoutAiClient } from './bout-ai.client.js';
import { SuspensionEffects } from '../suspensions/suspension.effects.js';
import { SuspensionsRepository } from '../suspensions/suspensions.repo.js';

const id = '40000000-0000-4000-8000-000000000001';
const suggestionId = '90000000-0000-4000-8000-000000000001';
const actor: AuthenticatedUser = {
  id: '20000000-0000-4000-8000-000000000001',
  authSubject: 'subject',
  email: 'coach@test.invalid',
  role: USER.COACH,
};
const obs = {
  id: 'real-observation',
  kind: 'HABIT' as const,
  text: 'Trần Bình hạ tay sau jab',
  confidence: 'ONCE' as const,
  evidenceNote: 'Nguyễn An quan sát, Lê Huấn xác nhận',
};
const tactic = {
  id: 'real-tactic',
  text: 'Jab rồi bước ngang',
  round: null,
  observationIds: [obs.id],
  sessionIds: ['80000000-0000-4000-8000-000000000001'],
};
const good = {
  id: 'draft',
  text: 'Bước ra ngoài sau jab',
  round: null,
  observationIds: ['o1'],
  reason: 'Đối thủ hạ tay sau jab',
};
function payload(data: unknown) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] } }],
    }),
  );
}

let bout: BoutRow;
let rounds: BoutRoundRow[];
let stored: BoutAiSuggestionRow[];
let fetchMock: ReturnType<typeof vi.fn>;
let service: BoutsService;
let repo: ReturnType<typeof harness>;
const execute = vi.fn().mockResolvedValue(undefined);
function harness() {
  return {
    findBoutById: vi.fn(async () => bout),
    lockBoutById: vi.fn(async () => bout),
    isCoachAssignedToFighter: vi.fn(async () => true),
    isDoctorAssignedToFighter: vi.fn(async () => true),
    listRounds: vi.fn(async () => rounds),
    transaction: vi.fn(async (work: (tx: Transaction) => Promise<unknown>) =>
      work({ execute } as unknown as Transaction),
    ),
    aiParticipantContext: vi.fn(async () => ({
      fighter: {
        firstName: 'Nguyễn',
        lastName: 'An',
        stance: 'ORTHODOX',
        reachCm: 175,
      },
      coach: { firstName: 'Lê', lastName: 'Huấn' },
    })),
    findAiCache: vi.fn(async (key: Partial<BoutAiSuggestionRow>) =>
      stored.find(
        (row) =>
          row.status === 'OK' &&
          row.inputHash === key.inputHash &&
          row.kind === key.kind &&
          row.model === key.model &&
          row.roundNo === key.roundNo,
      ),
    ),
    insertAiSuggestion: vi.fn(async (values: Partial<BoutAiSuggestionRow>) => {
      const row = {
        id: suggestionId,
        decision: null,
        acceptedItemIds: [],
        decidedAt: null,
        createdAt: new Date(),
        ...values,
      } as BoutAiSuggestionRow;
      stored.push(row);
      return row;
    }),
    listAiSuggestions: vi.fn(async () => [...stored].reverse()),
    lockAiSuggestion: vi.fn(async (boutId: string, sid: string) =>
      stored.find((row) => row.boutId === boutId && row.id === sid),
    ),
    decideAiSuggestion: vi.fn(
      async (sid: string, values: Partial<BoutAiSuggestionRow>) => {
        const row = stored.find((row) => row.id === sid);
        if (!row) return undefined;
        Object.assign(row, values);
        return row;
      },
    ),
  };
}
beforeEach(() => {
  stored = [];
  rounds = [];
  bout = {
    id,
    fighterId: '10000000-0000-4000-8000-000000000001',
    coachId: '30000000-0000-4000-8000-000000000001',
    opponentName: 'Trần Bình',
    status: 'WEIGHED_IN',
    scheduledRounds: 3,
    weightClassCode: '60',
    opponentAnalysis: { observations: [obs], tactics: [tactic] },
  } as BoutRow;
  repo = harness();
  fetchMock = vi
    .fn()
    .mockImplementation(() => Promise.resolve(payload({ tactics: [good] })));
  vi.stubGlobal('fetch', fetchMock);
  service = new BoutsService(
    repo as unknown as BoutsRepository,
    {} as SuspensionsRepository,
    new SuspensionEffects(),
    new BoutAiClient(new ConfigService({ GEMINI_API_KEY: 'test-key' })),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('T-038 suggestion service', () => {
  it('filters invalid evidence, saves exactly one OK row and reuses the cache', async () => {
    fetchMock.mockResolvedValue(
      payload({ tactics: [good, { ...good, observationIds: ['unknown'] }] }),
    );
    const first = await service.suggestAiTactics(actor, id, 'request');
    expect(first.suggestion).toMatchObject({
      status: 'OK',
      cached: false,
      output: { tactics: [{ id: 'ai1', observationIds: [obs.id] }] },
    });
    expect(stored[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(execute).toHaveBeenCalled();
    expect(
      (await service.suggestAiTactics(actor, id, 'request2')).suggestion,
    ).toMatchObject({ id: suggestionId, cached: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stored).toHaveLength(1);
  });
  it('never sends person names, opponentName, session IDs or UUIDs in the actual fetch body', async () => {
    await service.suggestAiTactics(actor, id, 'request');
    const body = fetchMock.mock.calls[0][1].body as string;
    for (const name of [
      'Nguyễn',
      'An',
      'Trần Bình',
      'Lê',
      'Huấn',
      'opponentName',
      'real-tactic',
      'real-observation',
    ])
      expect(body).not.toContain(name);
    expect(body).not.toMatch(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    );
  });
  it('stores EMPTY if every tactic has invalid evidence or round', async () => {
    fetchMock.mockResolvedValue(
      payload({
        tactics: [
          { ...good, observationIds: ['wrong'] },
          { ...good, round: 4 },
        ],
      }),
    );
    expect(
      (await service.suggestAiTactics(actor, id, 'request')).suggestion,
    ).toMatchObject({ status: 'FAILED', errorCode: 'EMPTY' });
    expect(stored).toHaveLength(1);
  });
  it('anonymizes round notes and only sends the round input fields plus T-037 advice', async () => {
    rounds = [
      {
        roundNo: 1,
        note: `Nguyễn An tập cùng Trần Bình và Lê Huấn ${id}`,
        recordedById: actor.id,
        boutId: id,
      },
    ] as BoutRoundRow[];
    fetchMock.mockResolvedValue(
      payload({ instructions: [{ text: 'Giữ tay cao' }] }),
    );
    await service.suggestAiRoundAdvice(actor, id, 2, 'r');
    const body = fetchMock.mock.calls[0][1].body as string;
    for (const value of [
      'Nguyễn',
      'Trần Bình',
      'Lê Huấn',
      'recordedById',
      'boutId',
      'opponentName',
    ])
      expect(body).not.toContain(value);
    expect(body).not.toMatch(
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
    );
    expect(body).toContain('nextRound');
    expect(body).toContain('suggested');
  });
  it('changes the input hash when the professional context changes', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(payload({ tactics: [good] })),
    );
    await service.suggestAiTactics(actor, id, 'r');
    bout.opponentAnalysis.observations = [{ ...obs, confidence: 'REPEATED' }];
    await service.suggestAiTactics(actor, id, 'r');
    expect(stored).toHaveLength(2);
    expect(stored[0].inputHash).not.toBe(stored[1].inputHash);
  });
  it('does not cache FAILED rows', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(payload({ tactics: [] })),
    );
    await service.suggestAiTactics(actor, id, 'r1');
    await service.suggestAiTactics(actor, id, 'r2');
    expect(stored).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects missing observations before fetching or writing', async () => {
    bout.opponentAnalysis.observations = [];
    await expect(
      service.suggestAiTactics(actor, id, 'request'),
    ).rejects.toMatchObject({
      status: 422,
      response: { code: 'BOUT_AI_NO_OBSERVATIONS' },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(stored).toHaveLength(0);
  });
  it.each([1, 3, 4, 2.5])(
    'rejects upcoming round %s when the last recorded round is 1',
    async (roundNo) => {
      rounds = [{ roundNo: 1 }] as BoutRoundRow[];
      await expect(
        service.suggestAiRoundAdvice(actor, id, roundNo, 'r'),
      ).rejects.toMatchObject({
        status: 422,
        response: { code: 'BOUT_ROUND_OUT_OF_RANGE' },
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored).toHaveLength(0);
    },
  );
  it('requires a previous round and corner status', async () => {
    await expect(
      service.suggestAiRoundAdvice(actor, id, 2, 'r'),
    ).rejects.toMatchObject({ status: 422 });
    rounds = [{ roundNo: 1 }] as BoutRoundRow[];
    bout.status = 'CAMP';
    await expect(
      service.suggestAiRoundAdvice(actor, id, 2, 'r'),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'BOUT_INVALID_TRANSITION' },
    });
  });
  it('keeps RED even when the 12-second Gemini call times out; T-037 remains available', async () => {
    vi.useFakeTimers();
    rounds = [
      {
        roundNo: 1,
        knockdownsAgainst: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as BoutRoundRow[];
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = service.suggestAiRoundAdvice(actor, id, 2, 'request');
    await vi.advanceTimersByTimeAsync(12_000);
    expect((await pending).suggestion).toMatchObject({
      status: 'FAILED',
      errorCode: 'TIMEOUT',
      output: { safety: 'RED' },
    });
    expect(stored).toHaveLength(1);
    expect(
      (await service.getRounds(actor, id)).advice?.nextRound.suggested,
    ).toContainEqual({ code: 'SAFETY_CHECK' });
  });
  it('retains RED for success and strips only unknown tacticId', async () => {
    rounds = [{ roundNo: 1, knockdownsAgainst: 2 }] as BoutRoundRow[];
    fetchMock.mockResolvedValue(
      payload({
        instructions: [
          { text: 'Giữ khoảng cách', tacticId: 'unknown' },
          { text: 'Jab rồi ra góc', tacticId: 't1' },
        ],
      }),
    );
    const result = await service.suggestAiRoundAdvice(actor, id, 2, 'r');
    expect(result.suggestion.output).toEqual({
      safety: 'RED',
      instructions: [
        { id: 'ai1', text: 'Giữ khoảng cách' },
        { id: 'ai2', text: 'Jab rồi ra góc', tacticId: tactic.id },
      ],
    });
  });
  it('includes tactics added in preceding rounds', async () => {
    rounds = [
      {
        roundNo: 1,
        nextRoundPlan: {
          addedTactics: [
            { id: 'added', text: 'Lùi rồi jab', observationIds: [obs.id] },
          ],
          focusTacticIds: ['added'],
          instructions: [],
        },
      },
    ] as BoutRoundRow[];
    fetchMock.mockResolvedValue(
      payload({ instructions: [{ text: 'Lùi rồi jab', tacticId: 't1' }] }),
    );
    expect(
      (await service.suggestAiRoundAdvice(actor, id, 2, 'r')).suggestion.output,
    ).toMatchObject({ instructions: [{ tacticId: 'added' }] });
  });
  it('stores a one-time decision and rejects unknown item IDs or a second decision', async () => {
    await service.suggestAiTactics(actor, id, 'r');
    await expect(
      service.decideAiSuggestion(
        actor,
        id,
        suggestionId,
        { decision: 'ACCEPTED', acceptedItemIds: ['unknown'] },
        'r',
      ),
    ).rejects.toMatchObject({ status: 422 });
    await service.decideAiSuggestion(
      actor,
      id,
      suggestionId,
      { decision: 'PARTIAL', acceptedItemIds: ['ai1'] },
      'r',
    );
    expect(stored[0]).toMatchObject({
      decision: 'PARTIAL',
      acceptedItemIds: ['ai1'],
      decidedAt: expect.any(Date),
    });
    await expect(
      service.decideAiSuggestion(
        actor,
        id,
        suggestionId,
        { decision: 'REJECTED', acceptedItemIds: [] },
        'r',
      ),
    ).rejects.toMatchObject({
      status: 409,
      response: { code: 'BOUT_AI_ALREADY_DECIDED' },
    });
  });
  it('does not decide a suggestion belonging to another bout', async () => {
    await service.suggestAiTactics(actor, id, 'r');
    stored[0].boutId = 'another';
    await expect(
      service.decideAiSuggestion(
        actor,
        id,
        suggestionId,
        { decision: 'REJECTED', acceptedItemIds: [] },
        'r',
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it('returns persisted history including the coach decision', async () => {
    await service.suggestAiTactics(actor, id, 'r');
    expect(
      (await service.getAiSuggestions(actor, id, 'PRE_BOUT_TACTICS'))
        .suggestions[0],
    ).toMatchObject({ id: suggestionId, decision: null });
    expect(repo.listAiSuggestions).toHaveBeenCalledWith(id, 'PRE_BOUT_TACTICS');
  });
  it('validates video URLs and caches video observations', async () => {
    await expect(
      service.suggestAiVideo(
        actor,
        id,
        { url: 'https://evil.test/file.mp4', who: 'góc đỏ' },
        'r',
      ),
    ).rejects.toMatchObject({ status: 422 });
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        payload({
          observations: [
            {
              kind: 'HABIT',
              text: 'Hạ tay',
              time: '00:30',
              confidence: 'ONCE',
            },
          ],
        }),
      ),
    );
    const input = { url: 'https://youtu.be/abcdef123', who: 'góc đỏ' };
    expect(
      (await service.suggestAiVideo(actor, id, input, 'r')).suggestion,
    ).toMatchObject({
      kind: 'VIDEO_OBSERVATIONS',
      output: { observations: [{ id: 'ai1' }] },
    });
    expect(
      (await service.suggestAiVideo(actor, id, input, 'r')).suggestion.cached,
    ).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each(['tactics', 'round', 'video'])(
    'returns a persisted NOT_CONFIGURED result for %s',
    async (kind) => {
      rounds = [{ roundNo: 1 }] as BoutRoundRow[];
      service = new BoutsService(
        repo as unknown as BoutsRepository,
        {} as SuspensionsRepository,
        new SuspensionEffects(),
        new BoutAiClient(new ConfigService({ GEMINI_API_KEY: '' })),
      );
      const result =
        kind === 'tactics'
          ? await service.suggestAiTactics(actor, id, 'r')
          : kind === 'round'
            ? await service.suggestAiRoundAdvice(actor, id, 2, 'r')
            : await service.suggestAiVideo(
                actor,
                id,
                { url: 'https://youtu.be/abcdef123', who: 'góc đỏ' },
                'r',
              );
      expect(result.suggestion).toMatchObject({
        status: 'FAILED',
        errorCode: 'NOT_CONFIGURED',
      });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored).toHaveLength(1);
    },
  );
  it.each(['tactics', 'round', 'video', 'history', 'decision'])(
    'forbids FIGHTER for %s even with endpoint permissions',
    async (kind) => {
      const fighter = { ...actor, role: USER.FIGHTER };
      const run = () =>
        kind === 'tactics'
          ? service.suggestAiTactics(fighter, id, 'r')
          : kind === 'round'
            ? service.suggestAiRoundAdvice(fighter, id, 2, 'r')
            : kind === 'video'
              ? service.suggestAiVideo(
                  fighter,
                  id,
                  { url: 'https://youtu.be/abcdef123', who: 'góc đỏ' },
                  'r',
                )
              : kind === 'history'
                ? service.getAiSuggestions(fighter, id)
                : service.decideAiSuggestion(
                    fighter,
                    id,
                    suggestionId,
                    { decision: 'REJECTED', acceptedItemIds: [] },
                    'r',
                  );
      await expect(run()).rejects.toMatchObject({ status: 403 });
      expect(fetchMock).not.toHaveBeenCalled();
      expect(stored).toHaveLength(0);
    },
  );
  it('forbids unassigned coaches and final statuses for pre-bout calls', async () => {
    repo.isCoachAssignedToFighter.mockResolvedValue(false);
    await expect(
      service.suggestAiTactics(actor, id, 'r'),
    ).rejects.toMatchObject({ status: 403 });
    repo.isCoachAssignedToFighter.mockResolvedValue(true);
    bout.status = 'COMPLETED';
    await expect(
      service.suggestAiTactics(actor, id, 'r'),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.suggestAiVideo(
        actor,
        id,
        { url: 'https://youtu.be/abcdef123', who: 'góc đỏ' },
        'r',
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
