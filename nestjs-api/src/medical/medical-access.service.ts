import { Injectable } from '@nestjs/common';
import { fighterNotFound, medicalAccessDenied } from '../fighters/fighters.error.js';
import { forbidden } from '../shared/errors/access.error.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import type { Transaction } from '../shared/utils/audit-context.util.js';
import type { MedicalReadView } from './medical.constants.js';
import { medicalOperationFailed } from './medical.error.js';
import { MedicalRepository } from './medical.repo.js';

interface FighterRef {
  id: string;
  userId: string;
}

/**
 * Resource-level Medical policy applied after the Permission Guard.
 *
 * READ (D1): ADMIN all; FIGHTER self; COACH/DOCTOR only through a currently
 * effective assignment. WRITE (D2): only a DOCTOR with an active profile and a
 * currently effective assignment, whatever permissions or overrides the actor
 * holds.
 */
@Injectable()
export class MedicalAccessService {
  constructor(private readonly repo: MedicalRepository) {}

  async requireFighter(fighterId: string): Promise<FighterRef> {
    const fighter = await this.repo.findFighter(fighterId);
    if (!fighter) throw fighterNotFound();
    return fighter;
  }

  async canReadFighter(
    actor: AuthenticatedUser,
    fighter: FighterRef,
  ): Promise<boolean> {
    switch (actor.role) {
      case USER.ADMIN:
        return true;
      case USER.FIGHTER:
        return fighter.userId === actor.id;
      case USER.COACH:
        return this.repo.isCoachUserAssignedToFighter(actor.id, fighter.id);
      case USER.DOCTOR:
        return this.repo.isDoctorUserAssignedToFighter(actor.id, fighter.id);
      default:
        return false;
    }
  }

  /** Non-clinical reads in the same scope (e.g. assignment history). */
  async assertReadScope(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    const fighter = await this.requireFighter(fighterId);
    if (!(await this.canReadFighter(actor, fighter))) throw forbidden();
  }

  /**
   * Clinical reads: scope check plus a fail-closed access audit that records
   * metadata only (who, which Fighter, which view), never clinical content.
   */
  async authorizeClinicalRead(
    actor: AuthenticatedUser,
    fighterId: string,
    view: MedicalReadView,
    requestId: string,
  ): Promise<void> {
    const fighter = await this.requireFighter(fighterId);
    if (!(await this.canReadFighter(actor, fighter))) {
      throw medicalAccessDenied();
    }
    try {
      await this.repo.insertMedicalReadAudit(
        actor.id,
        fighterId,
        view,
        requestId,
      );
    } catch {
      throw medicalOperationFailed();
    }
  }

  /**
   * Doctor-only write eligibility, verified inside the write transaction. The
   * assignment row is share-locked so a concurrent end waits for this write.
   * Returns the Doctor profile id used as clinical author.
   */
  async requireAssignedDoctor(
    actor: AuthenticatedUser,
    fighterId: string,
    transaction: Transaction,
  ): Promise<string> {
    if (actor.role !== USER.DOCTOR) throw forbidden();
    const doctorId = await this.repo.findActiveDoctorIdByUserId(
      actor.id,
      transaction,
    );
    if (!doctorId) throw forbidden();
    const assigned = await this.repo.lockEffectiveDoctorAssignment(
      doctorId,
      fighterId,
      transaction,
    );
    if (!assigned) throw forbidden();
    return doctorId;
  }

  /** D9: Fighter for self; Coach/Doctor for currently assigned Fighters. */
  async assertReviewRequestScope(
    actor: AuthenticatedUser,
    fighter: FighterRef,
    transaction: Transaction,
  ): Promise<void> {
    let allowed = false;
    if (actor.role === USER.FIGHTER) {
      allowed = fighter.userId === actor.id;
    } else if (actor.role === USER.COACH) {
      allowed = await this.repo.isCoachUserAssignedToFighter(
        actor.id,
        fighter.id,
        transaction,
      );
    } else if (actor.role === USER.DOCTOR) {
      allowed = await this.repo.isDoctorUserAssignedToFighter(
        actor.id,
        fighter.id,
        transaction,
      );
    }
    if (!allowed) throw forbidden();
  }

  /** Doctor scoping for mixed Fighter profile reads; no-op for other roles. */
  async assertDoctorFighterScope(
    actor: AuthenticatedUser,
    fighterId: string,
  ): Promise<void> {
    if (actor.role !== USER.DOCTOR) return;
    const assigned = await this.repo.isDoctorUserAssignedToFighter(
      actor.id,
      fighterId,
    );
    if (!assigned) throw forbidden();
  }
}
