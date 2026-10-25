import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { USER } from '../shared/types/user.role.js';
import { SUSPENSION_PERMISSIONS } from '../suspensions/suspensions.constants.js';
import {
  ApplySuspensionConflictsDto,
  SuspensionIdParamsDto,
} from './training.dto.js';
import { TRAINING_PERMISSIONS } from './training.model.js';
import { TrainingSuspensionConflictsController } from './training-suspension-conflicts.controller.js';
import type { TrainingSuspensionConflictsService } from './training-suspension-conflicts.service.js';

describe('TrainingSuspensionConflictsController routes and permissions', () => {
  const reflector = new Reflector();
  const proto = TrainingSuspensionConflictsController.prototype;

  const cases: [
    keyof TrainingSuspensionConflictsController,
    RequestMethod,
    string,
    string,
  ][] = [
    [
      'getConflicts',
      RequestMethod.GET,
      'suspensions/:id/conflicts',
      SUSPENSION_PERMISSIONS.READ,
    ],
    [
      'applyConflicts',
      RequestMethod.POST,
      'suspensions/:id/conflicts/apply',
      TRAINING_PERMISSIONS.SESSION_UPDATE,
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

  it('exposes exactly the two Round C conflict endpoints', () => {
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (key) => key !== 'constructor',
    );
    expect(handlers.sort()).toEqual(cases.map(([name]) => name).sort());
  });
});

describe('TrainingSuspensionConflictsController DTO boundary and delegation', () => {
  it('validates params and apply body with 422 on invalid input', async () => {
    const validSessionId = '10000000-0000-4000-8000-000000000001';

    expect(
      await appZodValidationPipe.transform(
        { sessionIds: [validSessionId] },
        { type: 'body', metatype: ApplySuspensionConflictsDto },
      ),
    ).toEqual({ sessionIds: [validSessionId] });

    for (const invalidBody of [
      {},
      { sessionIds: ['not-a-uuid'] },
      { sessionIds: [validSessionId, validSessionId] },
      { sessionIds: [validSessionId], extra: true },
    ]) {
      await expect(
        Promise.resolve().then(() =>
          appZodValidationPipe.transform(invalidBody, {
            type: 'body',
            metatype: ApplySuspensionConflictsDto,
          }),
        ),
      ).rejects.toMatchObject({ status: 422 });
    }

    await expect(
      Promise.resolve().then(() =>
        appZodValidationPipe.transform(
          { id: 'invalid-uuid' },
          { type: 'param', metatype: SuspensionIdParamsDto },
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('forwards authenticated actor, params, and body to service and rejects unauthenticated calls with 401', async () => {
    const getConflicts = vi.fn().mockResolvedValue([]);
    const applyConflicts = vi.fn().mockResolvedValue([]);
    const controller = new TrainingSuspensionConflictsController({
      getConflicts,
      applyConflicts,
    } as unknown as TrainingSuspensionConflictsService);

    const actor = {
      id: 'coach-1',
      authSubject: 'sub-1',
      email: 'coach@example.invalid',
      role: USER.COACH,
    };
    const suspensionId = '50000000-0000-4000-8000-000000000001';
    const sessionId = '60000000-0000-4000-8000-000000000001';

    await controller.getConflicts(actor, { id: suspensionId });
    expect(getConflicts).toHaveBeenCalledWith(actor, suspensionId);

    await controller.applyConflicts(
      actor,
      { id: suspensionId },
      { sessionIds: [sessionId] },
    );
    expect(applyConflicts).toHaveBeenCalledWith(actor, suspensionId, {
      sessionIds: [sessionId],
    });

    await expect(
      controller.getConflicts(undefined, { id: suspensionId }),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      controller.applyConflicts(
        undefined,
        { id: suspensionId },
        { sessionIds: [sessionId] },
      ),
    ).rejects.toMatchObject({ status: 401 });
  });
});
