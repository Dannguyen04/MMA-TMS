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
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
  RequireRoles,
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
  GoalPageDto,
  GoalParamsDto,
  GoalProgressDto,
  GoalResponseDto,
  ListGoalsQueryDto,
  UpdateGoalDto,
} from './goals.dto.js';
import { GOAL_PERMISSIONS } from './goals.model.js';
import { GoalsService } from './goals.service.js';

@ApiTags('Goals')
@ApiBearerAuth()
@Controller('goals')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class GoalsController {
  constructor(private readonly service: GoalsService) {}

  @Get()
  @RequireRoles('FIGHTER', 'COACH', 'ADMIN')
  @ApiOperation({ summary: 'List goals within the current assignment scope' })
  @ResponseMessage('Get goals successfully')
  @ApiSuccessEnvelope({ message: 'Get goals successfully', model: GoalPageDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires a valid fighter or assignment scope')
  list(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: ListGoalsQueryDto,
  ) {
    return this.service.list(this.actor(user), query);
  }

  @Get(':id')
  @RequireRoles('FIGHTER', 'COACH', 'ADMIN')
  @ApiOperation({ summary: 'Get one scoped goal with progress history' })
  @ResponseMessage('Get goal successfully')
  @ApiSuccessEnvelope({
    message: 'Get goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires a valid fighter or assignment scope')
  @ApiNotFoundEnvelope('GOAL_NOT_FOUND', 'Goal was not found')
  get(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: GoalParamsDto,
  ) {
    return this.service.get(this.actor(user), params.id);
  }

  @Post()
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.WRITE] })
  @ApiOperation({ summary: 'Create a goal for an assigned fighter' })
  @ResponseMessage('Create goal successfully')
  @ApiSuccessEnvelope({
    message: 'Create goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goals:write and an active coach assignment')
  create(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Body() body: CreateGoalDto,
  ) {
    return this.service.create(this.actor(user), body, randomUUID());
  }

  @Post(':id/progress')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.WRITE] })
  @ApiOperation({ summary: 'Append a goal progress measurement' })
  @ResponseMessage('Update goal progress successfully')
  @ApiSuccessEnvelope({
    message: 'Update goal progress successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goals:write and an active coach assignment')
  @ApiNotFoundEnvelope('GOAL_NOT_FOUND', 'Goal was not found')
  progress(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: GoalParamsDto,
    @Body() body: GoalProgressDto,
  ) {
    return this.service.updateProgress(
      this.actor(user),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.WRITE] })
  @ApiOperation({ summary: 'Update a goal for an assigned fighter' })
  @ResponseMessage('Update goal successfully')
  @ApiSuccessEnvelope({
    message: 'Update goal successfully',
    model: GoalResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goals:write and an active coach assignment')
  @ApiNotFoundEnvelope('GOAL_NOT_FOUND', 'Goal was not found')
  update(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: GoalParamsDto,
    @Body() body: UpdateGoalDto,
  ) {
    return this.service.update(this.actor(user), params.id, body, randomUUID());
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [GOAL_PERMISSIONS.WRITE] })
  @ApiOperation({ summary: 'Delete a goal for an assigned fighter' })
  @ResponseMessage('Delete goal successfully')
  @ApiSuccessEnvelope({ message: 'Delete goal successfully' })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires goals:write and an active coach assignment')
  @ApiNotFoundEnvelope('GOAL_NOT_FOUND', 'Goal was not found')
  async delete(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: GoalParamsDto,
  ) {
    await this.service.delete(this.actor(user), params.id, randomUUID());
  }

  private actor(user: AuthenticatedUser | undefined) {
    if (!user) throw authenticationRequired();
    return user;
  }
}
