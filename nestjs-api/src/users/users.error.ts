import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

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
  return new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    error: 'Not Found',
    code: 'USER_NOT_FOUND',
    message: 'User not found',
  });
}

export function userCreationFailed(): ConflictException {
  return new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    error: 'Conflict',
    code: 'USER_CREATION_FAILED',
    message: 'The user could not be created',
  });
}

export function userRoleMismatch(): BadRequestException {
  return new BadRequestException({
    statusCode: HttpStatus.BAD_REQUEST,
    error: 'Bad Request',
    code: 'USER_ROLE_MISMATCH',
    message: 'The profile type does not match the user role',
  });
}

export function mapUserPersistenceError(error: unknown): HttpException {
  if (!isPostgreSqlError(error)) {
    return new InternalServerErrorException({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      code: 'USER_OPERATION_FAILED',
      message: 'Unable to complete the user operation',
    });
  }

  if (error.code === '23505') {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'USER_ALREADY_EXISTS',
      message: 'A user already exists for this identity or email',
    });
  }

  if (error.code === '23503') {
    return new ConflictException({
      statusCode: HttpStatus.CONFLICT,
      error: 'Conflict',
      code: 'AUTH_IDENTITY_NOT_FOUND',
      message: 'The authenticated identity is not available',
    });
  }

  if (error.code === '23514' || error.code === '22P02') {
    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      code: 'INVALID_USER_DATA',
      message: 'The user data is invalid',
    });
  }

  return new InternalServerErrorException({
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    error: 'Internal Server Error',
    code: 'USER_OPERATION_FAILED',
    message: 'Unable to complete the user operation',
  });
}
