import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  SUSPENSION_PERMISSIONS,
  SUSPENSION_RESPONSE_MESSAGES,
} from './suspensions.constants.js';
import {
  ClearSuspensionDto,
  CreateSuspensionDto,
  CreateSuspensionResponseDto,
  EndSuspensionEarlyDto,
  ListSuspensionsQueryDto,
  SuspensionIdParamsDto,
  SuspensionListResponseDto,
  SuspensionResponseDto,
} from './suspensions.dto.js';
import { SuspensionsService } from './suspensions.service.js';

@ApiTags('Suspensions')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class SuspensionsController {
  constructor(private readonly suspensionsService: SuspensionsService) {}

  @Get('suspensions')
  @RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'List suspensions',
    description:
      'Scope-aware list ordered by startsOn ascending with cursor pagination. ' +
      'FIGHTER sees own suspensions, COACH and DOCTOR assigned fighters, ADMIN all. ' +
      'Each item carries its computed `status` for today on the academy calendar.',
  })
  @ResponseMessage(SUSPENSION_RESPONSE_MESSAGES.LIST)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: SUSPENSION_RESPONSE_MESSAGES.LIST,
    model: SuspensionListResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires suspension:read and access to the fighter')
  async listSuspensions(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListSuspensionsQueryDto,
  ) {
    return this.suspensionsService.listSuspensions(
      this.requireActor(actor),
      query,
    );
  }

  @Post('suspensions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.CREATE] })
  @ApiOperation({
    summary: 'Create a manual suspension',
    description:
      'Creates a manual suspension (`boutId = null`) for an assigned fighter (or any active fighter for ADMIN).',
  })
  @ResponseMessage(SUSPENSION_RESPONSE_MESSAGES.CREATE)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: SUSPENSION_RESPONSE_MESSAGES.CREATE,
    model: CreateSuspensionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires suspension:create and access to the fighter')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter not found')
  async createSuspension(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: CreateSuspensionDto,
  ) {
    return this.suspensionsService.createSuspension(
      this.requireActor(actor),
      body,
      randomUUID(),
    );
  }

  @Post('suspensions/:id/clear')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.CLEAR] })
  @ApiOperation({
    summary: 'Clear a suspension awaiting clearance',
    description:
      'Marks a suspension cleared with a required `clearanceNote` without modifying `endsOn`. ' +
      'Allowed only while the suspension is `AWAITING_CLEARANCE` on the academy date of the call (from `endsOn + 1`). ' +
      'Restricted to assigned COACH or DOCTOR.',
  })
  @ResponseMessage(SUSPENSION_RESPONSE_MESSAGES.CLEAR)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: SUSPENSION_RESPONSE_MESSAGES.CLEAR,
    model: SuspensionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires suspension:clear and an assigned coach or doctor',
  )
  @ApiNotFoundEnvelope('SUSPENSION_NOT_FOUND', 'Suspension not found')
  @ApiConflictEnvelope(
    'SUSPENSION_ALREADY_CLEARED',
    'The suspension has already been cleared',
    'SUSPENSION_ALREADY_CLEARED, or SUSPENSION_NOT_AWAITING_CLEARANCE (details: { status }) when the suspension is not awaiting clearance today',
  )
  async clearSuspension(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: SuspensionIdParamsDto,
    @Body() body: ClearSuspensionDto,
  ) {
    return this.suspensionsService.clearSuspension(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('suspensions/:id/end-early')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.CLEAR] })
  @ApiOperation({
    summary: 'End an active MEDICAL suspension early',
    description:
      'Club suspension: the assigned DOCTOR gives `examinationId`, a TRAINING examination they recorded with an eligible decision, ' +
      'examined on or after `startsOn`, not superseded and not expired; unavailable when medical supervision is NONE. ' +
      'Organizer suspension: an assigned COACH or DOCTOR gives `liftReference` (the organizer lift document). ' +
      'Sets `clearedAt`, `clearedById` and `clearanceNote` (from `note`) without modifying `endsOn`.',
  })
  @ResponseMessage(SUSPENSION_RESPONSE_MESSAGES.END_EARLY)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: SUSPENSION_RESPONSE_MESSAGES.END_EARLY,
    model: SuspensionResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires suspension:clear and the assigned doctor (club) or an assigned coach or doctor (organizer)',
  )
  @ApiNotFoundEnvelope('SUSPENSION_NOT_FOUND', 'Suspension not found')
  @ApiConflictEnvelope(
    'SUSPENSION_EARLY_END_NOT_ELIGIBLE',
    'The suspension cannot be ended early',
    'SUSPENSION_EARLY_END_NOT_ELIGIBLE (details: { reason, status }), SUSPENSION_EARLY_END_EXAM_INVALID (details: { cause }), SUSPENSION_ALREADY_CLEARED, or MEDICAL_SUPERVISION_DISABLED',
  )
  async endSuspensionEarly(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: SuspensionIdParamsDto,
    @Body() body: EndSuspensionEarlyDto,
  ) {
    return this.suspensionsService.endSuspensionEarly(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
