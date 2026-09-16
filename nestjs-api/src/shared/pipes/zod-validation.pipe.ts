import {
  UnprocessableEntityException,
  type PipeTransform,
} from '@nestjs/common';
import { createZodValidationPipe } from 'nestjs-zod';
import { ZodError } from 'zod';

const BaseAppZodValidationPipe: new () => PipeTransform =
  createZodValidationPipe({
    createValidationException: (error) => {
      const issues = error instanceof ZodError ? error.issues : [];
      return new UnprocessableEntityException({
        statusCode: 422,
        error: 'Unprocessable Entity',
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        issues: issues.map((issue) => ({
          code: issue.code,
          path: issue.path,
          message: issue.message,
        })),
      });
    },
  });

export const appZodValidationPipe: PipeTransform =
  new BaseAppZodValidationPipe();
