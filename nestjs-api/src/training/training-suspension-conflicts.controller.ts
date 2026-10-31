import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { SUSPENSION_PERMISSIONS } from '../suspensions/suspensions.constants.js';
import { requireActor } from './training-actor.util.js';
import {
  ApplySuspensionConflictsDto,
  ConflictProposalResponseDto,
  SuspensionIdParamsDto,
  TrainingSessionResponseDto,
} from './training.dto.js';
import { TRAINING_PERMISSIONS } from './training.model.js';
import { TrainingSuspensionConflictsService } from './training-suspension-conflicts.service.js';

@ApiTags('Training Sessions')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class TrainingSuspensionConflictsController {
  constructor(
    private readonly service: TrainingSuspensionConflictsService,
  ) {}

  @Get('suspensions/:id/conflicts')
  @RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'List training session conflicts with a suspension (R28)',
    description:
      'Computes on read the proposed actions (CHANGE_TYPE to RECOVERY, RESCHEDULE after ends_on, or CANCEL) ' +
      'for the fighter’s SCHEDULED sessions blocked by in-force suspensions.',
  })
  @ResponseMessage('Get suspension schedule conflicts successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get suspension schedule conflicts successfully',
    model: ConflictProposalResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires suspension:read and access to the fighter')
  @ApiNotFoundEnvelope('SUSPENSION_NOT_FOUND', 'Suspension not found')
  async getConflicts(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: SuspensionIdParamsDto,
  ) {
    return this.service.getConflicts(requireActor(actor), params.id);
  }

  @Post('suspensions/:id/conflicts/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_UPDATE] })
  @ApiOperation({
    summary: 'Apply proposed training session conflict resolutions (R28)',
    description:
      'Atomically applies the current R28 proposals for the selected sessionIds inside a single transaction ' +
      'and dispatches reschedule/cancellation notifications after commit.',
  })
  @ResponseMessage('Apply suspension schedule conflicts successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Apply suspension schedule conflicts successfully',
    model: TrainingSessionResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires training.session:update and valid resource scope. DOCTOR is always rejected.',
  )
  @ApiNotFoundEnvelope('SUSPENSION_NOT_FOUND', 'Suspension not found')
  @ApiConflictEnvelope(
    'TRAINING_SUSPENSION_ACTIVE',
    'The fighter has an active suspension that blocks this training session type.',
  )
  async applyConflicts(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: SuspensionIdParamsDto,
    @Body() body: ApplySuspensionConflictsDto,
  ) {
    return this.service.applyConflicts(requireActor(actor), params.id, body);
  }
}
