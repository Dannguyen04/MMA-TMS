import { randomUUID } from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorEnvelope,
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
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
import {
  CreateGoalDto,
  GoalIdParamsDto,
  GoalPageResponseDto,
  GoalProgressDto,
  GoalResponseDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './goals.dto.js';
import { GOAL_PERMISSIONS } from './goals.model.js';
import { GoalsService } from './goals.service.js';

const WRITE_SCOPE =
  'Coaches manage goals of fighters they are actively assigned to; Admins ' +
  'manage any goal. FIGHTER and DOCTOR are always rejected, even when the ' +
  'permission has been granted individually.';

function requireActor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!actor) throw authenticationRequired();
  return actor;
}

@ApiTags('Goals')
@ApiBearerAuth()
@Controller('goals')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Get()
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: 'List goals',
    description:
      'Most urgent first (at risk, on track, achieved, missed), then by due ' +
      'date. Status is derived at read time. Repeat fighterId or status to ' +
      'filter by several values; fighters outside the actor scope narrow the ' +
      'result instead of failing. Pass pageInfo.endCursor as cursor for the ' +
      'next page.',
  })
  @ResponseMessage('Get goals successfully')
  @ApiSuccessEnvelope({
    message: 'Get goals successfully',
    model: GoalPageResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goal:get_all and a Fighter, Coach, Doctor or Admin profile')
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_GOAL_CURSOR',
    message: 'The pagination cursor is invalid.',
    description:
      'INVALID_GOAL_CURSOR: the cursor was not issued by this endpoint. ' +
      'GOAL_SCOPE_TOO_LARGE: more than 2000 goals match; filter by fighter.',
  })
  async listGoals(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.service.listGoals(requireActor(actor), query);
  }

  @Post()
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create goal',
    description:
      'Dates are converted to academy days (Asia/Ho_Chi_Minh). Records the ' +
      'initial value (current, defaulting to baseline) as the first ' +
      'checkpoint and notifies the fighter.',
  })
  @ResponseMessage('Create goal successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    `Requires goal:create. ${WRITE_SCOPE} A Coach can only name themselves as the goal coach.`,
  )
  @ApiNotFoundEnvelope(
    'GOAL_FIGHTER_NOT_FOUND',
    'The fighter does not exist or is no longer active.',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'GOAL_COACH_NOT_ASSIGNED',
    message: 'The coach must be actively assigned to this fighter.',
    description:
      'GOAL_COACH_NOT_ASSIGNED: coachId is not an active coach assigned to ' +
      'the fighter. GOAL_DUE_DATE_IN_PAST: the due day is before today.',
  })
  async createGoal(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateGoalDto,
  ) {
    return this.service.createGoal(requireActor(actor), body, randomUUID());
  }

  @Get(':id')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get goal' })
  @ResponseMessage('Get goal successfully')
  @ApiSuccessEnvelope({
    message: 'Get goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goal:read')
  @ApiNotFoundEnvelope(
    'GOAL_NOT_FOUND',
    'The requested goal does not exist or you cannot access it.',
  )
  async getGoal(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: GoalIdParamsDto,
  ) {
    return this.service.getGoal(requireActor(actor), params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Update goal',
    description:
      'Edits the definition. The fighter and the measured value cannot be ' +
      'changed here; log progress instead.',
  })
  @ResponseMessage('Update goal successfully')
  @ApiSuccessEnvelope({
    message: 'Update goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(`Requires goal:update. ${WRITE_SCOPE}`)
  @ApiNotFoundEnvelope(
    'GOAL_NOT_FOUND',
    'The requested goal does not exist or you cannot access it.',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_GOAL_TARGET',
    message:
      'The target must differ from the baseline in the direction set by lowerIsBetter.',
    description:
      'Checked on the stored goal merged with the change. INVALID_GOAL_TARGET, ' +
      'INVALID_GOAL_DATE_RANGE (due date not after start date), or ' +
      'GOAL_COACH_NOT_ASSIGNED (new coachId not actively assigned).',
  })
  async updateGoal(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: GoalIdParamsDto,
    @Body() body: UpdateGoalDto,
  ) {
    return this.service.updateGoal(
      requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post(':id/progress')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.UPDATE] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Log goal progress',
    description:
      'Sets the current value. A second measurement on the same academy day ' +
      'replaces that day’s checkpoint. Notifies the fighter and the goal ' +
      'coach when the target is first reached.',
  })
  @ResponseMessage('Log goal progress successfully')
  @ApiSuccessEnvelope({
    message: 'Log goal progress successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(`Requires goal:update. ${WRITE_SCOPE}`)
  @ApiNotFoundEnvelope(
    'GOAL_NOT_FOUND',
    'The requested goal does not exist or you cannot access it.',
  )
  async logProgress(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: GoalIdParamsDto,
    @Body() body: GoalProgressDto,
  ) {
    return this.service.logProgress(
      requireActor(actor),
      params.id,
      body.value,
      randomUUID(),
    );
  }

  @Delete(':id')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.DELETE] })
  @ApiOperation({
    summary: 'Delete goal',
    description: 'Soft-deletes the goal; it no longer appears in any read.',
  })
  @ResponseMessage('Delete goal successfully')
  @ApiSuccessEnvelope({
    message: 'Delete goal successfully',
    description: 'Delete goal successfully; data is null.',
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(`Requires goal:delete. ${WRITE_SCOPE}`)
  @ApiNotFoundEnvelope(
    'GOAL_NOT_FOUND',
    'The requested goal does not exist or you cannot access it.',
  )
  async deleteGoal(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: GoalIdParamsDto,
  ) {
    return this.service.deleteGoal(requireActor(actor), params.id, randomUUID());
  }
}
