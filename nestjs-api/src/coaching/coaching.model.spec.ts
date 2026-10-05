import { describe, expect, it } from 'vitest';
import { createAssignmentBodySchema } from './coaching.model.js';

const coachId = '59d6ba46-32f2-4e67-b486-e966b2064328';
const fighterId = '516a01dc-f842-40e4-ae88-abca224921b7';

describe('createAssignmentBodySchema', () => {
  it.each(['base', 'build', 'fight_camp', 'taper', 'rehab', 'maintenance'] as const)(
    'accepts valid assignment with phase %s',
    (phase) => {
      const res = createAssignmentBodySchema.safeParse({
        coachId,
        fighterId,
        title: 'Morning Drills',
        phase,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.phase).toBe(phase);
        expect(res.data.title).toBe('Morning Drills');
      }
    },
  );

  it.each([
    ['missing phase', { coachId, fighterId, title: 'Session' }],
    ['null phase', { coachId, fighterId, title: 'Session', phase: null }],
    ['uppercase phase BASE', { coachId, fighterId, title: 'Session', phase: 'BASE' }],
    ['empty string phase', { coachId, fighterId, title: 'Session', phase: '' }],
    ['number phase', { coachId, fighterId, title: 'Session', phase: 1 }],
    ['unknown phase', { coachId, fighterId, title: 'Session', phase: 'offseason' }],
  ])('rejects %s with path phase', (_label, body) => {
    const res = createAssignmentBodySchema.safeParse(body);
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((issue) => issue.path.join('.'));
      expect(paths).toContain('phase');
    }
  });

  it('rejects unknown body keys (strict object)', () => {
    const res = createAssignmentBodySchema.safeParse({
      coachId,
      fighterId,
      title: 'Session',
      phase: 'base',
      extraKey: 'unexpected',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].code).toBe('unrecognized_keys');
    }
  });

  it('rejects sessionType outside enum', () => {
    const res = createAssignmentBodySchema.safeParse({
      coachId,
      fighterId,
      title: 'Session',
      phase: 'base',
      sessionType: 'INVALID_TYPE',
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join('.'));
      expect(paths).toContain('sessionType');
    }
  });

  it('allows omitting sessionType', () => {
    const res = createAssignmentBodySchema.safeParse({
      coachId,
      fighterId,
      title: 'Session',
      phase: 'base',
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.sessionType).toBeUndefined();
    }
  });
});
