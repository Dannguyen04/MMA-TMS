import {
  HttpException,
  HttpStatus,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

/** Shared by the factories and Swagger so both stay identical. */
export const NOTIFICATION_ERROR = {
  NOT_FOUND: {
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification not found',
  },
  STREAM_LIMIT: {
    code: 'NOTIFICATION_STREAM_LIMIT',
    message: 'Too many open notification streams for this account',
  },
  STREAM_UNAVAILABLE: {
    code: 'NOTIFICATION_STREAM_UNAVAILABLE',
    message: 'Realtime notifications are temporarily unavailable',
  },
} as const;

/** Same response for a missing row and another user's row: ownership is never disclosed. */
export function notificationNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    ...NOTIFICATION_ERROR.NOT_FOUND,
  });
}

export function notificationStreamLimitReached(): HttpException {
  return new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      error: 'Too Many Requests',
      ...NOTIFICATION_ERROR.STREAM_LIMIT,
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

export function notificationStreamUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    statusCode: HttpStatus.SERVICE_UNAVAILABLE,
    error: 'Service Unavailable',
    ...NOTIFICATION_ERROR.STREAM_UNAVAILABLE,
  });
}
