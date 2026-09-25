import { forwardRef, Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SupabaseModule } from '../common/supabase/supabase.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { FighterAdmissionsModule } from '../fighter-admissions/fighter-admissions.module.js';
import { AUTH_ACCESS_SERVICE } from '../shared/contracts/auth-access.contract.js';
import { RECOVERY_EMAIL_SERVICE } from '../shared/contracts/recovery-email.contract.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repo.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    DatabaseModule,
    SupabaseModule,
    UsersModule,
    forwardRef(() => FighterAdmissionsModule),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
  ],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    { provide: AUTH_ACCESS_SERVICE, useExisting: AuthService },
    { provide: RECOVERY_EMAIL_SERVICE, useExisting: AuthService },
    AccessTokenGuard,
    AuthorizationGuard,
  ],
  exports: [
    AuthService,
    AUTH_ACCESS_SERVICE,
    RECOVERY_EMAIL_SERVICE,
    AccessTokenGuard,
    AuthorizationGuard,
  ],
})
export class AuthModule {}
