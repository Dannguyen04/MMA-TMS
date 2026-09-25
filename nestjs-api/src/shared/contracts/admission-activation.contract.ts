export const ADMISSION_ACTIVATION_PORT = Symbol('ADMISSION_ACTIVATION_PORT');

export interface AdmissionActivationClaim {
  applicationId: string;
  activationId: string;
  /** Verified Supabase subject, used as the audit actor for the follow-up write. */
  authSubject: string;
}

export type AdmissionActivationClaimResult =
  | { outcome: 'CLAIMED'; claim: AdmissionActivationClaim }
  | { outcome: 'NOT_APPLICABLE' }
  | { outcome: 'ALREADY_PASSWORD_SET' }
  | { outcome: 'ALREADY_COMPLETED' }
  | { outcome: 'CLAIMED_BY_ANOTHER_REQUEST' };

/**
 * Narrow port the Auth module uses to advance an admission activation while a
 * password recovery is being redeemed. Auth never queries admission tables
 * directly; the owning module keeps its persistence.
 */
export interface AdmissionActivationPort {
  /**
   * Resolves the approved application for the verified subject and atomically
   * claims its activation (`PENDING` -> `IN_PROGRESS`) before the identity
   * provider is called, so two concurrent redemptions cannot both proceed.
   */
  claimPendingActivation(
    authSubject: string,
    requestId: string,
  ): Promise<AdmissionActivationClaimResult>;

  /** `IN_PROGRESS` -> `PASSWORD_SET` after the provider confirmed the change. */
  markPasswordSet(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<void>;

  /** `IN_PROGRESS` -> `PENDING` when the provider did not change the password. */
  releaseClaim(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<void>;
}
