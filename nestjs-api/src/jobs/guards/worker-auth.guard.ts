import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    const expectedToken =
      process.env.WORKER_SECRET_TOKEN || 'mma-tms-worker-local-secret-2026';

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
