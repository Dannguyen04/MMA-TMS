import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'node:crypto';

export interface AuthenticatedUser {
  actorId: string;
  roles: string[];
}

@Injectable()
export class PromotionAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    const expectedWorkerToken = this.configService.get<string>('WORKER_SECRET_TOKEN');
    const expectedServiceSecret = this.configService.get<string>('INTERNAL_SERVICE_SECRET');
    const expectedAdminSecret = this.configService.get<string>('ADMIN_SERVICE_SECRET');

    // Fails closed in production if no secret is configured in environment
    if (isProduction && !expectedWorkerToken && !expectedServiceSecret && !expectedAdminSecret) {
      throw new UnauthorizedException(
        'Server security configuration missing: Workload service secret token is not configured.',
      );
    }

    const workerToken = expectedWorkerToken || (!isProduction ? 'mma-tms-worker-local-secret-2026' : '');
    const serviceToken = expectedServiceSecret || '';
    const adminToken = expectedAdminSecret || '';

    const providedHeader =
      (request.headers['x-worker-secret'] as string | undefined) ||
      (request.headers['x-service-secret'] as string | undefined);

    const authHeader = request.headers['authorization'];
    let providedBearer: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedBearer = authHeader.slice(7);
    }

    const providedSecret = providedHeader || providedBearer;

    if (!providedSecret) {
      throw new UnauthorizedException(
        'Access denied: Missing authorization credential.',
      );
    }

    let authenticatedActor: AuthenticatedUser | null = null;

    if (workerToken && this.timingSafeEqual(providedSecret, workerToken)) {
      authenticatedActor = {
        actorId: 'srv_worker_service',
        roles: ['promote', 'read'],
      };
    } else if (serviceToken && this.timingSafeEqual(providedSecret, serviceToken)) {
      authenticatedActor = {
        actorId: 'srv_product_backend',
        roles: ['promote', 'read', 'revoke'],
      };
    } else if (adminToken && this.timingSafeEqual(providedSecret, adminToken)) {
      authenticatedActor = {
        actorId: 'srv_admin_service',
        roles: ['promote', 'read', 'revoke'],
      };
    }

    if (!authenticatedActor) {
      throw new UnauthorizedException(
        'Access denied: Invalid service authorization credential.',
      );
    }

    // Role enforcement per endpoint
    const path = request.path || '';
    if (path.includes('/revoke') && !authenticatedActor.roles.includes('revoke')) {
      throw new ForbiddenException(
        'Forbidden: Credential lacks required permission scope [revoke].',
      );
    }

    if (path.includes('/promotions') && !authenticatedActor.roles.includes('promote')) {
      throw new ForbiddenException(
        'Forbidden: Credential lacks required permission scope [promote].',
      );
    }

    // Attach authenticated identity to request
    (request as any).user = authenticatedActor;

    return true;
  }

  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }
}
