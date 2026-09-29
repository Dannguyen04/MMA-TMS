import {
  Body,
  Controller,
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
  CreateExerciseDto,
  ExerciseIdParamsDto,
  ExerciseResponseDto,
  ListExercisesQueryDto,
  UpdateExerciseDto,
} from '../training.dto.js';
import { TRAINING_PERMISSIONS } from '../training.model.js';
import { requireActor } from '../training-actor.util.js';
import { ExerciseService } from './exercise.service.js';

@ApiTags('Exercises')
@ApiBearerAuth()
@Controller('exercises')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class ExerciseController {
  constructor(private readonly service: ExerciseService) {}

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
  @ApiForbiddenEnvelope(
    'Requires training.exercise:create permission. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiConflictEnvelope(
    'TRAINING_CONFLICT',
    'The operation violates a unique constraint.',
  )
  async createExercise(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateExerciseDto,
  ) {
    return this.service.createExercise(requireActor(actor), body);
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
  @ApiForbiddenEnvelope(
    'Requires training.exercise:update permission. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
  )
  @ApiNotFoundEnvelope('EXERCISE_NOT_FOUND', 'Exercise not found')
  async updateExercise(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: ExerciseIdParamsDto,
    @Body() body: UpdateExerciseDto,
  ) {
    return this.service.updateExercise(requireActor(actor), params.id, body);
  }
}
