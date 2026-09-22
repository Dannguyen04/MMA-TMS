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
  CreateExerciseDto,
  CreatePlanExerciseDto,
  CreateSessionDto,
  CreateTrainingPlanDto,
  ExerciseIdParamsDto,
  ExerciseResponseDto,
  ListExercisesQueryDto,
  ListPlansQueryDto,
  ListSessionsQueryDto,
  RemovedPlanExerciseDto,
  TrainingPlanExerciseParamsDto,
  TrainingPlanExerciseResponseDto,
  TrainingPlanIdParamsDto,
  TrainingPlanResponseDto,
  TrainingSessionIdParamsDto,
  TrainingSessionResponseDto,
  UpdateExerciseDto,
  UpdatePlanExerciseDto,
  UpdatePlanStatusDto,
  UpdateSessionDto,
  UpdateSessionStatusDto,
  UpdateTrainingPlanDto,
  ListFeedbackQueryDto,
  CreateFeedbackDto,
  CoachFeedbackResponseDto,
} from './training.dto.js';
import { TRAINING_PERMISSIONS } from './training.model.js';
import { TrainingService } from './training.service.js';

function requireActor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!actor) throw authenticationRequired();
  return actor;
}

@ApiTags('Training Plans')
@ApiBearerAuth()
@Controller('training-plans')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class PlansController {
  constructor(private readonly service: TrainingService) {}

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
  @ApiForbiddenEnvelope(
    'Requires training.plan:get_all and valid resource scope',
  )
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
    'Requires training.plan:create and valid resource scope',
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
  @ApiNotFoundEnvelope('TRAINING_PLAN_NOT_FOUND', 'Training plan not found')
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
    'Requires training.plan:update and valid resource scope',
  )
  @ApiNotFoundEnvelope('TRAINING_PLAN_NOT_FOUND', 'Training plan not found')
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
    'Requires training.plan:transition and valid resource scope',
  )
  @ApiNotFoundEnvelope('TRAINING_PLAN_NOT_FOUND', 'Training plan not found')
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
  @ApiNotFoundEnvelope('TRAINING_PLAN_NOT_FOUND', 'Training plan not found')
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
    'Requires training.plan_exercise:create and valid resource scope',
  )
  @ApiNotFoundEnvelope('TRAINING_PLAN_NOT_FOUND', 'Training plan not found')
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
    'Requires training.plan_exercise:update and valid resource scope',
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
    'Requires training.plan_exercise:delete and valid resource scope',
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

@ApiTags('Training Sessions')
@ApiBearerAuth()
@Controller('training-sessions')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class SessionsController {
  constructor(private readonly service: TrainingService) {}

  @Get()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_GET_ALL] })
  @ApiOperation({ summary: 'List training sessions' })
  @ResponseMessage('Get training sessions successfully')
  @ApiSuccessEnvelope({
    message: 'Get training sessions successfully',
    model: TrainingSessionResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:get_all and valid resource scope',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'FIGHTER_SCOPE_REQUIRED',
    message: 'A fighterId is required for this operation.',
  })
  async listSessions(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListSessionsQueryDto,
  ) {
    return this.service.listSessions(requireActor(actor), query);
  }

  @Post()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create training session' })
  @ResponseMessage('Create training session successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create training session successfully',
    model: TrainingSessionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:create and valid resource scope',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_SESSION_PLAN',
    message: 'The selected training plan is unavailable.',
  })
  async createSession(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateSessionDto,
  ) {
    return this.service.createSession(requireActor(actor), body);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_READ] })
  @ApiOperation({ summary: 'Get training session' })
  @ResponseMessage('Get training session successfully')
  @ApiSuccessEnvelope({
    message: 'Get training session successfully',
    model: TrainingSessionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:read and valid resource scope',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_SESSION_NOT_FOUND',
    'Training session not found',
  )
  async getSession(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingSessionIdParamsDto,
  ) {
    return this.service.getSessionById(requireActor(actor), params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_UPDATE] })
  @ApiOperation({ summary: 'Update training session' })
  @ResponseMessage('Update training session successfully')
  @ApiSuccessEnvelope({
    message: 'Update training session successfully',
    model: TrainingSessionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:update and valid resource scope',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_SESSION_NOT_FOUND',
    'Training session not found',
  )
  async updateSession(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingSessionIdParamsDto,
    @Body() body: UpdateSessionDto,
  ) {
    return this.service.updateSession(requireActor(actor), params.id, body);
  }

  @Patch(':id/status')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_TRANSITION] })
  @ApiOperation({ summary: 'Update training session status' })
  @ResponseMessage('Update training session status successfully')
  @ApiSuccessEnvelope({
    message: 'Update training session status successfully',
    model: TrainingSessionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:transition and valid resource scope',
  )
  @ApiNotFoundEnvelope(
    'TRAINING_SESSION_NOT_FOUND',
    'Training session not found',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_SESSION_STATUS_TRANSITION',
    message: 'The requested training session status transition is invalid.',
  })
  @ApiConflictEnvelope(
    'SESSION_STATE_CONFLICT',
    'The training session state was modified concurrently.',
  )
  async updateSessionStatus(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: TrainingSessionIdParamsDto,
    @Body() body: UpdateSessionStatusDto,
  ) {
    return this.service.updateSessionStatus(
      requireActor(actor),
      params.id,
      body.status,
    );
  }
}

@ApiTags('Coach Feedback')
@ApiBearerAuth()
@Controller('coach-feedback')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class FeedbackController {
  constructor(private readonly service: TrainingService) {}

  @Get()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.FEEDBACK_GET_ALL] })
  @ApiOperation({ summary: 'List coach feedback' })
  @ResponseMessage('Get coach feedback successfully')
  @ApiSuccessEnvelope({
    message: 'Get coach feedback successfully',
    model: CoachFeedbackResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.feedback:get_all and valid resource scope',
  )
  async listFeedback(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListFeedbackQueryDto,
  ) {
    return this.service.listFeedback(requireActor(actor), query);
  }

  @Post()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.FEEDBACK_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create coach feedback' })
  @ResponseMessage('Create coach feedback successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create coach feedback successfully',
    model: CoachFeedbackResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.feedback:create and an active coach assignment',
  )
  @ApiErrorEnvelope({
    status: HttpStatus.BAD_REQUEST,
    code: 'FEEDBACK_CONTEXT_MISMATCH',
    message:
      'The referenced session or video does not belong to the feedback fighter.',
  })
  async createFeedback(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateFeedbackDto,
  ) {
    return this.service.createFeedback(requireActor(actor), body);
  }
}

@ApiTags('Exercises')
@ApiBearerAuth()
@Controller('exercises')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class ExercisesController {
  constructor(private readonly service: TrainingService) {}

  @Get()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.EXERCISE_GET_ALL] })
  @ApiOperation({ summary: 'List global exercises' })
  @ResponseMessage('Get exercises successfully')
  @ApiSuccessEnvelope({
    message: 'Get exercises successfully',
    model: ExerciseResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.exercise:get_all permission')
  async listExercises(@Query() query: ListExercisesQueryDto) {
    return this.service.listExercises(query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.EXERCISE_READ] })
  @ApiOperation({ summary: 'Get exercise details' })
  @ResponseMessage('Get exercise successfully')
  @ApiSuccessEnvelope({
    message: 'Get exercise successfully',
    model: ExerciseResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.exercise:read permission')
  @ApiNotFoundEnvelope('EXERCISE_NOT_FOUND', 'Exercise not found')
  async getExercise(@Param() params: ExerciseIdParamsDto) {
    return this.service.getExerciseById(params.id);
  }

  @Post()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.EXERCISE_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create global exercise' })
  @ResponseMessage('Create exercise successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create exercise successfully',
    model: ExerciseResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.exercise:create permission')
  @ApiConflictEnvelope(
    'TRAINING_CONFLICT',
    'The operation violates a unique constraint.',
  )
  async createExercise(@Body() body: CreateExerciseDto) {
    return this.service.createExercise(body);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.EXERCISE_UPDATE] })
  @ApiOperation({ summary: 'Update global exercise' })
  @ResponseMessage('Update exercise successfully')
  @ApiSuccessEnvelope({
    message: 'Update exercise successfully',
    model: ExerciseResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.exercise:update permission')
  @ApiNotFoundEnvelope('EXERCISE_NOT_FOUND', 'Exercise not found')
  async updateExercise(
    @Param() params: ExerciseIdParamsDto,
    @Body() body: UpdateExerciseDto,
  ) {
    return this.service.updateExercise(params.id, body);
  }
}
