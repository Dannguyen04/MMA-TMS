import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { BOUT_PERMISSIONS } from '../bouts/bouts.constants.js';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { SUSPENSION_PERMISSIONS } from '../suspensions/suspensions.constants.js';
import { DoctorScheduleController } from './doctor-schedule.controller.js';
import { DoctorScheduleService } from './doctor-schedule.service.js';
import type { DoctorScheduleRepository } from './doctor-schedule.repo.js';

describe('DoctorScheduleController', () => {
  const handler = DoctorScheduleController.prototype.getSchedule;

  it('serves GET doctor/schedule for bout:get_all + suspension:read', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('doctor/schedule');
    expect(new Reflector().get(REQUIRED_PERMISSIONS, handler)).toEqual({ allOf: [BOUT_PERMISSIONS.GET_ALL, SUSPENSION_PERMISSIONS.READ] });
  });
});

describe('DoctorScheduleService', () => {
  const repo = () => ({
    findAssignedFighters: vi.fn(async () => [{ id: '11111111-1111-4111-8111-111111111111', firstName: 'Dat', lastName: 'Nguyen' }]),
    findRows: vi.fn(async () => ({ followUps: [], clearances: [], bouts: [], suspensions: [{ id: '00000000-0000-4000-8000-000000000001', fighterId: '11111111-1111-4111-8111-111111111111', reason: 'KO', endsOn: '2026-11-11' }] })),
  });

  it('refuses every role except DOCTOR', async () => {
    const r = repo();
    const service = new DoctorScheduleService(r as unknown as DoctorScheduleRepository);
    await expect(service.getSchedule({ id: 'u', role: 'COACH' } as never, { from: '2026-11-09', to: '2026-11-15' })).rejects.toMatchObject({ status: 403 });
    expect(r.findAssignedFighters).not.toHaveBeenCalled();
  });

  it('reads the assigned fighters once and asks for the academy-day instant window', async () => {
    const r = repo();
    const service = new DoctorScheduleService(r as unknown as DoctorScheduleRepository);
    const out = await service.getSchedule({ id: 'doc-user', role: 'DOCTOR' } as never, { from: '2026-11-09', to: '2026-11-15' });
    expect(r.findAssignedFighters).toHaveBeenCalledWith('doc-user', expect.any(Date));
    const [, from, to, fromInstant, toInstant] = r.findRows.mock.calls[0] as unknown as [string[], string, string, Date, Date];
    expect([from, to]).toEqual(['2026-11-09', '2026-11-15']);
    expect(fromInstant.toISOString()).toBe('2026-11-08T17:00:00.000Z'); // 09/11 00:00 in Vietnam
    expect(toInstant.toISOString()).toBe('2026-11-15T16:59:59.999Z'); // end of 15/11 in Vietnam
    expect(out.items).toEqual([expect.objectContaining({ kind: 'SUSPENSION_END', date: '2026-11-11', fighterName: 'Dat Nguyen' })]);
  });
});
