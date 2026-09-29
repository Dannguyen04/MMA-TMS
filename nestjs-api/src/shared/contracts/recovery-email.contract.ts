export const RECOVERY_EMAIL_SERVICE = Symbol('RECOVERY_EMAIL_SERVICE');

/**
 * `accepted` means the identity provider accepted the send request. It is not
 * proof that the message reached the mailbox.
 */
export interface RecoveryEmailResult {
  accepted: boolean;
}

export interface RecoveryEmailService {
  sendPasswordRecoveryEmail(email: string): Promise<RecoveryEmailResult>;
}
