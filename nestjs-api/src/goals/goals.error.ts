import {
  BadRequestException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

export function goalNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'GOAL_NOT_FOUND',
    message: 'The requested goal does not exist.',
  });
}

export function invalidGoalRange(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_GOAL_RANGE',
    message: 'The goal dates or target direction are invalid.',
  });
}
