import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

export function invalidCredentials(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    error: 'Unauthorized',
    code: 'INVALID_CREDENTIALS',
    message: 'Email, password, or session is invalid',
  });
}

export function registrationConflict(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: 'REGISTRATION_CONFLICT',
    message: 'The account could not be registered',
  });
}

export function authProviderUnavailable(): BadGatewayException {
  return new BadGatewayException({
    statusCode: 502,
    error: 'Bad Gateway',
    code: 'AUTH_PROVIDER_UNAVAILABLE',
    message: 'The authentication provider is unavailable',
  });
}

export function registrationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: 500,
    error: 'Internal Server Error',
    code: 'REGISTRATION_FAILED',
    message: 'The account could not be registered',
  });
}
