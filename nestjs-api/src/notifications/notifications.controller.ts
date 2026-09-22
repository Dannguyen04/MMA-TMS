import {
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
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequireRoles,
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
  ListNotificationsQueryDto,
  NotificationIdParamsDto,
  NotificationMutationCountDto,
  NotificationPageDto,
  NotificationSummaryDto,
  NotificationSummaryQueryDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
@UsePipes(appZodValidationPipe)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'List notifications owned by the current user' })
  @ResponseMessage('Notifications retrieved successfully')
  @ApiSuccessEnvelope({
    message: 'Notifications retrieved successfully',
    model: NotificationPageDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  list(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.list(this.actor(actor), query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get unread count and latest notifications' })
  @ResponseMessage('Notification summary retrieved successfully')
  @ApiSuccessEnvelope({
    message: 'Notification summary retrieved successfully',
    model: NotificationSummaryDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  summary(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: NotificationSummaryQueryDto,
  ) {
    return this.notificationsService.summary(this.actor(actor), query.limit);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark one owned notification as read' })
  @ResponseMessage('Notification marked as read successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    message: 'Notification marked as read successfully',
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiNotFoundEnvelope('NOTIFICATION_NOT_FOUND', 'Notification was not found')
  markRead(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: NotificationIdParamsDto,
  ) {
    return this.notificationsService.markRead(
      this.actor(actor),
      params.id,
      randomUUID(),
    );
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all current-user notifications as read' })
  @ResponseMessage('Notifications marked as read successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    message: 'Notifications marked as read successfully',
    model: NotificationMutationCountDto,
  })
  @ApiUnauthorizedEnvelope()
  markAllRead(@CurrentUser() actor: AuthenticatedUser | undefined) {
    return this.notificationsService.markAllRead(
      this.actor(actor),
      randomUUID(),
    );
  }

  private actor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
