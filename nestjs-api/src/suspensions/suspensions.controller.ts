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
    model: SuspensionResponseDto,
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
    summary: 'Clear or end a suspension early',
    description:
      'Marks a suspension cleared with a required `clearanceNote` without modifying `endsOn`. ' +
      'Allowed at any time before or after `endsOn` as long as `clearedAt IS NULL`. ' +
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

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
