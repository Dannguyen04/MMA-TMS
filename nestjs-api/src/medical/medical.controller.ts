import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FighterIdParamsDto } from '../fighters/fighters.dto.js';
import {
  ApiConflictEnvelope,
  ApiForbiddenEnvelope,
  ApiInternalServerErrorEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { MEDICAL_PERMISSIONS } from './medical.constants.js';
import {
  ClearanceDto,
  CreateExaminationDto,
  CreateInjuryDto,
  CreateRecoveryPlanDto,
  CreateReviewRequestDto,
  CreateTreatmentDto,
  ExaminationDto,
  InjuryDto,
  IssueClearanceDto,
  ListExaminationsQueryDto,
  ListMedicalHistoryQueryDto,
  ListReviewRequestsQueryDto,
  MedicalDossierDto,
  MedicalHistoryEntryDto,
  MedicalRecordIdParamsDto,
  RecoveryPlanDto,
  ReviewRequestDto,
  RevokeClearanceDto,
  TreatmentDto,
  UpdateInjuryDto,
  UpdateRecoveryPlanDto,
} from './medical.dto.js';
import { MedicalService } from './medical.service.js';

const READ_SCOPE_FORBIDDEN =
  'Requires fighter.medical:read; ADMIN reads all, FIGHTER only self, COACH/DOCTOR only currently assigned Fighters';
const DOCTOR_WRITE_FORBIDDEN =
  'Only a DOCTOR with an active profile and a currently effective assignment to the Fighter may write, regardless of permission overrides';

@ApiTags('Medical')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class MedicalController {
  constructor(private readonly medicalService: MedicalService) {}

  // --- Reads ---

  @Get('fighters/:id/medical')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get fighter clinical dossier',
    description:
      'Current injuries, active recovery plans, current examination per scope, active clearances, open review requests and TRAINING/COMPETITION eligibility. TRAINING is not eligible until the Fighter has a BASELINE examination on file (EXAMINATION_REQUIRED), whatever created the account; Fighters with a TRAINING examination recorded before migration 016 are exempt once. Current examinations include their details (type, vitals, assessments, baseline SCAT6 with server scores) or null for examinations recorded without details. Contains no AI/ROM data. Every read is access-audited.',
  })
  @ResponseMessage('Get fighter medical dossier successfully')
  @ApiSuccessEnvelope({
    message: 'Get fighter medical dossier successfully',
    model: MedicalDossierDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(READ_SCOPE_FORBIDDEN)
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  @ApiInternalServerErrorEnvelope('Medical access audit could not be recorded')
  async getDossier(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
  ) {
    return this.medicalService.getDossier(
      this.requireActor(actor),
      params.id,
      randomUUID(),
    );
  }

  @Get('fighters/:id/medical/history')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get fighter medical history report',
    description:
      'Paginated revisions of injuries, recovery plans, clearances and review requests plus append-only treatments and examinations (with their `details`, null when none were recorded), including inactive records. MIGRATION_BASELINE entries are the state captured by migration 011, not reconstructed history.',
  })
  @ResponseMessage('Get fighter medical history successfully')
  @ApiSuccessEnvelope({
    message: 'Get fighter medical history successfully',
    model: MedicalHistoryEntryDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(READ_SCOPE_FORBIDDEN)
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  @ApiInternalServerErrorEnvelope('Medical access audit could not be recorded')
  async listHistory(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListMedicalHistoryQueryDto,
  ) {
    return this.medicalService.listHistory(
      this.requireActor(actor),
      params.id,
      query,
      randomUUID(),
    );
  }

  @Get('fighters/:id/medical-examinations')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'List fighter medical examinations',
    description:
      'Paginated examinations and corrections, newest issuance first (server-owned sequenceNo).',
  })
  @ResponseMessage('Get medical examinations successfully')
  @ApiSuccessEnvelope({
    message: 'Get medical examinations successfully',
    model: ExaminationDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(READ_SCOPE_FORBIDDEN)
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  @ApiInternalServerErrorEnvelope('Medical access audit could not be recorded')
  async listExaminations(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListExaminationsQueryDto,
  ) {
    return this.medicalService.listExaminations(
      this.requireActor(actor),
      params.id,
      query,
      randomUUID(),
    );
  }

  @Get('fighters/:id/medical-review-requests')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'List fighter medical review requests',
    description:
      'Paginated review requests. RESOLVED means an examination processed the request, not that the Fighter is eligible.',
  })
  @ResponseMessage('Get medical review requests successfully')
  @ApiSuccessEnvelope({
    message: 'Get medical review requests successfully',
    model: ReviewRequestDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(READ_SCOPE_FORBIDDEN)
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  @ApiInternalServerErrorEnvelope('Medical access audit could not be recorded')
  async listReviewRequests(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListReviewRequestsQueryDto,
  ) {
    return this.medicalService.listReviewRequests(
      this.requireActor(actor),
      params.id,
      query,
      randomUUID(),
    );
  }

  // --- Review requests ---

  @Post('fighters/:id/medical-review-requests')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.REVIEW_REQUEST_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Request a medical review',
    description:
      'FIGHTER for self, COACH/DOCTOR for a currently assigned Fighter. Creates an examination obligation that blocks starting training until a TRAINING examination resolves it. Does not record any clinical decision.',
  })
  @ResponseMessage('Create medical review request successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create medical review request successfully',
    model: ReviewRequestDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires fighter.medical_review_request:create; FIGHTER only self, COACH/DOCTOR only currently assigned Fighters',
  )
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async createReviewRequest(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: CreateReviewRequestDto,
  ) {
    return this.medicalService.createReviewRequest(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  // --- Injuries, treatments, recovery plans ---

  @Post('fighters/:id/injuries')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.WRITE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record an injury',
    description:
      'Doctor-authored injury record. No AI source is required or accepted.',
  })
  @ResponseMessage('Record injury successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Record injury successfully',
    model: InjuryDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async createInjury(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: CreateInjuryDto,
  ) {
    return this.medicalService.createInjury(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Patch('injuries/:id')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.WRITE] })
  @ApiOperation({
    summary: 'Update injury progress',
    description:
      'Updates severity, description or status (ACTIVE <-> RECOVERING -> RESOLVED). RESOLVED is a final status, but severity/description remain correctable. resolvedAt is server-owned. Each change is versioned in the same transaction.',
  })
  @ResponseMessage('Update injury successfully')
  @ApiSuccessEnvelope({
    message: 'Update injury successfully',
    model: InjuryDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope('INJURY_NOT_FOUND', 'Injury record not found')
  @ApiConflictEnvelope(
    'INVALID_INJURY_STATUS_TRANSITION',
    'The requested injury status transition is not allowed',
  )
  async updateInjury(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: MedicalRecordIdParamsDto,
    @Body() body: UpdateInjuryDto,
  ) {
    return this.medicalService.updateInjury(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('injuries/:id/treatments')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.WRITE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Append a treatment',
    description: 'Treatments are append-only; there is no update or delete.',
  })
  @ResponseMessage('Record treatment successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Record treatment successfully',
    model: TreatmentDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope('INJURY_NOT_FOUND', 'Injury record not found')
  async createTreatment(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: MedicalRecordIdParamsDto,
    @Body() body: CreateTreatmentDto,
  ) {
    return this.medicalService.createTreatment(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('fighters/:id/recovery-plans')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.WRITE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a recovery plan',
    description:
      'The injury must belong to the same Fighter. Each milestone gets a server-generated id; clients send no id and no completedAt (completedAt is stamped by the server when isCompleted is true). Array order is display order. Completing milestones never completes the plan, issues a clearance or decides eligibility.',
  })
  @ResponseMessage('Create recovery plan successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Create recovery plan successfully',
    model: RecoveryPlanDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope(
    'INJURY_NOT_FOUND',
    'Fighter or injury record not found for this Fighter',
  )
  async createRecoveryPlan(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: CreateRecoveryPlanDto,
  ) {
    return this.medicalService.createRecoveryPlan(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Patch('recovery-plans/:id')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.WRITE] })
  @ApiOperation({
    summary: 'Update a recovery plan',
    description:
      'Updates description, estimated end date, milestones or status (ACTIVE -> COMPLETED/CANCELLED). Closed plans keep their status and end date, but content remains correctable. actualEndDate is set by the server (UTC date) on completion. `milestones`, when sent, replaces the whole list: an element with `id` updates that existing milestone of this plan (id kept across content/order changes), an element without `id` is new; completedAt is server-owned (set on false->true, kept on true->true, cleared on true->false). Omitting `milestones` leaves stored milestones, legacy JSON included, unchanged. Responses return either standard milestones or the legacy JSON array exactly as stored. Each change is versioned.',
  })
  @ResponseMessage('Update recovery plan successfully')
  @ApiSuccessEnvelope({
    message: 'Update recovery plan successfully',
    model: RecoveryPlanDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope(
    'RECOVERY_PLAN_NOT_FOUND',
    'Recovery plan not found',
    'RECOVERY_PLAN_NOT_FOUND, or MEDICAL_REFERENCE_NOT_FOUND when a milestone id does not belong to this plan',
  )
  @ApiConflictEnvelope(
    'INVALID_RECOVERY_PLAN_STATUS_TRANSITION',
    'The requested recovery plan status transition is not allowed',
    'Status transition not allowed, or RECOVERY_PLAN_DATE_CONFLICT when a date conflicts with the recorded start date',
  )
  async updateRecoveryPlan(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: MedicalRecordIdParamsDto,
    @Body() body: UpdateRecoveryPlanDto,
  ) {
    return this.medicalService.updateRecoveryPlan(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  // --- Examinations and clearances ---

  @Post('fighters/:id/medical-examinations')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.EXAMINATION_CREATE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a medical examination decision',
    description:
      'ELIGIBLE, ELIGIBLE_WITH_RESTRICTIONS or NOT_ELIGIBLE for TRAINING or COMPETITION. NOT_ELIGIBLE revokes active clearances of the same scope in the same transaction and never produces a clearance. Corrections create a new record via supersedesId. A TRAINING examination may resolve listed OPEN review requests. Optional details (examinationType, vitals, assessments, recommendations, followUpDate) are stored in the same transaction; a BASELINE requires vitals, at least one assessment and a SCAT6 record (ADMINISTERED with raw answers, or NOT_ADMINISTERED with a reason). SCAT6 scores are computed by the server from the raw answers (client totals are not accepted) and never decide eligibility or clearance. An ADMINISTERED SCAT6 for a Fighter under 13 at administeredAt returns 409 MEDICAL_DATA_CONSTRAINT_CONFLICT.',
  })
  @ResponseMessage('Record medical examination successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Record medical examination successfully',
    model: ExaminationDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope(
    'MEDICAL_EXAMINATION_NOT_FOUND',
    'Superseded examination not found',
    'FIGHTER_NOT_FOUND, MEDICAL_EXAMINATION_NOT_FOUND (supersedesId) or MEDICAL_REVIEW_REQUEST_NOT_FOUND (reviewRequestIds)',
  )
  @ApiConflictEnvelope(
    'EXAMINATION_CORRECTION_CONFLICT',
    'A correction must supersede the current examination of the same scope',
    'EXAMINATION_CORRECTION_CONFLICT, REVIEW_REQUEST_NOT_RESOLVABLE or MEDICAL_DATA_CONSTRAINT_CONFLICT (SCAT6 under its minimum age)',
  )
  async createExamination(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: CreateExaminationDto,
  ) {
    return this.medicalService.createExamination(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('fighters/:id/medical-clearances')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.CLEARANCE_ISSUE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Issue a medical clearance',
    description:
      'Derives from the current positive examination of the matching scope (TRAINING -> TRAINING/RETURN_FROM_INJURY, COMPETITION -> COMPETITION). Omitted restrictions and validUntil inherit the examination; supplied ones may only narrow it.',
  })
  @ResponseMessage('Issue medical clearance successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Issue medical clearance successfully',
    model: ClearanceDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope(
    'MEDICAL_EXAMINATION_NOT_FOUND',
    'Medical examination not found',
  )
  @ApiConflictEnvelope(
    'EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE',
    'A clearance must derive from the current positive examination of the same scope without widening it',
    'EXAMINATION_NOT_ELIGIBLE_FOR_CLEARANCE, or MEDICAL_RECORD_CONFLICT when an active clearance of this type already exists for the examination',
  )
  async issueClearance(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: IssueClearanceDto,
  ) {
    return this.medicalService.issueClearance(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('medical-clearances/:id/revoke')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.CLEARANCE_REVOKE] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke a medical clearance',
    description:
      'revokedAt and the revoking Doctor are server-owned. The change is versioned.',
  })
  @ResponseMessage('Revoke medical clearance successfully')
  @ApiSuccessEnvelope({
    message: 'Revoke medical clearance successfully',
    model: ClearanceDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(DOCTOR_WRITE_FORBIDDEN)
  @ApiNotFoundEnvelope(
    'MEDICAL_CLEARANCE_NOT_FOUND',
    'Medical clearance not found',
  )
  @ApiConflictEnvelope(
    'MEDICAL_CLEARANCE_NOT_ACTIVE',
    'The clearance is no longer active',
  )
  async revokeClearance(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: MedicalRecordIdParamsDto,
    @Body() body: RevokeClearanceDto,
  ) {
    return this.medicalService.revokeClearance(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
