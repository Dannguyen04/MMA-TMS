import { RequestMethod } from '@nestjs/common';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { REQUIRED_PERMISSIONS } from '../shared/decorators/auth.decorator.js';
import { BOUT_PERMISSIONS } from './bouts.constants.js';
import { BoutsTodoController } from './bouts-todo.controller.js';

describe('BoutsTodoController routes', () => {
  const handler = BoutsTodoController.prototype.getCoachTodo;

  it('serves GET coach/todo for bout:get_all', () => {
    expect(Reflect.getMetadata(METHOD_METADATA, handler)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe('coach/todo');
    expect(new Reflector().get(REQUIRED_PERMISSIONS, handler)).toEqual({
      allOf: [BOUT_PERMISSIONS.GET_ALL],
    });
  });

  it('has no other endpoint', () => {
    const handlers = Object.getOwnPropertyNames(BoutsTodoController.prototype).filter(
      (key) => key !== 'constructor',
    );
    expect(handlers).toEqual(['getCoachTodo']);
  });
});
