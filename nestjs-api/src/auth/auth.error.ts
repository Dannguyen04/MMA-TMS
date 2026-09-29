import {
  BadGatewayException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  UnprocessableEntityException,
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

/**
 * Covers an expired link, a link already redeemed once, and a malformed token.
 * Recovery links are single use, so a second click on the same link lands here.
 */
export function resetTokenInvalid(): UnauthorizedException {
  return new UnauthorizedException({
    statusCode: 401,
    error: 'Unauthorized',
    code: 'RESET_TOKEN_INVALID',
    message:
      'This password recovery link is invalid, already used, or expired. Request a new link.',
  });
}

export function resetPasswordSameAsCurrent(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: 'RESET_PASSWORD_SAME_AS_CURRENT',
    message:
      'The account already uses this password. Choose a different new password; the current one still works for sign-in.',
  });
}

export function resetPasswordTooWeak(): UnprocessableEntityException {
  return new UnprocessableEntityException({
    statusCode: 422,
    error: 'Unprocessable Entity',
    code: 'RESET_PASSWORD_TOO_WEAK',
    message: 'The new password does not meet the password policy',
  });
}

export function resetPasswordInProgress(): ConflictException {
  return new ConflictException({
    statusCode: 409,
    error: 'Conflict',
    code: 'RESET_PASSWORD_IN_PROGRESS',
    message: 'Another password recovery for this account is being processed',
  });
}

export function resetPasswordProviderFailed(): BadGatewayException {
  return new BadGatewayException({
    statusCode: 502,
    error: 'Bad Gateway',
    code: 'RESET_PASSWORD_PROVIDER_FAILED',
    message: 'The password could not be changed by the authentication provider',
  });
}

/**
 * The password change succeeded at the provider but the admission activation
 * state could not be recorded. The message must not claim the password change
 * failed. Recovery is deliberate: the stale claim is released automatically
 * after the stale window, the applicant requests a new recovery link and sets a
 * *different* new password, which produces fresh proof of a password change.
 * Resubmitting the same password would be rejected as `same_password`, and no
 * operator may mark the activation without that proof.
 */
export function resetPasswordConfirmationFailed(): InternalServerErrorException {
  return new InternalServerErrorException({
    statusCode: 500,
    error: 'Internal Server Error',
    code: 'RESET_PASSWORD_CONFIRMATION_FAILED',
    message:
      'Your password was changed, but the activation state was not recorded. Request a new recovery link and set a different new password to continue.',
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
