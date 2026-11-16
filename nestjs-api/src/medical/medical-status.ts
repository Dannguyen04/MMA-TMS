import type { medicalStatuses } from '../fighters/fighters.model.js';

export type MedicalStatusValue = (typeof medicalStatuses)[number];

export interface MedicalStatusFacts {
  /** Statuses of the Fighter's ACTIVE and RECOVERING injuries. */
  injuryStatuses: readonly ('ACTIVE' | 'RECOVERING')[];
  activeRecoveryPlans: number;
  /** Current TRAINING eligibility (the same rule as the training start gate). */
  trainingEligible: boolean;
  /** The current TRAINING examination allows training only with restrictions. */
  restricted: boolean;
}

/**
 * `fighters.current_medical_status` is the summary staff lists, filters and
 * counts read. It predates the clinical module and nothing kept it in step, so
 * an injured, uncleared Fighter could still read HEALTHY (2026-11-13). It is now
 * derived from the clinical record, first match wins:
 *
 * 1. an ACTIVE injury → INJURED
 * 2. not eligible to train → NOT_CLEARED
 * 3. a RECOVERING injury or an active recovery plan → RECOVERY
 * 4. cleared with restrictions → MONITORING
 * 5. otherwise → HEALTHY
 */
export function deriveMedicalStatus(facts: MedicalStatusFacts): MedicalStatusValue {
  if (facts.injuryStatuses.includes('ACTIVE')) return 'INJURED';
  if (!facts.trainingEligible) return 'NOT_CLEARED';
  if (facts.injuryStatuses.includes('RECOVERING') || facts.activeRecoveryPlans > 0) {
    return 'RECOVERY';
  }
  if (facts.restricted) return 'MONITORING';
  return 'HEALTHY';
}
