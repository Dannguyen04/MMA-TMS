import { Module } from '@nestjs/common';
import { SupabaseModule } from '../common/supabase/supabase.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { MedicalModule } from '../medical/medical.module.js';
import { UsersController } from './users.controller.js';
import { UsersRepository } from './users.repo.js';
import { UsersService } from './users.service.js';

@Module({
  // MedicalModule: Doctor-assignment reminder after an Admin creates a Fighter.
  imports: [DatabaseModule, SupabaseModule, MedicalModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersRepository, UsersService],
})
export class UsersModule {}
