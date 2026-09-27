import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { env } from '../../shared/config/env.js';

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const expectedToken = env.WORKER_SECRET_TOKEN;

    const headerToken = request.headers['x-worker-secret'] as
      string | undefined;

    // Hỗ trợ cả x-worker-secret hoặc Bearer token
    const authHeader = request.headers['authorization'];
    let bearerToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.slice(7);
    }

    const providedToken = headerToken || bearerToken;

    if (!providedToken || providedToken !== expectedToken) {
      throw new UnauthorizedException(
        'Không có quyền truy cập: Worker Secret Token không hợp lệ.',
      );
    }

    return true;
  }
}
