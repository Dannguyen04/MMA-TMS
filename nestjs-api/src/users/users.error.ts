import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

export const USER_ERROR = {
  NOT_FOUND: {
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'USER_NOT_FOUND',
    message: 'User not found',
  },
  ALREADY_EXISTS: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'USER_ALREADY_EXISTS',
    message: 'A user already exists for this identity or email',
  },
  CREATION_FAILED: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'USER_ALREADY_EXISTS',
    message: 'The user could not be created',
  },
  AUTH_IDENTITY_NOT_FOUND: {
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'AUTH_IDENTITY_NOT_FOUND',
    message: 'The authenticated identity is not available',
  },
  INVALID_DATA: {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'INVALID_USER_DATA',
    message: 'The user data is invalid',
  },
  ROLE_MISMATCH: {
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'USER_ROLE_MISMATCH',
    message: 'The profile type does not match the user role',
  },
  OPERATION_FAILED: {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'USER_OPERATION_FAILED',
    message: 'Unable to complete the user operation',
  },
} as const;

interface PostgreSqlError {
  code: string;
  constraint?: string;
}

function isPostgreSqlError(error: unknown): error is PostgreSqlError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
}

export function userNotFound(): NotFoundException {
  return new NotFoundException(USER_ERROR.NOT_FOUND);
}

export function userCreationFailed(): ConflictException {
  return new ConflictException(USER_ERROR.CREATION_FAILED);
}

export function userRoleMismatch(): BadRequestException {
  return new BadRequestException(USER_ERROR.ROLE_MISMATCH);
}

export function mapUserPersistenceError(error: unknown): HttpException {
  if (!isPostgreSqlError(error)) {
    return new InternalServerErrorException(USER_ERROR.OPERATION_FAILED);
  }

  if (error.code === '23505') {
    return new ConflictException(USER_ERROR.ALREADY_EXISTS);
  }

  if (error.code === '23503') {
    return new ConflictException(USER_ERROR.AUTH_IDENTITY_NOT_FOUND);
  }

  if (error.code === '23514' || error.code === '22P02') {
    return new BadRequestException(USER_ERROR.INVALID_DATA);
  }

  return new InternalServerErrorException(USER_ERROR.OPERATION_FAILED);
}
