import { HttpStatus, NotFoundException } from '@nestjs/common';

export function coachNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'COACH_NOT_FOUND',
    message: 'Coach profile not found or inactive',
  });
}
