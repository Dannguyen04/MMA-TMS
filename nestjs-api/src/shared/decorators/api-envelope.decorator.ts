import { applyDecorators, HttpStatus, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

export interface ApiSuccessEnvelopeOptions<TModel extends Type<unknown>> {
  status?: number;
  message: string;
  description?: string;
  model?: TModel;
  isArray?: boolean;
  isPaginated?: boolean;
  nullable?: boolean;
}

export function ApiSuccessEnvelope<TModel extends Type<unknown>>(
  options: ApiSuccessEnvelopeOptions<TModel>,
) {
  const status = options.status ?? HttpStatus.OK;
  const message = options.message;

  if (!options.model) {
    return applyDecorators(
      ApiResponse({
        status,
        description: options.description ?? message,
        schema: {
          type: 'object',
          properties: {
            success: { type: 'boolean', enum: [true], example: true },
            message: { type: 'string', example: message },
            data: {},
          },
          required: ['success', 'message', 'data'],
        },
      }),
    );
  }

  const dataSchema = options.isPaginated
    ? {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: { $ref: getSchemaPath(options.model) },
          },
          total: { type: 'number', example: 10 },
          hasNextPage: { type: 'boolean', example: false },
        },
        required: ['data', 'total', 'hasNextPage'],
      }
    : options.isArray
      ? {
          type: 'array',
          items: { $ref: getSchemaPath(options.model) },
        }
      : {
          $ref: getSchemaPath(options.model),
          ...(options.nullable ? { nullable: true } : {}),
        };

  return applyDecorators(
    ApiExtraModels(options.model),
    ApiResponse({
      status,
      description: options.description ?? message,
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', enum: [true], example: true },
          message: { type: 'string', example: message },
          data: dataSchema,
        },
        required: ['success', 'message', 'data'],
      },
    }),
  );
}

export interface ApiErrorEnvelopeOptions {
  status: number;
  code: string;
  message: string;
  description?: string;
}

export function ApiErrorEnvelope(options: ApiErrorEnvelopeOptions) {
  return ApiResponse({
    status: options.status,
    description: options.description ?? options.message,
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', enum: [false], example: false },
        error: {
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: options.status },
            code: { type: 'string', example: options.code },
            message: { type: 'string', example: options.message },
            details: {
              oneOf: [{ type: 'object' }, { type: 'array', items: {} }],
            },
          },
          required: ['statusCode', 'code', 'message'],
        },
      },
      required: ['success', 'error'],
    },
  });
}

export function ApiValidationErrorEnvelope(
  description = 'Validation failed (invalid request payload or parameters)',
) {
  return ApiErrorEnvelope({
    status: HttpStatus.UNPROCESSABLE_ENTITY,
    code: 'VALIDATION_ERROR',
    message: 'Validation failed',
    description,
  });
}

export function ApiUnauthorizedEnvelope(
  description = 'Missing or invalid access token',
) {
  return ApiErrorEnvelope({
    status: HttpStatus.UNAUTHORIZED,
    code: 'AUTHENTICATION_REQUIRED',
    message: 'A valid access token is required',
    description,
  });
}

export function ApiForbiddenEnvelope(
  description = 'Insufficient role or permissions',
) {
  return ApiErrorEnvelope({
    status: HttpStatus.FORBIDDEN,
    code: 'FORBIDDEN',
    message: 'You are not allowed to perform this action',
    description,
  });
}

export function ApiNotFoundEnvelope(
  code: string,
  message: string,
  description?: string,
) {
  return ApiErrorEnvelope({
    status: HttpStatus.NOT_FOUND,
    code,
    message,
    description: description ?? message,
  });
}

export function ApiConflictEnvelope(
  code: string,
  message: string,
  description?: string,
) {
  return ApiErrorEnvelope({
    status: HttpStatus.CONFLICT,
    code,
    message,
    description: description ?? message,
  });
}

export function ApiInternalServerErrorEnvelope(
  description = 'Unexpected server error',
) {
  return ApiErrorEnvelope({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
    description,
  });
}
