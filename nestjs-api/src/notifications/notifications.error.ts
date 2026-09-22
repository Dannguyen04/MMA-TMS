import { HttpStatus, NotFoundException } from '@nestjs/common';

export function notificationNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification was not found',
  });
}
