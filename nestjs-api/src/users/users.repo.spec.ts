import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { USER } from '../shared/types/user.role.js';
import { assignedFighterIdsQuery, UsersRepository } from './users.repo.js';

const userId = '516a01dc-f842-40e4-ae88-abca224921b7';

function compiled(statement: SQL) {
  const query = new PgDialect().sqlToQuery(statement);
  return { text: query.sql.replace(/\s+/g, ' '), params: query.params };
}

/** The roster rules behind `GET /fighters` (COACH) and `GET /doctors/:id/fighters` (DOCTOR). */
function expectRosterRules(
  text: string,
  profileTable: string,
  assignmentTable: string,
  assignmentColumn: string,
) {
  // findActiveCoachIdByUserId / findActiveDoctorIdByUserId: exactly one active, undeleted profile.
  expect(text).toContain(
    `FROM public.${profileTable} p WHERE p.user_id = $1 AND p.is_active = true AND p.deleted_at IS NULL LIMIT 2`,
  );
  expect(text).toContain('(SELECT count(*) FROM profile) = 1');
  // buildFighterFilterConditions without filters: active, undeleted Fighters.
  expect(text).toContain('f.deleted_at IS NULL AND f.is_active = true');
  // activeCoachAssignmentCondition / findFightersForDoctor: currently effective assignment.
  expect(text).toContain(`FROM public.${assignmentTable} a`);
  expect(text).toContain(`a.${assignmentColumn} IN (SELECT id FROM profile)`);
  expect(text).toContain('a.fighter_id = f.id');
  expect(text).toContain('a.starts_at <= now()');
  expect(text).toContain('(a.ends_at IS NULL OR a.ends_at > now())');
  expect(text).toContain('ORDER BY f.created_at DESC');
}

describe('assignedFighterIdsQuery', () => {
  it('applies the GET /fighters rules for a COACH', () => {
    const { text, params } = compiled(assignedFighterIdsQuery(userId, USER.COACH));

    expectRosterRules(text, 'coaches', 'coach_fighters', 'coach_id');
    expect(text).not.toContain('doctor');
    expect(params).toEqual([userId]);
  });

  it('applies the GET /doctors/:id/fighters rules for a DOCTOR', () => {
    const { text, params } = compiled(
      assignedFighterIdsQuery(userId, USER.DOCTOR),
    );

    expectRosterRules(text, 'sports_doctors', 'doctor_fighters', 'doctor_id');
    expect(text).not.toContain('coach');
    expect(params).toEqual([userId]);
  });
});

describe('UsersRepository.findAssignedFighterIds', () => {
  it('runs one statement and returns the ids in order', async () => {
    const execute = vi.fn().mockResolvedValue({
      rows: [{ id: 'f-2' }, { id: 'f-1' }],
    });
    const repository = new UsersRepository({ execute } as never);

    await expect(
      repository.findAssignedFighterIds(userId, USER.COACH),
    ).resolves.toEqual(['f-2', 'f-1']);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
