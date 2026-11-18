import { deriveMedicalStatus } from './medical-status.js';

const base = { injuryStatuses: [], activeRecoveryPlans: 0, trainingEligible: true, restricted: false } as const;

describe('deriveMedicalStatus', () => {
  it('first match wins: injury, not cleared, recovery, restricted, healthy', () => {
    expect(deriveMedicalStatus({ ...base, injuryStatuses: ['ACTIVE'], trainingEligible: false })).toBe('INJURED');
    expect(deriveMedicalStatus({ ...base, trainingEligible: false, activeRecoveryPlans: 1 })).toBe('NOT_CLEARED');
    expect(deriveMedicalStatus({ ...base, injuryStatuses: ['RECOVERING'], restricted: true })).toBe('RECOVERY');
    expect(deriveMedicalStatus({ ...base, activeRecoveryPlans: 1 })).toBe('RECOVERY');
    expect(deriveMedicalStatus({ ...base, restricted: true })).toBe('MONITORING');
    expect(deriveMedicalStatus(base)).toBe('HEALTHY');
  });
});
