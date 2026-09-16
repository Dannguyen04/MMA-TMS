import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ErrorDetails = Record<string, unknown> | readonly unknown[];

interface ErrorPayload {
  code?: unknown;
  error?: unknown;
  errors?: unknown;
  issues?: unknown;
  message?: unknown;
}

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details?: ErrorDetails;
}

const defaultCodes: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
  [HttpStatus.BAD_GATEWAY]: 'BAD_GATEWAY',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asDetails(value: unknown): ErrorDetails | undefined {
  return isRecord(value) || Array.isArray(value) ? value : undefined;
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const normalized = this.normalize(exception);

    if (!(exception instanceof HttpException)) {
      const errorType = exception instanceof Error ? exception.name : 'Unknown';
      this.logger.error(
        `${request.method} ${request.originalUrl} failed unexpectedly (${errorType})`,
      );
    }

    response.status(normalized.statusCode).json({
      success: false,
      error: normalized,
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      };
    }

    const statusCode = exception.getStatus();
    const rawResponse = exception.getResponse();
    const payload: ErrorPayload = isRecord(rawResponse) ? rawResponse : {};
    const details =
      asDetails(payload.issues) ??
      asDetails(payload.errors) ??
      (Array.isArray(payload.message) ? payload.message : undefined);
    const validationError = details !== undefined;

    return {
      statusCode,
      code:
        typeof payload.code === 'string'
          ? payload.code
          : validationError
            ? 'VALIDATION_ERROR'
            : (defaultCodes[statusCode] ?? `HTTP_${statusCode}`),
      message: this.message(payload, rawResponse, validationError, statusCode),
      ...(details ? { details } : {}),
    };
  }

  private message(
    payload: ErrorPayload,
    rawResponse: string | object,
    validationError: boolean,
    statusCode: number,
  ): string {
    if (typeof payload.message === 'string') return payload.message;
    if (validationError) return 'Validation failed';
    if (typeof rawResponse === 'string') return rawResponse;
    if (typeof payload.error === 'string') return payload.error;
    return statusCode >= HttpStatus.INTERNAL_SERVER_ERROR
      ? 'Internal server error'
      : 'Request failed';
  }
}
