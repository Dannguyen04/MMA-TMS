import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
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
import {
  ACADEMY_SETTINGS_PERMISSIONS,
  ACADEMY_SETTINGS_RESPONSE_MESSAGES,
} from './academy-settings.constants.js';
import {
  AcademySettingsResponseDto,
  UpdateAcademySettingsDto,
} from './academy-settings.dto.js';
import { AcademySettingsService } from './academy-settings.service.js';

@ApiTags('Academy Settings')
@ApiBearerAuth()
@Controller('academy-settings')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
export class AcademySettingsController {
  constructor(
    private readonly academySettingsService: AcademySettingsService,
  ) {}

  @Get()
  @RequirePermissions({ allOf: [ACADEMY_SETTINGS_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get academy settings',
    description: 'Retrieves current academy-wide settings including medical supervision mode.',
  })
  @ResponseMessage(ACADEMY_SETTINGS_RESPONSE_MESSAGES.GET_SUCCESS)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: ACADEMY_SETTINGS_RESPONSE_MESSAGES.GET_SUCCESS,
    model: AcademySettingsResponseDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires academy_settings:read')
  async getSettings() {
    return this.academySettingsService.getSettings();
  }

  @Patch()
  @RequirePermissions({ allOf: [ACADEMY_SETTINGS_PERMISSIONS.MANAGE] })
  @ApiOperation({
    summary: 'Update academy settings',
    description: 'Updates academy-wide settings including medical supervision mode.',
  })
  @ResponseMessage(ACADEMY_SETTINGS_RESPONSE_MESSAGES.UPDATE_SUCCESS)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: ACADEMY_SETTINGS_RESPONSE_MESSAGES.UPDATE_SUCCESS,
    model: AcademySettingsResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires academy_settings:manage')
  async updateSettings(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() body: UpdateAcademySettingsDto,
  ) {
    return this.academySettingsService.updateSettings(
      this.requireActor(actor),
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
