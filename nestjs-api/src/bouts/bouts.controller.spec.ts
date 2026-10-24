import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { BOUT_PERMISSIONS } from './bouts.constants.js';
import { BoutsController } from './bouts.controller.js';

describe('BoutsController routes', () => {
  const reflector = new Reflector();
  const proto = BoutsController.prototype;

  const cases: [keyof BoutsController, RequestMethod, string, string][] = [
    [
      'listRulesets',
      RequestMethod.GET,
      'competition-rulesets',
      BOUT_PERMISSIONS.RULESET_READ,
    ],
    ['listBouts', RequestMethod.GET, 'bouts', BOUT_PERMISSIONS.GET_ALL],
    ['createBout', RequestMethod.POST, 'bouts', BOUT_PERMISSIONS.CREATE],
    [
      'getPriorContext',
      RequestMethod.GET,
      'bouts/prior-context',
      BOUT_PERMISSIONS.GET_ALL,
    ],
    [
      'putOpponentAnalysis',
      RequestMethod.PUT,
      'bouts/:id/opponent-analysis',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'putOpponentReview',
      RequestMethod.PUT,
      'bouts/:id/opponent-analysis/review',
      BOUT_PERMISSIONS.RESULT,
    ],
    [
      'putRound',
      RequestMethod.PUT,
      'bouts/:id/rounds/:roundNo',
      BOUT_PERMISSIONS.UPDATE,
    ],
    ['getRounds', RequestMethod.GET, 'bouts/:id/rounds', BOUT_PERMISSIONS.READ],
    [
      'getCornerCard',
      RequestMethod.GET,
      'bouts/:id/corner-card',
      BOUT_PERMISSIONS.READ,
    ],
    [
      'getFeasibility',
      RequestMethod.GET,
      'bouts/feasibility',
      BOUT_PERMISSIONS.CREATE,
    ],
    ['getBout', RequestMethod.GET, 'bouts/:id', BOUT_PERMISSIONS.READ],
    ['updateBout', RequestMethod.PATCH, 'bouts/:id', BOUT_PERMISSIONS.UPDATE],
    [
      'startCamp',
      RequestMethod.POST,
      'bouts/:id/camp',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'enterFightWeek',
      RequestMethod.POST,
      'bouts/:id/fight-week',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'cancelBout',
      RequestMethod.POST,
      'bouts/:id/cancel',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'addRequirement',
      RequestMethod.POST,
      'bouts/:id/requirements',
      BOUT_PERMISSIONS.REQUIREMENT,
    ],
    [
      'updateRequirement',
      RequestMethod.PATCH,
      'bouts/:id/requirements/:code',
      BOUT_PERMISSIONS.REQUIREMENT,
    ],
    [
      'removeRequirement',
      RequestMethod.DELETE,
      'bouts/:id/requirements/:code',
      BOUT_PERMISSIONS.REQUIREMENT,
    ],
    [
      'getWeightTrack',
      RequestMethod.GET,
      'bouts/:id/weight-track',
      BOUT_PERMISSIONS.READ,
    ],
    [
      'weighIn',
      RequestMethod.POST,
      'bouts/:id/weigh-in',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'catchweight',
      RequestMethod.POST,
      'bouts/:id/catchweight',
      BOUT_PERMISSIONS.UPDATE,
    ],
    [
      'recordResult',
      RequestMethod.POST,
      'bouts/:id/result',
      BOUT_PERMISSIONS.RESULT,
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

  it('registers feasibility before the dynamic ID route', () => {
    const handlers = Object.getOwnPropertyNames(proto);
    expect(handlers.indexOf('getFeasibility')).toBeLessThan(
      handlers.indexOf('getBout'),
    );
  });

  it('registers prior-context before the dynamic ID route', () => {
    const handlers = Object.getOwnPropertyNames(proto);
    expect(handlers.indexOf('getPriorContext')).toBeLessThan(
      handlers.indexOf('getBout'),
    );
  });

  it('exposes exactly the endpoints of the ticket (T-006 weigh-in and result included)', () => {
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (key) => key !== 'constructor' && key !== 'requireActor',
    );
    expect(handlers.sort()).toEqual(cases.map(([name]) => name).sort());
  });
});

// Exercise the same Zod DTO pipe installed on this controller, without external services.
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  OpponentAnalysisDto,
  RoundInputDto,
  RoundParamsDto,
} from './bouts.dto.js';
import { createBoutSchema, updateBoutSchema } from './bouts.model.js';
import type { BoutsService } from './bouts.service.js';
import { USER } from '../shared/types/user.role.js';

describe('T-010 controller DTO boundary', () => {
  it('returns 422 for strict bodies, unsafe evidence and review injection', async () => {
    const valid = {
      profile: {},
      observations: [
        {
          id: 'o1',
          kind: 'HABIT',
          text: 'habit',
          confidence: 'ONCE',
          evidenceNote: 'seen',
        },
      ],
      tactics: [
        {
          id: 't1',
          text: 'counter',
          round: null,
          observationIds: ['o1'],
          sessionIds: [],
        },
      ],
    };
    for (const body of [
      { ...valid, extra: true },
      {
        ...valid,
        observations: [
          { ...valid.observations[0], evidenceUrl: 'javascript:alert(1)' },
        ],
      },
      {
        ...valid,
        observations: [{ ...valid.observations[0], evidenceNote: null }],
      },
      {
        ...valid,
        tactics: [{ ...valid.tactics[0], review: { outcome: 'EFFECTIVE' } }],
      },
    ]) {
      await expect(
        Promise.resolve().then(() =>
          appZodValidationPipe.transform(body, {
            type: 'body',
            metatype: OpponentAnalysisDto,
          }),
        ),
      ).rejects.toMatchObject({ status: 422 });
    }
    await expect(
      Promise.resolve().then(() =>
        appZodValidationPipe.transform(
          { unknown: true },
          {
            type: 'body',
            metatype: RoundInputDto,
          },
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('coerces roundNo and forwards the authenticated actor and audit request ID', async () => {
    const params = await appZodValidationPipe.transform(
      { id: '40000000-0000-4000-8000-000000000001', roundNo: '2' },
      {
        type: 'param',
        metatype: RoundParamsDto,
      },
    );
    const putRound = vi.fn().mockResolvedValue({ id: 'round' });
    const controller = new BoutsController({
      putRound,
    } as unknown as BoutsService);
    const actor = {
      id: 'coach',
      authSubject: 'sub',
      email: 'coach@example.invalid',
      role: USER.COACH,
    };
    expect(await controller.putRound(actor, params, { stunned: true })).toEqual(
      { id: 'round' },
    );
    expect(putRound).toHaveBeenCalledWith(
      actor,
      params.id,
      2,
      { stunned: true },
      expect.stringMatching(/^[0-9a-f-]{36}$/),
    );
    await expect(
      controller.putRound(undefined, params, {}),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('accepts null or integer 1–12 scheduledRounds and rejects other values', () => {
    const base = {
      fighterId: '10000000-0000-4000-8000-000000000001',
      rulesetId: '30000000-0000-4000-8000-000000000001',
      eventName: 'Cup',
      weighInAt: '2026-11-01T00:00:00Z',
      boutAt: '2026-11-02T00:00:00Z',
    };
    for (const scheduledRounds of [null, 1, 12]) {
      expect(
        createBoutSchema.safeParse({ ...base, scheduledRounds }).success,
      ).toBe(true);
      expect(updateBoutSchema.safeParse({ scheduledRounds }).success).toBe(
        true,
      );
    }
    for (const scheduledRounds of [0, 13, 1.5, '3']) {
      expect(
        createBoutSchema.safeParse({ ...base, scheduledRounds }).success,
      ).toBe(false);
      expect(updateBoutSchema.safeParse({ scheduledRounds }).success).toBe(
        false,
      );
    }
  });
});
