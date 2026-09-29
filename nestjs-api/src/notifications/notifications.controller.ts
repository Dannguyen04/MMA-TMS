import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  ApiErrorEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  AuthenticatedEndpoint,
  CurrentUser,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { SkipResponseEnvelope } from '../shared/decorators/skip-response-envelope.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { NotificationStreamService } from './notification-stream.service.js';
import {
  NOTIFICATION_ERROR_CODE,
  NOTIFICATION_STREAM_EVENT,
} from './notifications.constant.js';
import {
  ListNotificationsQueryDto,
  NotificationDto,
  NotificationIdParamsDto,
  UnreadCountDto,
} from './notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

/**
 * The caller's own inbox. Every route is authenticated-only and scoped to the
 * authenticated user; no route accepts a user ID, so no role (Admin included)
 * can read, modify or stream another inbox. There is no public send endpoint.
 */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly streamService: NotificationStreamService,
  ) {}

  @Get()
  @AuthenticatedEndpoint()
  @ApiOperation({
    summary: 'List my notifications',
    description:
      'Newest first (createdAt DESC, id DESC); optional unreadOnly filter.',
  })
  @ResponseMessage('Get notifications successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get notifications successfully',
    model: NotificationDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  async list(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.list(this.requireActor(actor), query);
  }

  @Get('unread-count')
  @AuthenticatedEndpoint()
  @ApiOperation({ summary: 'Count my unread notifications' })
  @ResponseMessage('Get unread notification count successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get unread notification count successfully',
    model: UnreadCountDto,
  })
  @ApiUnauthorizedEnvelope()
  async unreadCount(@CurrentUser() actor: AuthenticatedUser | undefined) {
    return this.notificationsService.unreadCount(this.requireActor(actor));
  }

  @Patch(':id/read')
  @AuthenticatedEndpoint()
  @ApiOperation({
    summary: 'Mark one of my notifications as read',
    description:
      'Idempotent; an already-read notification keeps its first readAt. ' +
      'Reading a notification does not resolve the business task it points to.',
  })
  @ResponseMessage('Mark notification as read successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Mark notification as read successfully',
    model: NotificationDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiNotFoundEnvelope(
    NOTIFICATION_ERROR_CODE.NOT_FOUND,
    'Notification not found',
    'Unknown ID or a notification owned by another user',
  )
  async markRead(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: NotificationIdParamsDto,
  ) {
    return this.notificationsService.markRead(
      this.requireActor(actor),
      params.id,
    );
  }

  @Get('stream')
  @AuthenticatedEndpoint()
  @SkipResponseEnvelope()
  @ApiOperation({
    summary: 'Realtime signals for my notifications (Server-Sent Events)',
    description:
      'Send the Bearer token in the Authorization header (use a fetch-based ' +
      'SSE client; native EventSource cannot set it). Events: ' +
      Object.values(NOTIFICATION_STREAM_EVENT).join(', ') +
      '. Signals carry IDs only; load content through GET /notifications ' +
      'after `ready`, on `resync` and after every reconnect. No replay.',
  })
  @ApiProduces('text/event-stream')
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'text/event-stream; stays open until closed by either side',
  })
  @ApiUnauthorizedEnvelope()
  @ApiErrorEnvelope({
    status: HttpStatus.TOO_MANY_REQUESTS,
    code: NOTIFICATION_ERROR_CODE.STREAM_LIMIT,
    message: 'Too many open notification streams for this account',
  })
  @ApiErrorEnvelope({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    code: NOTIFICATION_ERROR_CODE.STREAM_UNAVAILABLE,
    message: 'Realtime notifications are temporarily unavailable',
  })
  async stream(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    if (!request.auth) throw authenticationRequired();
    await this.streamService.open(
      request.auth.user,
      request.auth.accessToken,
      request,
      response,
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
