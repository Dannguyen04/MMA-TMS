import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase/supabase.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repo.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [DatabaseModule, SupabaseModule, AuthorizationModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
