import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FightersController } from './fighters.controller.js';
import { FightersRepository } from './fighters.repo.js';
import { FightersService } from './fighters.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [FightersController],
  providers: [FightersRepository, FightersService],
  exports: [FightersRepository, FightersService],
})
export class FightersModule {}

