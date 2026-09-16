import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable, map } from 'rxjs';
import { RESPONSE_MESSAGE_METADATA } from '../decorators/response-message.decorator.js';

export interface ApiSuccessResponse<T> {
  success: true;
  message: string;
  data?: T;
}

@Injectable()
export class ApiResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiSuccessResponse<T>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiSuccessResponse<T>> {
    const message =
      this.reflector.getAllAndOverride<string>(RESPONSE_MESSAGE_METADATA, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'Request successful';

    return next.handle().pipe(map((data) => this.wrap(data, message)));
  }

  private wrap(data: T, message: string): ApiSuccessResponse<T> {
    return data === undefined
      ? { success: true, message }
      : { success: true, message, data };
  }
}
