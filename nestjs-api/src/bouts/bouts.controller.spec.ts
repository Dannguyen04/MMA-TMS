import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { BOUT_PERMISSIONS } from './bouts.constants.js';
import { BoutsController } from './bouts.controller.js';

describe('BoutsController routes', () => {
  const reflector = new Reflector();
  const proto = BoutsController.prototype;

  const cases: [
    keyof BoutsController,
    RequestMethod,
    string,
    string,
  ][] = [
    ['listRulesets', RequestMethod.GET, 'competition-rulesets', BOUT_PERMISSIONS.RULESET_READ],
    ['listBouts', RequestMethod.GET, 'bouts', BOUT_PERMISSIONS.GET_ALL],
    ['createBout', RequestMethod.POST, 'bouts', BOUT_PERMISSIONS.CREATE],
    ['getBout', RequestMethod.GET, 'bouts/:id', BOUT_PERMISSIONS.READ],
    ['updateBout', RequestMethod.PATCH, 'bouts/:id', BOUT_PERMISSIONS.UPDATE],
    ['startCamp', RequestMethod.POST, 'bouts/:id/camp', BOUT_PERMISSIONS.UPDATE],
    ['enterFightWeek', RequestMethod.POST, 'bouts/:id/fight-week', BOUT_PERMISSIONS.UPDATE],
    ['cancelBout', RequestMethod.POST, 'bouts/:id/cancel', BOUT_PERMISSIONS.UPDATE],
    ['addRequirement', RequestMethod.POST, 'bouts/:id/requirements', BOUT_PERMISSIONS.REQUIREMENT],
    ['updateRequirement', RequestMethod.PATCH, 'bouts/:id/requirements/:code', BOUT_PERMISSIONS.REQUIREMENT],
    ['removeRequirement', RequestMethod.DELETE, 'bouts/:id/requirements/:code', BOUT_PERMISSIONS.REQUIREMENT],
    ['getWeightTrack', RequestMethod.GET, 'bouts/:id/weight-track', BOUT_PERMISSIONS.READ],
    ['weighIn', RequestMethod.POST, 'bouts/:id/weigh-in', BOUT_PERMISSIONS.UPDATE],
    ['catchweight', RequestMethod.POST, 'bouts/:id/catchweight', BOUT_PERMISSIONS.UPDATE],
    ['recordResult', RequestMethod.POST, 'bouts/:id/result', BOUT_PERMISSIONS.RESULT],
  ];

  it.each(cases)('%s uses %s %s and requires %s', (name, method, path, permission) => {
    const handler = proto[name] as (...args: never[]) => unknown;
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(method);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(path);
    expect(reflector.get(REQUIRED_PERMISSIONS, handler)).toEqual({ allOf: [permission] });
  });

  it('exposes exactly the endpoints of the ticket (T-006 weigh-in and result included)', () => {
    const handlers = Object.getOwnPropertyNames(proto).filter(
      (key) => key !== 'constructor' && key !== 'requireActor',
    );
    expect(handlers.sort()).toEqual(cases.map(([name]) => name).sort());
  });
});
