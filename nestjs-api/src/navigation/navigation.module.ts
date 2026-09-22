import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { NavigationController } from './navigation.controller.js';
import { NavigationRepository } from './navigation.repo.js';
import { NavigationService } from './navigation.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [NavigationController],
  providers: [NavigationRepository, NavigationService],
})
export class NavigationModule {}
