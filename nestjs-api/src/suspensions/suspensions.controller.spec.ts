import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { USER } from '../shared/types/user.role.js';
import { SUSPENSION_PERMISSIONS } from './suspensions.constants.js';
import { SuspensionsController } from './suspensions.controller.js';
import {
  ClearSuspensionDto,
  CreateSuspensionDto,
  EndSuspensionEarlyDto,
  ListSuspensionsQueryDto,
  SuspensionIdParamsDto,
} from './suspensions.dto.js';
import type { SuspensionsService } from './suspensions.service.js';

describe('SuspensionsController routes', () => {
  const reflector = new Reflector();
  const proto = SuspensionsController.prototype;

  const cases: [
    keyof SuspensionsController,
    RequestMethod,
    string,
    string,
  ][] = [
    [
      'listSuspensions',
      RequestMethod.GET,
      'suspensions',
      SUSPENSION_PERMISSIONS.READ,
    ],
    [
      'createSuspension',
      RequestMethod.POST,
      'suspensions',
      SUSPENSION_PERMISSIONS.CREATE,
    ],
    [
      'clearSuspension',
      RequestMethod.POST,
      'suspensions/:id/clear',
      SUSPENSION_PERMISSIONS.CLEAR,
    ],
    [
      'endSuspensionEarly',
      RequestMethod.POST,
      'suspensions/:id/end-early',
      SUSPENSION_PERMISSIONS.CLEAR,
    ],
  ];

  it.each(cases)(
    '%s uses %s %s and requires %s',
    (name, method, path, permission) => {
      const handler = proto[name] as (...args: never[]) => unknown;
      expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
      expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
      expect(reflector.get(REQUIRED_PERMISSIONS, handler)).toEqual({
        allOf: [permission],
      });
    },
  );

  it('exposes exactly the Round A endpoints plus end-early (T-050)', () => {
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (key) => key !== 'constructor' && key !== 'requireActor',
    );
    expect(handlers.sort()).toEqual(cases.map(([name]) => name).sort());
  });
});

describe('SuspensionsController DTO boundary and delegation', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates create, clear, query, and param DTOs with 422 on invalid input', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T03:00:00.000Z'));

    const validCreate = {
      fighterId: '10000000-0000-4000-8000-000000000001',
      reason: 'KO',
      days: 30,
    };

    expect(
      await appZodValidationPipe.transform(validCreate, {
        type: 'body',
        metatype: CreateSuspensionDto,
      }),
    ).toEqual(validCreate);

    for (const invalidBody of [
      { ...validCreate, extra: true },
      { ...validCreate, days: 0 },
      { ...validCreate, days: 366 },
      { ...validCreate, requiresClearance: false },
      { ...validCreate, startsOn: '2026-10-19' },
    ]) {
      await expect(
        Promise.resolve().then(() =>
          appZodValidationPipe.transform(invalidBody, {
            type: 'body',
            metatype: CreateSuspensionDto,
          }),
        ),
      ).rejects.toMatchObject({ status: 422 });
    }

    await expect(
      Promise.resolve().then(() =>
        appZodValidationPipe.transform(
          { clearanceNote: 'ab' },
          {
            type: 'body',
            metatype: ClearSuspensionDto,
          },
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });

    expect(
      await appZodValidationPipe.transform(
        { active: 'true', limit: '10' },
        {
          type: 'query',
          metatype: ListSuspensionsQueryDto,
        },
      ),
    ).toEqual({ active: true, limit: 10 });
  });

  it('T-050 C2, C3, C5, E10, E15, O4: create and end-early DTOs reject issuer and basis violations with 422', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T03:00:00.000Z'));
    const pipe = (value: unknown, metatype: typeof CreateSuspensionDto) =>
      Promise.resolve().then(() =>
        appZodValidationPipe.transform(value, { type: 'body', metatype }),
      );
    const medical = {
      fighterId: '10000000-0000-4000-8000-000000000001',
      reason: 'MEDICAL',
      days: 14,
    };
    const reference = 'Giải MMA Hà Nội 2026, QĐ 12/BTC ngày 31/10';
    await expect(
      pipe({ ...medical, issuedBy: 'ORGANIZER', issuerReference: reference }, CreateSuspensionDto),
    ).resolves.toMatchObject({ issuedBy: 'ORGANIZER' });
    for (const invalid of [
      { ...medical, issuedBy: 'ORGANIZER' }, // C2
      { ...medical, reason: 'KO', issuedBy: 'ORGANIZER', issuerReference: reference }, // C3
      { ...medical, issuedBy: 'CLUB', issuerReference: reference }, // C5
    ]) {
      await expect(pipe(invalid, CreateSuspensionDto)).rejects.toMatchObject({ status: 422 });
    }

    const examinationId = '70000000-0000-4000-8000-000000000001';
    const liftReference = 'CV 15/BTC ngày 04/11 gỡ đình chỉ';
    for (const invalid of [
      { note: 'ok', examinationId }, // E10
      { note: 'a'.repeat(501), examinationId }, // E10
      { note: 'Khám ổn, hết đau đầu' }, // E15, O4
      { note: 'Khám ổn, hết đau đầu', examinationId, liftReference }, // E15
    ]) {
      await expect(
        pipe(invalid, EndSuspensionEarlyDto as unknown as typeof CreateSuspensionDto),
      ).rejects.toMatchObject({ status: 422 });
    }
  });

  it('forwards authenticated actor and generated requestId, and rejects unauthenticated calls with 401', async () => {
    const listSuspensions = vi
      .fn()
      .mockResolvedValue({ data: [], hasNextPage: false, nextCursor: null });
    const createSuspension = vi.fn().mockResolvedValue({ id: 'susp-1' });
    const clearSuspension = vi.fn().mockResolvedValue({ id: 'susp-1' });
    const controller = new SuspensionsController({
      listSuspensions,
      createSuspension,
      clearSuspension,
    } as unknown as SuspensionsService);

    const actor = {
      id: 'coach-1',
      authSubject: 'sub-1',
      email: 'coach@example.invalid',
      role: USER.COACH,
    };

    await controller.listSuspensions(actor, { limit: 20 });
    expect(listSuspensions).toHaveBeenCalledWith(actor, { limit: 20 });

    await controller.createSuspension(actor, {
      fighterId: '10000000-0000-4000-8000-000000000001',
      reason: 'KO',
      days: 30,
    });
    expect(createSuspension).toHaveBeenCalledWith(
      actor,
      {
        fighterId: '10000000-0000-4000-8000-000000000001',
        reason: 'KO',
        days: 30,
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );

    const params = await appZodValidationPipe.transform(
      { id: '50000000-0000-4000-8000-000000000001' },
      { type: 'param', metatype: SuspensionIdParamsDto },
    );
    await controller.clearSuspension(actor, params, {
      clearanceNote: 'Cleared by coach',
    });
    expect(clearSuspension).toHaveBeenCalledWith(
      actor,
      '50000000-0000-4000-8000-000000000001',
      { clearanceNote: 'Cleared by coach' },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );

    await expect(
      controller.listSuspensions(undefined, { limit: 20 }),
    ).rejects.toMatchObject({ status: 401 });
  });
});
