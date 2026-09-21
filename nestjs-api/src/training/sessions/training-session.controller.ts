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
  CreateSessionDto,
  ListSessionsQueryDto,
  TrainingSessionIdParamsDto,
  TrainingSessionResponseDto,
  UpdateSessionDto,
  UpdateSessionStatusDto,
} from '../training.dto.js';
import { TRAINING_PERMISSIONS } from '../training.model.js';
import { requireActor } from '../training-actor.util.js';
import { TrainingSessionService } from './training-session.service.js';

@ApiTags('Training Sessions')
@ApiBearerAuth()
@Controller('training-sessions')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class TrainingSessionController {
  constructor(private readonly service: TrainingSessionService) {}

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
    'Requires training.session:create and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
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
    'Requires training.session:update and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
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
  @ApiOperation({
    summary: 'Update training session status',
    description:
      'Transitions a training session. `cancellationReason` is required and ' +
      'must be nonempty when `status` is CANCELLED, and is rejected for any ' +
      'other status (422). A session that already checked in receives a ' +
      'server-computed `actualDurationSec` measured from `checkedInAt` to ' +
      'the transition instant; clients cannot set it.',
  })
  @ResponseMessage('Update training session status successfully')
  @ApiSuccessEnvelope({
    message: 'Update training session status successfully',
    model: TrainingSessionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:transition and valid resource scope. DOCTOR is always ' +
      'rejected: DOCTOR cannot write training data even when a training ' +
      'permission has been granted individually.',
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
      body.cancellationReason,
    );
  }
}
