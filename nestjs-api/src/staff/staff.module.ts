import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CoachesController, DoctorsController } from './staff.controller.js';
import { StaffRepository } from './staff.repo.js';
import { StaffService } from './staff.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CoachesController, DoctorsController],
  providers: [StaffRepository, StaffService],
})
export class StaffModule {}
