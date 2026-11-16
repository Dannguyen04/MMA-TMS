import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { DoctorScheduleController } from './doctor-schedule.controller.js';
import { DoctorScheduleRepository } from './doctor-schedule.repo.js';
import { DoctorScheduleService } from './doctor-schedule.service.js';

/** Read-only schedule views (mobile redesign 2026-11-11). Reads tables directly; no other module's services. */
@Module({
  imports: [DatabaseModule],
  controllers: [DoctorScheduleController],
  providers: [DoctorScheduleRepository, DoctorScheduleService],
})
export class ScheduleModule {}
