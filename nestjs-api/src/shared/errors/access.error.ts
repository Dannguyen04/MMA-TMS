import { ForbiddenException, UnauthorizedException } from '@nestjs/common';

export function authenticationRequired(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    error: 'Unauthorized',
    code: 'AUTHENTICATION_REQUIRED',
    message: 'A valid access token is required',
  });
}

export function forbidden(): ForbiddenException {
  return new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    code: 'FORBIDDEN',
    message: 'You are not allowed to perform this action',
  });
}
