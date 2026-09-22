import { Injectable } from '@nestjs/common';
import { coachNotFound, doctorNotFound } from './staff.error.js';
import type { ListStaffQuery } from './staff.model.js';
import { StaffRepository } from './staff.repo.js';

@Injectable()
export class StaffService {
  constructor(private readonly repo: StaffRepository) {}

  async listCoaches(query: ListStaffQuery) {
    const result = await this.repo.findCoaches(query);
    return { ...result, hasNextPage: query.page * query.limit < result.total };
  }

  async listDoctors(query: ListStaffQuery) {
    const result = await this.repo.findDoctors(query);
    return { ...result, hasNextPage: query.page * query.limit < result.total };
  }

  async getCoach(id: string) {
    const coach = await this.repo.findCoachById(id);
    if (!coach) throw coachNotFound();
    return coach;
  }

  async getDoctor(id: string) {
    const doctor = await this.repo.findDoctorById(id);
    if (!doctor) throw doctorNotFound();
    return doctor;
  }
}
