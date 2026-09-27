import { Injectable } from '@nestjs/common';
import type { PublicFighter } from '../fighters/fighters.model.js';
import { FightersRepository } from '../fighters/fighters.repo.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import { coachNotFound } from './coaches.error.js';
import type { ListCoachFightersQuery } from './coaches.model.js';
import { CoachesRepository } from './coaches.repo.js';

@Injectable()
export class CoachesService {
  constructor(
    private readonly coachesRepository: CoachesRepository,
    private readonly fightersRepository: FightersRepository,
  ) {}

  /**
   * COACH may request only its own active Coach profile; ADMIN may request
   * any existing active Coach profile. Every other caller fails closed
   * without distinguishing "not found" from "not authorized" for a COACH
   * requesting someone else's profile, so assignment/profile existence is
   * never leaked cross-Coach.
   */
  async findAssignedFighters(
    actor: AuthenticatedUser,
    coachIdParam: string,
    query: ListCoachFightersQuery,
  ): Promise<{ data: PublicFighter[]; total: number; hasNextPage: boolean }> {
    let coachId: string;

    if (actor.role === USER.COACH) {
      const ownCoachId = await this.fightersRepository.findActiveCoachIdByUserId(
        actor.id,
      );
      if (!ownCoachId || ownCoachId !== coachIdParam) throw forbidden();
      coachId = ownCoachId;
    } else if (actor.role === USER.ADMIN) {
      const isActive = await this.coachesRepository.isActiveCoach(coachIdParam);
      if (!isActive) throw coachNotFound();
      coachId = coachIdParam;
    } else {
      throw forbidden();
    }

    const { data, total } = await this.fightersRepository.findAllForCoach(
      coachId,
      query,
    );
    return { data, total, hasNextPage: query.page * query.limit < total };
  }
}
