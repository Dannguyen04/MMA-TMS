import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

/** So sánh bí mật với thời gian hằng định; băm trước để không lộ độ dài. */
function secretsMatch(provided: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}

@Injectable()
export class WorkerAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expectedToken = process.env.WORKER_SECRET_TOKEN;

    if (!expectedToken) {
      throw new UnauthorizedException(
        'Máy chủ chưa cấu hình WORKER_SECRET_TOKEN.',
      );
    }

    const headerToken = request.headers['x-worker-secret'] as
      string | undefined;

    // Hỗ trợ cả x-worker-secret hoặc Bearer token
    const authHeader = request.headers['authorization'];
    let bearerToken: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      bearerToken = authHeader.slice(7);
    }

    const providedToken = headerToken || bearerToken;

    if (!providedToken || !secretsMatch(providedToken, expectedToken)) {
      throw new UnauthorizedException(
        'Không có quyền truy cập: Worker Secret Token không hợp lệ.',
      );
    }

    return true;
  }
}
