import {
  HttpException,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';

/** Registered in `main.ts` only when `API_TIMING_LOG=1`. */
export const API_TIMING_LOG_ENV = 'API_TIMING_LOG';

export function isApiTimingLogEnabled(value: string | undefined): boolean {
  return value === '1';
}

/**
 * Logs `METHOD /path status duration` for every HTTP request, to see where a slow page spends its time.
 * Measures from the first interceptor to the response: guards (authentication, permissions) run before
 * interceptors in NestJS and are not included. The query string is left out so search terms and ids in it
 * do not reach the log.
 */
@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: Pick<Logger, 'log'> = new Logger('RequestTiming'),
    private readonly now: () => number = () => performance.now(),
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0];
    const startedAt = this.now();

    const log = (status: number | string) => {
      const ms = Math.round(this.now() - startedAt);
      this.logger.log(`${request.method} ${path} ${status} ${ms}ms`);
    };

    return next.handle().pipe(
      tap({
        next: () => undefined,
        complete: () => log(response.statusCode),
        error: (error: unknown) =>
          log(error instanceof HttpException ? error.getStatus() : 500),
      }),
    );
  }
}
