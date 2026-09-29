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
  ApiConflictEnvelope,
  ApiErrorEnvelope,
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';
import {
  CreatePlanExerciseDto,
  CreateTrainingPlanDto,
  ListPlansQueryDto,
  RemovedPlanExerciseDto,
  TrainingPlanExerciseParamsDto,
  TrainingPlanExerciseResponseDto,
  TrainingPlanIdParamsDto,
  TrainingPlanResponseDto,
  UpdatePlanExerciseDto,
  UpdatePlanStatusDto,
  UpdateTrainingPlanDto,
} from '../training.dto.js';
import { TRAINING_PERMISSIONS } from '../training.model.js';
import { requireActor } from '../training-actor.util.js';
import { TrainingPlanService } from './training-plan.service.js';

@ApiTags('Training Plans')
@ApiBearerAuth()
@Controller('training-plans')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class TrainingPlanController {
  constructor(private readonly service: TrainingPlanService) {}

  @Get()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_GET_ALL] })
  @ApiOperation({ summary: 'List training plans' })
  @ResponseMessage('Get training plans successfully')
  @ApiSuccessEnvelope({
    message: 'Get training plans successfully',
    model: TrainingPlanResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.plan:get_all and valid resource scope')
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'FIGHTER_SCOPE_REQUIRED',
    message: 'A fighterId is required for this operation.',
  })
  async listPlans(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListPlansQueryDto,
  ) {
    return this.service.listPlans(requireActor(actor), query);
  }

  @Post()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create training plan' })
  @ResponseMessage('Create training plan successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create training plan successfully',
    model: TrainingPlanResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan:create and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_PLAN_DATE_RANGE',
    message: 'The plan end date must be after or equal to the start date.',
  })
  @ApiConflictEnvelope(
    'TRAINING_CONFLICT',
    'The operation violates a unique constraint.',
  )
  async createPlan(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateTrainingPlanDto,
  ) {
    return this.service.createPlan(requireActor(actor), body);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_READ] })
  @ApiOperation({ summary: 'Get training plan' })
  @ResponseMessage('Get training plan successfully')
  @ApiSuccessEnvelope({
    message: 'Get training plan successfully',
    model: TrainingPlanResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.plan:read and valid resource scope')
  @ApiNotFoundEnvelope(
    'TRAINING_PLAN_NOT_FOUND',
    'Training plan not found',
  )
  async getPlan(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanIdParamsDto,
  ) {
    return this.service.getPlanById(requireActor(actor), params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_UPDATE] })
  @ApiOperation({ summary: 'Update training plan' })
  @ResponseMessage('Update training plan successfully')
  @ApiSuccessEnvelope({
    message: 'Update training plan successfully',
    model: TrainingPlanResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan:update and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_PLAN_NOT_FOUND',
    'Training plan not found',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_PLAN_DATE_RANGE',
    message: 'The plan end date must be after or equal to the start date.',
  })
  async updatePlan(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanIdParamsDto,
    @Body() body: UpdateTrainingPlanDto,
  ) {
    return this.service.updatePlan(requireActor(actor), params.id, body);
  }

  @Patch(':id/status')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_TRANSITION] })
  @ApiOperation({ summary: 'Update training plan status' })
  @ResponseMessage('Update training plan status successfully')
  @ApiSuccessEnvelope({
    message: 'Update training plan status successfully',
    model: TrainingPlanResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan:transition and valid resource scope. DOCTOR is ' +
      'always rejected: DOCTOR cannot write training data even when a ' +
      'training permission has been granted individually.',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_PLAN_NOT_FOUND',
    'Training plan not found',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_PLAN_STATUS_TRANSITION',
    message: 'The requested training plan status transition is invalid.',
    description:
      'The requested training plan status transition is invalid — a ' +
      'COMPLETED or CANCELLED plan cannot return to DRAFT.',
  })
  @ApiConflictEnvelope(
    'PLAN_STATE_CONFLICT',
    'The training plan state was modified concurrently.',
  )
  async updatePlanStatus(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanIdParamsDto,
    @Body() body: UpdatePlanStatusDto,
  ) {
    return this.service.updatePlanStatus(
      requireActor(actor),
      params.id,
      body.status,
    );
  }

  @Get(':id/exercises')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_EXERCISE_READ] })
  @ApiOperation({ summary: 'List training plan exercises' })
  @ResponseMessage('Get training plan exercises successfully')
  @ApiSuccessEnvelope({
    message: 'Get training plan exercises successfully',
    model: TrainingPlanExerciseResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan_exercise:read and valid resource scope',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_PLAN_NOT_FOUND',
    'Training plan not found',
  )
  async listPlanExercises(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanIdParamsDto,
  ) {
    return this.service.listPlanExercises(requireActor(actor), params.id);
  }

  @Post(':id/exercises')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_EXERCISE_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add exercise to training plan' })
  @ResponseMessage('Add training plan exercise successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Add training plan exercise successfully',
    model: TrainingPlanExerciseResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan_exercise:create and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_PLAN_NOT_FOUND',
    'Training plan not found',
  )
  @ApiConflictEnvelope(
    'TRAINING_CONFLICT',
    'The operation violates a unique constraint.',
  )
  async addPlanExercise(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanIdParamsDto,
    @Body() body: CreatePlanExerciseDto,
  ) {
    return this.service.addPlanExercise(requireActor(actor), params.id, body);
  }

  @Patch(':id/exercises/:exerciseId')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_EXERCISE_UPDATE] })
  @ApiOperation({ summary: 'Update training plan exercise' })
  @ResponseMessage('Update training plan exercise successfully')
  @ApiSuccessEnvelope({
    message: 'Update training plan exercise successfully',
    model: TrainingPlanExerciseResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan_exercise:update and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiNotFoundEnvelope(
    'PLAN_EXERCISE_NOT_FOUND',
    'Training plan exercise not found',
  )
  async updatePlanExercise(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanExerciseParamsDto,
    @Body() body: UpdatePlanExerciseDto,
  ) {
    return this.service.updatePlanExercise(
      requireActor(actor),
      params.id,
      params.exerciseId,
      body,
    );
  }

  @Delete(':id/exercises/:exerciseId')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.PLAN_EXERCISE_DELETE] })
  @ApiOperation({ summary: 'Remove exercise from training plan' })
  @ResponseMessage('Remove training plan exercise successfully')
  @ApiSuccessEnvelope({
    message: 'Remove training plan exercise successfully',
    model: RemovedPlanExerciseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.plan_exercise:delete and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiNotFoundEnvelope(
    'PLAN_EXERCISE_NOT_FOUND',
    'Training plan exercise not found',
  )
  async removePlanExercise(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingPlanExerciseParamsDto,
  ) {
    return this.service.removePlanExercise(
      requireActor(actor),
      params.id,
      params.exerciseId,
    );
  }
}
