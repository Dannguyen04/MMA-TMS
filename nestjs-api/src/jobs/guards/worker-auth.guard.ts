import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const configuredToken = process.env.WORKER_SECRET_TOKEN?.trim();
    const expectedToken =
      configuredToken ||
      (process.env.NODE_ENV === 'production'
        ? undefined
        : 'mma-tms-worker-local-secret-2026');

    const headerToken = request.headers['x-worker-secret'] as
      string | undefined;

    // Hỗ trợ cả x-worker-secret hoặc Bearer token
    const authHeader = request.headers['authorization'];
    let bearerToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.slice(7);
    }

    const providedToken = headerToken || bearerToken;

    const matches =
      !!expectedToken &&
      !!providedToken &&
      Buffer.byteLength(providedToken) === Buffer.byteLength(expectedToken) &&
      timingSafeEqual(Buffer.from(providedToken), Buffer.from(expectedToken));

    if (!matches) {
      throw new UnauthorizedException(
        'Không có quyền truy cập: Worker Secret Token không hợp lệ.',
      );
    }

    return true;
  }
}
