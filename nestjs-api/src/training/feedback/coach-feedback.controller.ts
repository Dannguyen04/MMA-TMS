import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiErrorEnvelope,
  ApiForbiddenEnvelope,
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
  CoachFeedbackResponseDto,
  CreateFeedbackDto,
  ListFeedbackQueryDto,
} from '../training.dto.js';
import { TRAINING_PERMISSIONS } from '../training.model.js';
import { requireActor } from '../training-actor.util.js';
import { CoachFeedbackService } from './coach-feedback.service.js';

@ApiTags('Coach Feedback')
@ApiBearerAuth()
@Controller('coach-feedback')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class CoachFeedbackController {
  constructor(private readonly service: CoachFeedbackService) {}

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
