import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gt, isNull, lte, or } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../database/database.module.js';
import {
  coachFighters,
  coaches,
  doctorFighters,
  fighters,
  sportsDoctors,
} from '../database/schema.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';

@Injectable()
export class VideoAccessService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async canAccessFighter(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<boolean> {
    if (actor.role === USER.ADMIN) return true;

    if (actor.role === USER.FIGHTER) {
      const [row] = await this.db
        .select({ id: fighters.id })
        .from(fighters)
        .where(
          and(
            eq(fighters.id, fighterId),
            eq(fighters.userId, actor.id),
            eq(fighters.isActive, true),
            isNull(fighters.deletedAt),
          ),
        )
        .limit(1);
      return row !== undefined;
    }

    const now = new Date();
    if (actor.role === USER.COACH) {
      const [row] = await this.db
        .select({ id: coachFighters.id })
        .from(coachFighters)
        .innerJoin(coaches, eq(coachFighters.coachId, coaches.id))
        .where(
          and(
            eq(coaches.userId, actor.id),
            eq(coaches.isActive, true),
            isNull(coaches.deletedAt),
            eq(coachFighters.fighterId, fighterId),
            lte(coachFighters.startsAt, now),
            or(isNull(coachFighters.endsAt), gt(coachFighters.endsAt, now)),
          ),
        )
        .limit(1);
      return row !== undefined;
    }

    if (actor.role === USER.DOCTOR) {
      const [row] = await this.db
        .select({ id: doctorFighters.id })
        .from(doctorFighters)
        .innerJoin(sportsDoctors, eq(doctorFighters.doctorId, sportsDoctors.id))
        .where(
          and(
            eq(sportsDoctors.userId, actor.id),
            eq(sportsDoctors.isActive, true),
            isNull(sportsDoctors.deletedAt),
            eq(doctorFighters.fighterId, fighterId),
            lte(doctorFighters.startsAt, now),
            or(isNull(doctorFighters.endsAt), gt(doctorFighters.endsAt, now)),
          ),
        )
        .limit(1);
      return row !== undefined;
    }

    return false;
  }

  async assertFighterAccess(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (!(await this.canAccessFighter(actor, fighterId))) throw forbidden();
  }
}
