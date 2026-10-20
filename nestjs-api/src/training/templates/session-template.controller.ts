import { Controller, Get, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../../shared/decorators/api-envelope.decorator.js';
import { RequirePermissions } from '../../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../../shared/guards/auth.guard.js';
import { appZodValidationPipe } from '../../shared/pipes/zod-validation.pipe.js';
import {
  ListSessionTemplatesQueryDto,
  SessionTemplateResponseDto,
} from '../training.dto.js';
import { TRAINING_PERMISSIONS } from '../training.model.js';
import { SessionTemplateService } from './session-template.service.js';

@ApiTags('Training Session Templates')
@ApiBearerAuth()
@Controller('training-session-templates')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class SessionTemplateController {
  constructor(private readonly service: SessionTemplateService) {}

  @Get()
  @RequirePermissions({ allOf: [TRAINING_PERMISSIONS.SESSION_TEMPLATE_READ] })
  @ApiOperation({ summary: 'List session (lesson plan) templates' })
  @ResponseMessage('Get session templates successfully')
  @ApiSuccessEnvelope({
    message: 'Get session templates successfully',
    model: SessionTemplateResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires training.session_template:read')
  async listTemplates(@Query() query: ListSessionTemplatesQueryDto) {
    return this.service.listTemplates(query);
  }
}
