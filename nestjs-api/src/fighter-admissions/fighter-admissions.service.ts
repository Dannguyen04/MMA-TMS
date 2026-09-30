import {
  forwardRef,
  HttpException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  AdmissionActivationClaim,
  AdmissionActivationClaimResult,
  AdmissionActivationPort,
} from '../shared/contracts/admission-activation.contract.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { FIGHTER_PERMISSIONS } from '../fighters/fighters.model.js';
import {
  NOTIFICATION_PUBLISHER,
  NOTIFICATION_TARGET,
  NOTIFICATION_TYPE,
  type NotificationPublisher,
  type NotifyInput,
} from '../shared/contracts/notification.contract.js';
import {
  RECOVERY_EMAIL_SERVICE,
  type RecoveryEmailService,
} from '../shared/contracts/recovery-email.contract.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  setAuditContext,
  type Transaction,
} from '../shared/utils/audit-context.util.js';
import { UsersService } from '../users/users.service.js';
import {
  ACTIVATION_CLAIM_STALE_MS,
  ACTIVATION_STATUS,
  ADMIN_DECISION,
  ADMISSION_NOTIFICATION_TEXT,
  APPLICATION_STATUS,
  ASSESSMENT_CONCLUSION,
  RECOVERY_RESEND_COOLDOWN_MS,
} from './fighter-admissions.constants.js';
import {
  activationInProgress,
  activationNotApproved,
  activationPasswordNotSet,
  activationStateConflict,
  applicationNotAssignedToCoach,
  applicationNotFound,
  applicationStateConflict,
  assessmentAlreadySubmitted,
  assignmentLockedByAssessment,
  coachNotAssignable,
  decisionAlreadyRecorded,
  decisionRequiresPass,
  mapAdmissionPersistenceError,
  admissionOperationFailed,
  openApplicationExists,
  reassignmentReasonRequired,
  resendCooldownActive,
} from './fighter-admissions.error.js';
import type {
  ActivationResponse,
  ApplicantApplication,
  AssessmentCriterion,
  AssignCoachInput,
  ListApplicationsQuery,
  ListOwnApplicationsQuery,
  RecoveryEmailStatus,
  StaffApplication,
  SubmitApplicationInput,
  SubmitAssessmentInput,
  SubmitDecisionInput,
} from './fighter-admissions.model.js';
import { FighterAdmissionsRepository } from './fighter-admissions.repo.js';

type ApplicationRow = NonNullable<
  Awaited<ReturnType<FighterAdmissionsRepository['findApplicationById']>>
>;

/** What an assignment write actually changed; undefined for a same-Coach no-op. */
interface AssignmentChange {
  assignmentId: string;
  coachId: string;
  previous?: { assignmentId: string; coachId: string };
}

@Injectable()
export class FighterAdmissionsService implements AdmissionActivationPort {
  private readonly logger = new Logger(FighterAdmissionsService.name);

  constructor(
    private readonly repository: FighterAdmissionsRepository,
    private readonly usersService: UsersService,
    // Circular with AuthService (see the matching comment there for why
    // forwardRef is required at this injection site, not just on the module).
    @Inject(forwardRef(() => RECOVERY_EMAIL_SERVICE))
    private readonly recoveryEmail: RecoveryEmailService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
    private readonly authorization: AuthorizationService,
  ) {}

  // ── Applicant use cases ───────────────────────────────────────────────────

  async submitApplication(
    actor: AuthenticatedUser,
    input: SubmitApplicationInput,
    requestId: string,
  ): Promise<ApplicantApplication> {
    try {
      const application = await this.repository.transaction(
        async (transaction) => {
          await setAuditContext(actor.authSubject, requestId, transaction);
          if (
            await this.repository.hasOpenApplication(actor.id, transaction)
          ) {
            throw openApplicationExists();
          }
          // The snapshot email is the verified account email, never a body value.
          return this.repository.insertApplication(
            { ...input, guestUserId: actor.id, email: actor.email },
            transaction,
          );
        },
      );
      // After commit; the publisher never throws.
      await this.notifyApplicationSubmitted(actor, application.id, requestId);
      return this.toApplicantView(application, null, null, null);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async listOwnApplications(
    actor: AuthenticatedUser,
    query: ListOwnApplicationsQuery,
  ) {
    const { items, total } = await this.repository.listApplicationsByGuest(
      actor.id,
      query,
    );
    const views = await Promise.all(
      items.map((application) => this.loadApplicantView(application)),
    );
    return { items: views, total, page: query.page, limit: query.limit };
  }

  async getOwnApplication(
    actor: AuthenticatedUser,
    applicationId: string,
  ): Promise<ApplicantApplication> {
    const application =
      await this.repository.findApplicationById(applicationId);
    if (!application || application.guestUserId !== actor.id) {
      throw applicationNotFound();
    }
    return this.loadApplicantView(application);
  }

  /**
   * Completes an approved admission after the password was verifiably changed
   * through the recovery flow. Every call re-authenticates through the guard and
   * re-reads the locked state; nothing is assumed from a previous request.
   */
  async activate(
    actor: AuthenticatedUser,
    requestId: string,
  ): Promise<ActivationResponse> {
    try {
      const result = await this.repository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        const row = await this.repository.lockActivationByGuestUserId(
          actor.id,
          transaction,
        );
        if (!row) throw activationNotApproved();

        const { activation, application } = row;
        if (activation.status === ACTIVATION_STATUS.COMPLETED) {
          return {
            applicationId: application.id,
            status: ACTIVATION_STATUS.COMPLETED,
            role: 'FIGHTER' as const,
            alreadyActive: true,
          };
        }
        if (activation.status === ACTIVATION_STATUS.IN_PROGRESS) {
          throw activationInProgress();
        }
        if (activation.status !== ACTIVATION_STATUS.PASSWORD_SET) {
          throw activationPasswordNotSet();
        }

        await this.usersService.promoteGuestToFighter(
          application.guestUserId,
          {
            firstName: application.firstName,
            lastName: application.lastName,
            dateOfBirth: application.dateOfBirth,
            weightClass: application.weightClass,
            nationality: application.nationality,
          },
          transaction,
        );

        const completed = await this.repository.advanceActivationStatus(
          activation.id,
          ACTIVATION_STATUS.PASSWORD_SET,
          ACTIVATION_STATUS.COMPLETED,
          transaction,
        );
        if (!completed) throw activationStateConflict();

        const activated = await this.repository.advanceApplicationStatus(
          application.id,
          APPLICATION_STATUS.APPROVED,
          APPLICATION_STATUS.ACTIVATED,
          transaction,
        );
        if (!activated) throw applicationStateConflict();

        return {
          applicationId: application.id,
          status: ACTIVATION_STATUS.COMPLETED,
          role: 'FIGHTER' as const,
          alreadyActive: false,
        };
      });
      // Only the first completion hands the new Fighter over; a replayed
      // activation (alreadyActive) notifies nobody.
      if (!result.alreadyActive) {
        await this.notifyActivationCompleted(
          actor,
          result.applicationId,
          requestId,
        );
      }
      return result;
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  // ── Admin use cases ───────────────────────────────────────────────────────

  async listApplications(query: ListApplicationsQuery) {
    const { items, total } = await this.repository.listApplications(
      { status: query.status },
      query,
    );
    const views = await Promise.all(
      items.map((application) => this.loadStaffView(application)),
    );
    return { items: views, total, page: query.page, limit: query.limit };
  }

  async getApplication(applicationId: string): Promise<StaffApplication> {
    const application =
      await this.repository.findApplicationById(applicationId);
    if (!application) throw applicationNotFound();
    return this.loadStaffView(application);
  }

  async assignCoach(
    actor: AuthenticatedUser,
    applicationId: string,
    input: AssignCoachInput,
    requestId: string,
  ): Promise<StaffApplication> {
    try {
      const change = await this.repository.transaction(
        async (transaction): Promise<AssignmentChange | undefined> => {
          await setAuditContext(actor.authSubject, requestId, transaction);
          const application = await this.repository.lockApplication(
            applicationId,
            transaction,
          );
          if (!application) throw applicationNotFound();
          if (application.status !== APPLICATION_STATUS.SUBMITTED) {
            throw applicationStateConflict();
          }
          if (
            await this.repository.findAssessmentByApplication(
              applicationId,
              transaction,
            )
          ) {
            throw assignmentLockedByAssessment();
          }
          if (
            !(await this.repository.findActiveCoachById(
              input.coachId,
              transaction,
            ))
          ) {
            throw coachNotAssignable();
          }

          const open = await this.repository.findOpenAssignment(
            applicationId,
            transaction,
          );
          if (open?.coachId === input.coachId) return undefined;
          if (open) {
            const reason = input.reassignmentReason?.trim();
            if (!reason) throw reassignmentReasonRequired();
            const closed = await this.repository.closeOpenAssignment(
              applicationId,
              { endedById: actor.id, endReason: reason },
              transaction,
            );
            if (!closed) throw applicationStateConflict();
          }

          const assignment = await this.repository.insertAssignment(
            {
              applicationId,
              coachId: input.coachId,
              assignedById: actor.id,
            },
            transaction,
          );
          return {
            assignmentId: assignment.id,
            coachId: input.coachId,
            previous: open
              ? { assignmentId: open.id, coachId: open.coachId }
              : undefined,
          };
        },
      );
      // A same-Coach request changes nothing and notifies nobody.
      if (change) {
        await this.notifyAssessmentAssignment(
          actor,
          applicationId,
          change,
          requestId,
        );
      }
      return this.getApplication(applicationId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  async submitDecision(
    actor: AuthenticatedUser,
    applicationId: string,
    input: SubmitDecisionInput,
    requestId: string,
  ): Promise<StaffApplication> {
    let approvedActivation:
      | { id: string; applicationId: string; guestUserId: string }
      | undefined;
    let recorded: { decisionId: string; guestUserId: string } | undefined;

    try {
      await this.repository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        const application = await this.repository.lockApplication(
          applicationId,
          transaction,
        );
        if (!application) throw applicationNotFound();
        if (application.status !== APPLICATION_STATUS.PASSED) {
          throw applicationStateConflict();
        }
        if (
          await this.repository.findDecisionByApplication(
            applicationId,
            transaction,
          )
        ) {
          throw decisionAlreadyRecorded();
        }

        const assessment = await this.repository.findAssessmentByApplication(
          applicationId,
          transaction,
        );
        if (!assessment || assessment.conclusion !== ASSESSMENT_CONCLUSION.PASS) {
          throw decisionRequiresPass();
        }

        const decision = await this.repository.insertDecision(
          {
            applicationId,
            assessmentId: assessment.id,
            adminId: actor.id,
            decision: input.decision,
            reason: input.reason,
          },
          transaction,
        );

        const nextStatus =
          input.decision === ADMIN_DECISION.APPROVED
            ? APPLICATION_STATUS.APPROVED
            : APPLICATION_STATUS.REJECTED;
        const advanced = await this.repository.advanceApplicationStatus(
          applicationId,
          APPLICATION_STATUS.PASSED,
          nextStatus,
          transaction,
        );
        if (!advanced) throw applicationStateConflict();
        recorded = {
          decisionId: decision.id,
          guestUserId: application.guestUserId,
        };

        if (input.decision === ADMIN_DECISION.APPROVED) {
          // The decision and the pending activation commit before any mail is
          // attempted, so a provider failure never rolls back the approval.
          const activation = await this.repository.insertActivation(
            {
              applicationId,
              decisionId: decision.id,
              guestUserId: application.guestUserId,
            },
            transaction,
          );
          approvedActivation = {
            id: activation.id,
            applicationId,
            guestUserId: application.guestUserId,
          };
        }
      });
    } catch (error) {
      throw this.toHttpError(error);
    }

    if (approvedActivation) {
      // The approval is already committed. A mail failure must never reverse it
      // or create a second decision, so the send result is only logged here and
      // the Admin can retry through the resend endpoint.
      try {
        await this.dispatchRecoveryEmail(
          approvedActivation,
          actor.authSubject,
          requestId,
        );
      } catch {
        this.logger.error(
          `Approved application ${applicationId} could not start its recovery email; use the resend endpoint`,
        );
      }
    }
    if (recorded) {
      await this.notifyDecisionRecorded(
        actor,
        applicationId,
        input.decision,
        recorded,
        requestId,
      );
    }
    return this.getApplication(applicationId);
  }

  async resendActivationEmail(
    actor: AuthenticatedUser,
    applicationId: string,
    requestId: string,
  ): Promise<RecoveryEmailStatus> {
    const application =
      await this.repository.findApplicationById(applicationId);
    if (!application) throw applicationNotFound();

    const activation =
      await this.repository.findActivationByApplication(applicationId);
    if (!activation) throw activationNotApproved();

    // No pre-read cooldown check: the state and the cooldown are both enforced
    // by the conditional claim inside dispatchRecoveryEmail, so two concurrent
    // resends cannot both send a mail.
    try {
      return await this.dispatchRecoveryEmail(
        {
          id: activation.id,
          applicationId,
          guestUserId: activation.guestUserId,
        },
        actor.authSubject,
        requestId,
      );
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  // ── Assigned coach use cases ──────────────────────────────────────────────

  async listAssignedApplications(
    actor: AuthenticatedUser,
    query: ListOwnApplicationsQuery,
  ) {
    const coach = await this.requireCoach(actor);
    const { items, total } = await this.repository.listApplicationsForCoach(
      coach.id,
      query,
    );
    const views = await Promise.all(
      items.map((application) => this.loadStaffView(application)),
    );
    return { items: views, total, page: query.page, limit: query.limit };
  }

  async getAssignedApplication(
    actor: AuthenticatedUser,
    applicationId: string,
  ): Promise<StaffApplication> {
    const coach = await this.requireCoach(actor);
    const application =
      await this.repository.findApplicationById(applicationId);
    if (!application) throw applicationNotFound();

    const open = await this.repository.findOpenAssignment(applicationId);
    if (open?.coachId !== coach.id) throw applicationNotAssignedToCoach();
    return this.loadStaffView(application);
  }

  async submitAssessment(
    actor: AuthenticatedUser,
    applicationId: string,
    input: SubmitAssessmentInput,
    requestId: string,
  ): Promise<StaffApplication> {
    const coach = await this.requireCoach(actor);
    try {
      const assessed = await this.repository.transaction(async (transaction) => {
        await setAuditContext(actor.authSubject, requestId, transaction);
        const application = await this.repository.lockApplication(
          applicationId,
          transaction,
        );
        if (!application) throw applicationNotFound();
        if (application.status !== APPLICATION_STATUS.SUBMITTED) {
          throw applicationStateConflict();
        }

        // Read under the application lock so a concurrent reassignment cannot
        // let the previous coach record the conclusion.
        const open = await this.repository.findOpenAssignment(
          applicationId,
          transaction,
        );
        if (!open || open.coachId !== coach.id) {
          throw applicationNotAssignedToCoach();
        }
        if (
          await this.repository.findAssessmentByApplication(
            applicationId,
            transaction,
          )
        ) {
          throw assessmentAlreadySubmitted();
        }

        const assessment = await this.repository.insertAssessment(
          {
            applicationId,
            assignmentId: open.id,
            coachId: coach.id,
            conclusion: input.conclusion,
            summary: input.summary,
            criteria: input.criteria,
          },
          transaction,
        );

        const nextStatus =
          input.conclusion === ASSESSMENT_CONCLUSION.PASS
            ? APPLICATION_STATUS.PASSED
            : APPLICATION_STATUS.FAILED;
        const advanced = await this.repository.advanceApplicationStatus(
          applicationId,
          APPLICATION_STATUS.SUBMITTED,
          nextStatus,
          transaction,
        );
        if (!advanced) throw applicationStateConflict();
        return {
          assessmentId: assessment.id,
          guestUserId: application.guestUserId,
        };
      });
      await this.notifyAssessmentRecorded(
        actor,
        applicationId,
        input.conclusion,
        assessed,
        requestId,
      );
      return this.getApplication(applicationId);
    } catch (error) {
      throw this.toHttpError(error);
    }
  }

  // ── AdmissionActivationPort (used by the Auth recovery flow) ──────────────

  async claimPendingActivation(
    authSubject: string,
    requestId: string,
  ): Promise<AdmissionActivationClaimResult> {
    try {
      return await this.repository.transaction(async (transaction) => {
        await setAuditContext(authSubject, requestId, transaction);
        const row = await this.repository.lockActivationByAuthSubject(
          authSubject,
          transaction,
        );
        if (!row) return { outcome: 'NOT_APPLICABLE' as const };

        const { activation, application } = row;
        if (activation.status === ACTIVATION_STATUS.COMPLETED) {
          return { outcome: 'ALREADY_COMPLETED' as const };
        }
        if (activation.status === ACTIVATION_STATUS.PASSWORD_SET) {
          return { outcome: 'ALREADY_PASSWORD_SET' as const };
        }
        if (activation.status === ACTIVATION_STATUS.IN_PROGRESS) {
          // A claim whose request never reported an outcome (process died
          // between claiming and recording) is released after the stale window
          // so the applicant can redeem a new recovery link. Releasing only
          // returns the row to PENDING; PASSWORD_SET still requires a confirmed
          // provider password change.
          const released = await this.repository.releaseStaleClaim(
            activation.id,
            new Date(Date.now() - ACTIVATION_CLAIM_STALE_MS),
            transaction,
          );
          if (!released) {
            return { outcome: 'CLAIMED_BY_ANOTHER_REQUEST' as const };
          }
        }

        const claimed = await this.repository.advanceActivationStatus(
          activation.id,
          ACTIVATION_STATUS.PENDING,
          ACTIVATION_STATUS.IN_PROGRESS,
          transaction,
        );
        if (!claimed) return { outcome: 'CLAIMED_BY_ANOTHER_REQUEST' as const };

        return {
          outcome: 'CLAIMED' as const,
          claim: {
            applicationId: application.id,
            activationId: activation.id,
            authSubject,
          },
        };
      });
    } catch (error) {
      this.logger.error('Failed to evaluate admission activation claim');
      throw this.toHttpError(error);
    }
  }

  async markPasswordSet(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<void> {
    await this.repository.transaction(async (transaction) => {
      await setAuditContext(claim.authSubject, requestId, transaction);
      const activation = await this.repository.lockActivationByApplication(
        claim.applicationId,
        transaction,
      );
      if (!activation) throw activationNotApproved();
      if (
        activation.status === ACTIVATION_STATUS.PASSWORD_SET ||
        activation.status === ACTIVATION_STATUS.COMPLETED
      ) {
        return;
      }
      if (activation.status !== ACTIVATION_STATUS.IN_PROGRESS) {
        throw activationStateConflict();
      }
      const updated = await this.repository.advanceActivationStatus(
        activation.id,
        ACTIVATION_STATUS.IN_PROGRESS,
        ACTIVATION_STATUS.PASSWORD_SET,
        transaction,
      );
      if (!updated) throw activationStateConflict();
    });
  }

  async releaseClaim(
    claim: AdmissionActivationClaim,
    requestId: string,
  ): Promise<void> {
    await this.repository.transaction(async (transaction) => {
      await setAuditContext(claim.authSubject, requestId, transaction);
      const activation = await this.repository.lockActivationByApplication(
        claim.applicationId,
        transaction,
      );
      if (!activation) return;
      if (activation.status !== ACTIVATION_STATUS.IN_PROGRESS) return;
      await this.repository.advanceActivationStatus(
        activation.id,
        ACTIVATION_STATUS.IN_PROGRESS,
        ACTIVATION_STATUS.PENDING,
        transaction,
      );
    });
  }

  // Post-commit; lookups run inside notifyResolved so no failure reaches the response.

  /** A1 — every active Admin. */
  private notifyApplicationSubmitted(
    actor: AuthenticatedUser,
    applicationId: string,
    requestId: string,
  ) {
    return this.notifications.notifyResolved(
      async () => [
        {
          recipientUserIds: await this.repository.findActiveAdminUserIds(),
          actorUserId: actor.id,
          type: NOTIFICATION_TYPE.ADMISSION_APPLICATION_SUBMITTED,
          ...ADMISSION_NOTIFICATION_TEXT.APPLICATION_SUBMITTED,
          target: {
            type: NOTIFICATION_TARGET.FIGHTER_APPLICATION,
            id: applicationId,
          },
          dedupeKey: `application:${applicationId}`,
        },
      ],
      { correlationId: requestId },
    );
  }

  /** A2 — the replaced Coach gets no link to the application it can no longer read. */
  private notifyAssessmentAssignment(
    actor: AuthenticatedUser,
    applicationId: string,
    change: AssignmentChange,
    requestId: string,
  ) {
    return this.notifications.notifyResolved(
      async () => {
        const coachUserIds = await this.repository.findCoachUserIds(
          change.previous
            ? [change.coachId, change.previous.coachId]
            : [change.coachId],
        );
        const recipientsOf = (coachId: string) => {
          const userId = coachUserIds.get(coachId);
          return userId ? [userId] : [];
        };
        const inputs: NotifyInput[] = [
          {
            recipientUserIds: recipientsOf(change.coachId),
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.ADMISSION_ASSESSMENT_ASSIGNED,
            ...ADMISSION_NOTIFICATION_TEXT.ASSESSMENT_ASSIGNED,
            target: {
              type: NOTIFICATION_TARGET.FIGHTER_APPLICATION,
              id: applicationId,
            },
            dedupeKey: `assignment:${change.assignmentId}`,
          },
        ];
        if (change.previous) {
          inputs.push({
            recipientUserIds: recipientsOf(change.previous.coachId),
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.ADMISSION_ASSESSMENT_UNASSIGNED,
            ...ADMISSION_NOTIFICATION_TEXT.ASSESSMENT_UNASSIGNED,
            dedupeKey: `assignment:${change.previous.assignmentId}`,
          });
        }
        return inputs;
      },
      { correlationId: requestId },
    );
  }

  /** A3/A4 — applicant; on PASS also every active Admin. */
  private notifyAssessmentRecorded(
    actor: AuthenticatedUser,
    applicationId: string,
    conclusion: 'PASS' | 'FAIL',
    assessed: { assessmentId: string; guestUserId: string },
    requestId: string,
  ) {
    const passed = conclusion === ASSESSMENT_CONCLUSION.PASS;
    const target = {
      type: NOTIFICATION_TARGET.FIGHTER_APPLICATION,
      id: applicationId,
    };
    const dedupeKey = `assessment:${assessed.assessmentId}`;
    return this.notifications.notifyResolved(
      async () => {
        const inputs: NotifyInput[] = [
          {
            recipientUserIds: [assessed.guestUserId],
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.ADMISSION_ASSESSMENT_RESULT,
            ...(passed
              ? ADMISSION_NOTIFICATION_TEXT.ASSESSMENT_PASSED
              : ADMISSION_NOTIFICATION_TEXT.ASSESSMENT_FAILED),
            target,
            data: { conclusion },
            dedupeKey,
          },
        ];
        if (passed) {
          inputs.push({
            recipientUserIds: await this.repository.findActiveAdminUserIds(),
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.ADMISSION_DECISION_REQUIRED,
            ...ADMISSION_NOTIFICATION_TEXT.DECISION_REQUIRED,
            target,
            dedupeKey,
          });
        }
        return inputs;
      },
      { correlationId: requestId },
    );
  }

  /** A5 — the text never claims the recovery email reached the inbox. */
  private notifyDecisionRecorded(
    actor: AuthenticatedUser,
    applicationId: string,
    decision: 'APPROVED' | 'REJECTED',
    recorded: { decisionId: string; guestUserId: string },
    requestId: string,
  ) {
    return this.notifications.notify(
      {
        recipientUserIds: [recorded.guestUserId],
        actorUserId: actor.id,
        type: NOTIFICATION_TYPE.ADMISSION_DECISION_RECORDED,
        ...(decision === ADMIN_DECISION.APPROVED
          ? ADMISSION_NOTIFICATION_TEXT.DECISION_APPROVED
          : ADMISSION_NOTIFICATION_TEXT.DECISION_REJECTED),
        target: {
          type: NOTIFICATION_TARGET.FIGHTER_APPLICATION,
          id: applicationId,
        },
        data: { decision },
        dedupeKey: `decision:${recorded.decisionId}`,
      },
      { correlationId: requestId },
    );
  }

  // A6 — only Admins with effective `fighter.coach:assign`; a lookup error fails
  // this notification and never widens it to every Admin.
  private notifyActivationCompleted(
    actor: AuthenticatedUser,
    applicationId: string,
    requestId: string,
  ) {
    return this.notifications.notifyResolved(
      async () => {
        const [recipientUserIds, fighterId] = await Promise.all([
          this.authorization.findActiveUserIdsWithPermission(
            USER.ADMIN,
            FIGHTER_PERMISSIONS.COACHES_ASSIGN,
          ),
          this.repository.findFighterIdByUserId(actor.id),
        ]);
        return [
          {
            recipientUserIds,
            actorUserId: actor.id,
            type: NOTIFICATION_TYPE.ADMISSION_ACTIVATION_COMPLETED,
            ...ADMISSION_NOTIFICATION_TEXT.ACTIVATION_COMPLETED,
            target: fighterId
              ? { type: NOTIFICATION_TARGET.FIGHTER, id: fighterId }
              : {
                  type: NOTIFICATION_TARGET.FIGHTER_APPLICATION,
                  id: applicationId,
                },
            data: { applicationId },
            dedupeKey: `application:${applicationId}`,
          },
        ];
      },
      { correlationId: requestId },
    );
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async requireCoach(actor: AuthenticatedUser) {
    const coach = await this.repository.findActiveCoachByUserId(actor.id);
    if (!coach) throw applicationNotAssignedToCoach();
    return coach;
  }

  /**
   * Three distinct facts are tracked here and never collapsed:
   *   - claimed/attempted: this backend decided to send and reserved the slot;
   *   - accepted: the identity provider took the request;
   *   - delivered: not observable from the backend and never asserted.
   *
   * The cooldown and the attempt counter are claimed in a short transaction
   * *before* the provider call, so two concurrent requests cannot both send. No
   * transaction is held open across the network call. If the process dies after
   * claiming, the attempt stays recorded without an acceptance and the next
   * send is simply possible once the cooldown expires. If it dies after the
   * provider accepted, the acceptance is lost but the mail was still sent, so
   * the cooldown correctly prevents an immediate duplicate.
   */
  private async dispatchRecoveryEmail(
    activation: { id: string; applicationId: string; guestUserId: string },
    authSubject: string,
    requestId: string,
  ): Promise<RecoveryEmailStatus> {
    // The link must reach the address that currently owns the account, which
    // may differ from the snapshot captured when the application was submitted.
    const accountEmail = await this.repository.findAccountEmail(
      activation.guestUserId,
    );
    if (!accountEmail) throw activationNotApproved();

    const claimed = await this.repository.transaction(async (transaction) => {
      await setAuditContext(authSubject, requestId, transaction);
      await this.releaseStaleClaimIfAny(activation.id, transaction);
      return this.repository.claimRecoverySend(
        activation.id,
        RECOVERY_RESEND_COOLDOWN_MS,
        transaction,
      );
    });
    if (!claimed) {
      await this.throwRecoveryClaimConflict(activation.applicationId);
      throw admissionOperationFailed();
    }

    const { accepted } = await this.recoveryEmail.sendPasswordRecoveryEmail(
      accountEmail,
    );
    if (!accepted) {
      this.logger.warn(
        `Recovery email for activation ${activation.id} was not accepted by the provider`,
      );
      return {
        applicationId: activation.applicationId,
        accepted: false,
        recoveryAttempts: claimed.recoveryAttempts,
        attemptedAt: claimed.attemptedAt ?? new Date(),
      };
    }

    const marked = await this.repository.transaction(async (transaction) => {
      await setAuditContext(authSubject, requestId, transaction);
      return this.repository.markRecoveryAccepted(activation.id, transaction);
    });
    return {
      applicationId: activation.applicationId,
      accepted: true,
      recoveryAttempts: (marked ?? claimed).recoveryAttempts,
      attemptedAt: (marked ?? claimed).attemptedAt ?? new Date(),
    };
  }

  /** Classifies a failed send claim from the activation's real current state. */
  private async throwRecoveryClaimConflict(
    applicationId: string,
  ): Promise<never> {
    const current =
      await this.repository.findActivationByApplication(applicationId);
    if (!current) throw activationNotApproved();
    if (current.status === ACTIVATION_STATUS.COMPLETED) {
      throw activationStateConflict();
    }
    if (current.status === ACTIVATION_STATUS.PASSWORD_SET) {
      throw activationStateConflict();
    }
    if (current.status === ACTIVATION_STATUS.IN_PROGRESS) {
      throw activationInProgress();
    }
    throw resendCooldownActive();
  }

  private async releaseStaleClaimIfAny(
    activationId: string,
    transaction: Transaction,
  ): Promise<void> {
    await this.repository.releaseStaleClaim(
      activationId,
      new Date(Date.now() - ACTIVATION_CLAIM_STALE_MS),
      transaction,
    );
  }

  private async loadApplicantView(
    application: ApplicationRow,
  ): Promise<ApplicantApplication> {
    const [assessment, decision, activation] = await Promise.all([
      this.repository.findAssessmentByApplication(application.id),
      this.repository.findDecisionByApplication(application.id),
      this.repository.findActivationByApplication(application.id),
    ]);
    return this.toApplicantView(
      application,
      assessment ?? null,
      decision ?? null,
      activation ?? null,
    );
  }

  private toApplicantView(
    application: ApplicationRow,
    assessment: { conclusion: 'PASS' | 'FAIL'; assessedAt: Date } | null,
    decision: { decision: 'APPROVED' | 'REJECTED'; decidedAt: Date } | null,
    activation: { status: string } | null,
  ): ApplicantApplication {
    return {
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt,
      applicant: this.toSnapshot(application),
      // Staff notes stay out of the applicant view; only outcomes are shared.
      assessment: assessment
        ? {
            conclusion: assessment.conclusion,
            assessedAt: assessment.assessedAt,
          }
        : null,
      decision: decision
        ? { decision: decision.decision, decidedAt: decision.decidedAt }
        : null,
      activation: activation ? { status: activation.status } : null,
    } as ApplicantApplication;
  }

  private async loadStaffView(
    application: ApplicationRow,
  ): Promise<StaffApplication> {
    const [assignments, assessment, decision, activation, accountEmail] =
      await Promise.all([
        this.repository.listAssignments(application.id),
        this.repository.findAssessmentByApplication(application.id),
        this.repository.findDecisionByApplication(application.id),
        this.repository.findActivationByApplication(application.id),
        this.repository.findAccountEmail(application.guestUserId),
      ]);
    const current = assignments.find((assignment) => !assignment.endsAt);

    return {
      id: application.id,
      guestUserId: application.guestUserId,
      status: application.status,
      submittedAt: application.submittedAt,
      applicant: this.toSnapshot(application),
      accountEmail: accountEmail ?? null,
      currentAssignment: current
        ? this.toAssignmentView(current)
        : null,
      assignmentHistory: assignments.map((assignment) =>
        this.toAssignmentView(assignment),
      ),
      assessment: assessment
        ? {
            id: assessment.id,
            coachId: assessment.coachId,
            conclusion: assessment.conclusion,
            summary: assessment.summary,
            criteria: assessment.criteria as AssessmentCriterion[],
            assessedAt: assessment.assessedAt,
          }
        : null,
      decision: decision
        ? {
            id: decision.id,
            adminId: decision.adminId,
            decision: decision.decision,
            reason: decision.reason,
            decidedAt: decision.decidedAt,
          }
        : null,
      activation: activation
        ? {
            status: activation.status,
            recoveryAttempts: activation.recoveryAttempts,
            attemptedAt: activation.attemptedAt,
            acceptedAt: activation.acceptedAt,
            completedAt: activation.completedAt,
          }
        : null,
    } as StaffApplication;
  }

  private toAssignmentView(assignment: {
    id: string;
    coachId: string;
    assignedById: string;
    startsAt: Date;
    endsAt: Date | null;
    endedById: string | null;
    endReason: string | null;
  }) {
    return {
      id: assignment.id,
      coachId: assignment.coachId,
      assignedById: assignment.assignedById,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      endedById: assignment.endedById,
      endReason: assignment.endReason,
    };
  }

  private toSnapshot(application: ApplicationRow) {
    return {
      email: application.email,
      firstName: application.firstName,
      lastName: application.lastName,
      dateOfBirth: application.dateOfBirth,
      weightClass: application.weightClass,
      nationality: application.nationality,
      contactPhone: application.contactPhone,
      trainingBackground: application.trainingBackground,
      competitionBackground: application.competitionBackground,
      motivation: application.motivation,
    };
  }

  private toHttpError(error: unknown): HttpException {
    if (error instanceof HttpException) return error;
    return mapAdmissionPersistenceError(error);
  }
}
