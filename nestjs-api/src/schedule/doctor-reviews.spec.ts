import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { MEDICAL_PERMISSIONS } from '../medical/medical.constants.js';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { buildDoctorReviews, type DoctorReviewRow } from './doctor-reviews.model.js';
import { DoctorScheduleController } from './doctor-schedule.controller.js';
import type { DoctorScheduleRepository } from './doctor-schedule.repo.js';
import { DoctorScheduleService } from './doctor-schedule.service.js';

const F1 = '11111111-1111-4111-8111-111111111111';
const F2 = '22222222-2222-4222-8222-222222222222';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const row = (over: Partial<DoctorReviewRow>): DoctorReviewRow => ({
  id: id(1), fighterId: F1, reason: 'Đau đầu sau buổi đối kháng', requestedAt: new Date('2026-11-10T03:00:00Z'), requesterRole: 'COACH',
  coachFirst: 'Rafael', coachLast: 'Costa', doctorFirst: null, doctorLast: null, ...over,
});

describe('buildDoctorReviews', () => {
  const names = new Map([[F1, 'Kenji Morita'], [F2, 'Anh Le']]);
  it('names fighter and requester, oldest first, drops unassigned fighters', () => {
    const out = buildDoctorReviews([
      row({ id: id(2), fighterId: F2, requestedAt: '2026-11-11T01:00:00Z', coachFirst: null, coachLast: null, doctorFirst: 'Lan', doctorLast: 'Pham', requesterRole: 'DOCTOR' }),
      row({}),
      row({ id: id(3), fighterId: '99999999-9999-4999-8999-999999999999' }),
    ], names);
    expect(out.items.map((x) => [x.fighterName, x.requesterName, x.requestedAt])).toEqual([
      ['Kenji Morita', 'Rafael Costa', '2026-11-10T03:00:00.000Z'],
      ['Anh Le', 'Lan Pham', '2026-11-11T01:00:00.000Z'],
    ]);
    expect(out.truncated).toBe(false);
  });
  it('says when the list was cut', () => {
    const out = buildDoctorReviews([row({ id: id(1) }), row({ id: id(2) }), row({ id: id(3) })], names, 2);
    expect(out.items).toHaveLength(2);
    expect(out.truncated).toBe(true);
  });
});

describe('GET doctor/review-requests', () => {
  it('needs fighter.medical:read', () => {
    const handler = DoctorScheduleController.prototype.getOpenReviews;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('doctor/review-requests');
    expect(new Reflector().get(REQUIRED_PERMISSIONS, handler)).toEqual({ allOf: [MEDICAL_PERMISSIONS.READ] });
  });
  it('is DOCTOR only and reads the assigned fighters once', async () => {
    const repo = {
      findAssignedFighters: vi.fn(async () => [{ id: F1, firstName: 'Kenji', lastName: 'Morita' }]),
      findOpenReviewRequests: vi.fn(async () => [row({})]),
    };
    const service = new DoctorScheduleService(repo as unknown as DoctorScheduleRepository);
    await expect(service.getOpenReviews({ id: 'u', role: 'COACH' } as never)).rejects.toMatchObject({ status: 403 });
    const out = await service.getOpenReviews({ id: 'doc', role: 'DOCTOR' } as never);
    expect(repo.findOpenReviewRequests).toHaveBeenCalledWith([F1], 50);
    expect(out.items[0]).toMatchObject({ fighterName: 'Kenji Morita', requesterName: 'Rafael Costa' });
  });
});
