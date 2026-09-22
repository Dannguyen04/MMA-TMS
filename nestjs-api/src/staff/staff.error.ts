import { HttpStatus, NotFoundException } from '@nestjs/common';

export function coachNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'COACH_NOT_FOUND',
    message: 'The requested coach profile does not exist or is inactive.',
  });
}

export function doctorNotFound(): NotFoundException {
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'DOCTOR_NOT_FOUND',
    message: 'The requested doctor profile does not exist or is inactive.',
  });
}
