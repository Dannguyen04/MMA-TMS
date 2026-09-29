import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { NOTIFICATION_ERROR_CODE } from './notifications.constant.js';

/**
 * Same response whether the notification does not exist or belongs to another
 * user, so ownership is never disclosed.
 */
export function notificationNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: NOTIFICATION_ERROR_CODE.NOT_FOUND,
    message: 'Notification not found',
  });
}

export function notificationStreamLimitReached(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      code: NOTIFICATION_ERROR_CODE.STREAM_LIMIT,
      message: 'Too many open notification streams for this account',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function notificationStreamUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    error: 'Service Unavailable',
    code: NOTIFICATION_ERROR_CODE.STREAM_UNAVAILABLE,
    message: 'Realtime notifications are temporarily unavailable',
  });
}

