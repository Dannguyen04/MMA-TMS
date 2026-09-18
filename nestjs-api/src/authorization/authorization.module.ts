import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { AuthorizationController } from './authorization.controller.js';
import { AuthorizationRepository } from './authorization.repo.js';
import { AuthorizationService } from './authorization.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthorizationController],
  providers: [AuthorizationRepository, AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}

