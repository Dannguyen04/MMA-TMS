import { Controller, Get, HttpStatus, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { BOUT_PERMISSIONS, BOUT_RESPONSE_MESSAGES } from './bouts.constants.js';
import { CoachTodoResponseDto } from './bouts.dto.js';
import { BoutsTodoService } from './bouts-todo.service.js';

@ApiTags('Bouts')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class BoutsTodoController {
  constructor(private readonly todoService: BoutsTodoService) {}

  @Get('coach/todo')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: "Coach's to-do card",
    description:
      'Computed on read, no job and no notification. One item per open task of the running ' +
      'bouts: paperwork (R11), weight red/yellow/grey (R7), tactics without sessions (R14), ' +
      'ready for the fight week (R16), official weigh-in today (R17), result overdue (R26), ' +
      'no weight logged for 2 days in the fight week (T0). COACH sees assigned fighters, ' +
      'ADMIN the whole club.',
  })
  @ResponseMessage(BOUT_RESPONSE_MESSAGES.COACH_TODO)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: BOUT_RESPONSE_MESSAGES.COACH_TODO,
    model: CoachTodoResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:get_all and the COACH or ADMIN role')
  async getCoachTodo(@CurrentUser() actor: AuthenticatedUser | undefined) {
    if (!actor) throw authenticationRequired();
    return this.todoService.getCoachTodo(actor);
  }
}
