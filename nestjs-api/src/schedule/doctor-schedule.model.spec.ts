import { describe, expect, it } from 'vitest';
import { buildDoctorSchedule, doctorScheduleQuerySchema, type DoctorScheduleRows } from './doctor-schedule.model.js';

const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const STRANGER = '99999999-9999-4999-8999-999999999999';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const rows = (over: Partial<DoctorScheduleRows> = {}): DoctorScheduleRows => ({
  fighters: [{ id: F1, firstName: 'Dat', lastName: 'Nguyen' }, { id: F2, firstName: 'Anh', lastName: 'Le' }],
  followUps: [], clearances: [], bouts: [], suspensions: [], ...over,
});

describe('doctor schedule query', () => {
  it('accepts a week and refuses a reversed or too-wide window', () => {
    expect(doctorScheduleQuerySchema.safeParse({ from: '2026-11-09', to: '2026-11-15' }).success).toBe(true);
    expect(doctorScheduleQuerySchema.safeParse({ from: '2026-11-15', to: '2026-11-09' }).success).toBe(false);
    expect(doctorScheduleQuerySchema.safeParse({ from: '2026-11-01', to: '2027-01-15' }).success).toBe(false);
    expect(doctorScheduleQuerySchema.safeParse({ from: '2026-11-09', to: '2026-11-15', extra: 1 }).success).toBe(false);
  });
});

describe('buildDoctorSchedule', () => {
  it('maps all five kinds onto academy dates, inside the window only', () => {
    const items = buildDoctorSchedule(rows({
      followUps: [{ examinationId: id(1), fighterId: F2, followUpDate: '2026-11-10' }],
      // 2026-11-10T18:00Z is 11/11 01:00 in Vietnam: the expiry falls on 11/11.
      clearances: [{ id: id(2), fighterId: F1, clearanceType: 'TRAINING', validUntil: new Date('2026-11-10T18:00:00Z') }],
      bouts: [{ id: id(3), fighterId: F1, eventName: 'TEST API', weighInAt: '2026-11-13T01:00:00Z', boutAt: '2026-11-16T12:00:00Z' }],
      suspensions: [{ id: id(4), fighterId: F2, reason: 'KO', endsOn: '2026-11-11' }],
    }), '2026-11-09', '2026-11-15');
    expect(items.map((x) => [x.kind, x.date, x.fighterName])).toEqual([
      ['FOLLOW_UP', '2026-11-10', 'Anh Le'],
      ['SUSPENSION_END', '2026-11-11', 'Anh Le'],
      ['CLEARANCE_EXPIRY', '2026-11-11', 'Dat Nguyen'],
      ['WEIGH_IN', '2026-11-13', 'Dat Nguyen'],
    ]); // the bout on 16/11 is outside the window
    expect(items.find((x) => x.kind === 'WEIGH_IN')).toMatchObject({ at: '2026-11-13T01:00:00.000Z', label: 'TEST API', refId: id(3) });
    expect(items.find((x) => x.kind === 'CLEARANCE_EXPIRY')).toMatchObject({ at: null, label: 'TRAINING' });
  });

  it('merges suspension ends and follow-ups of one fighter on one day into one item', () => {
    const items = buildDoctorSchedule(rows({
      suspensions: [1, 2, 3].map((n) => ({ id: id(20 + n), fighterId: F1, reason: 'KO', endsOn: '2026-12-08' })),
      followUps: [1, 2].map((n) => ({ examinationId: id(30 + n), fighterId: F2, followUpDate: '2026-12-08' })),
      clearances: [
        { id: id(41), fighterId: F1, clearanceType: 'TRAINING', validUntil: '2026-12-08T05:00:00Z' },
        { id: id(42), fighterId: F1, clearanceType: 'COMPETITION', validUntil: '2026-12-08T05:00:00Z' },
      ],
    }), '2026-12-07', '2026-12-13');
    expect(items.map((x) => x.kind).sort()).toEqual(['CLEARANCE_EXPIRY', 'CLEARANCE_EXPIRY', 'FOLLOW_UP', 'SUSPENSION_END']);
  });

  it('drops rows of fighters the doctor is not assigned to', () => {
    const items = buildDoctorSchedule(rows({ suspensions: [{ id: id(5), fighterId: STRANGER, reason: 'KO', endsOn: '2026-11-11' }] }), '2026-11-09', '2026-11-15');
    expect(items).toEqual([]);
  });

  it('puts whole-day items before timed ones on the same day, timed ones by time', () => {
    const items = buildDoctorSchedule(rows({
      bouts: [
        { id: id(6), fighterId: F1, eventName: 'Late', weighInAt: '2026-11-12T10:00:00Z', boutAt: '2026-11-20T12:00:00Z' },
        { id: id(7), fighterId: F2, eventName: 'Early', weighInAt: '2026-11-12T01:00:00Z', boutAt: '2026-11-20T12:00:00Z' },
      ],
      suspensions: [{ id: id(8), fighterId: F1, reason: 'MEDICAL', endsOn: '2026-11-12' }],
    }), '2026-11-12', '2026-11-12');
    expect(items.map((x) => x.label)).toEqual(['MEDICAL', 'Early', 'Late']);
  });
});
