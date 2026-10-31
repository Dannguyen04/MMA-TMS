import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiConflictEnvelope,
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
  RequireRoles,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { USER } from '../shared/types/user.role.js';
import { FIGHTER_APPLICATION_PERMISSIONS } from './fighter-admissions.constants.js';
import {
  ActivationResponseDto,
  ApplicantApplicationDto,
  ApplicantApplicationListDto,
  ApplicationIdParamsDto,
  AssignCoachDto,
  ListApplicationsQueryDto,
  ListOwnApplicationsQueryDto,
  RecoveryEmailStatusDto,
  StaffApplicationDto,
  StaffApplicationListDto,
  SubmitApplicationDto,
  SubmitAssessmentDto,
  SubmitDecisionDto,
} from './fighter-admissions.dto.js';
import { FighterAdmissionsService } from './fighter-admissions.service.js';

/**
 * Applicant surface. Submission stays GUEST-only; activation also admits an
 * already promoted FIGHTER so a completed attempt can be re-checked, and the
 * use case still verifies ownership and the recorded activation state.
 */
@ApiTags('Fighter Admissions')
@Controller('fighter-admissions')
@UsePipes(appZodValidationPipe)
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@ApiBearerAuth()
export class FighterAdmissionsApplicantController {
  constructor(private readonly service: FighterAdmissionsService) {}

  @Post('applications')
  @RequireRoles(USER.GUEST)
  @ApiOperation({
    summary: 'Submit an admission application',
    description:
      'Creates one admission attempt for the authenticated guest. The applicant email is a snapshot of the verified account email at submission time and cannot be supplied in the body; only one attempt may be open at a time. Recovery mail is later sent to the account current email, not to this snapshot.',
  })
  @ResponseMessage('Admission application submitted successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Admission application submitted successfully',
    model: ApplicantApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid admission application payload')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Only a guest account may submit an application')
  @ApiConflictEnvelope(
    'FIGHTER_APPLICATION_ALREADY_OPEN',
    'An admission application is already in progress',
  )
  submit(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() body: SubmitApplicationDto,
  ) {
    return this.service.submitApplication(actor, body, randomUUID());
  }

  @Get('applications/me')
  @RequireRoles(USER.GUEST, USER.FIGHTER)
  @ApiOperation({
    summary: 'List my admission applications',
    description:
      'Returns the caller own admission history, including closed attempts, with bounded pagination. A promoted fighter keeps access to the history of the same account.',
  })
  @ResponseMessage('Admission applications retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Admission applications retrieved successfully',
    model: ApplicantApplicationListDto,
  })
  @ApiValidationErrorEnvelope('Invalid pagination query')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Only a guest or fighter account may read its own admission history')
  listMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOwnApplicationsQueryDto,
  ) {
    return this.service.listOwnApplications(actor, query);
  }

  @Get('applications/me/:id')
  @RequireRoles(USER.GUEST, USER.FIGHTER)
  @ApiOperation({
    summary: 'Read one of my admission applications',
    description:
      'Returns one own admission attempt with its outcome. Staff notes and other applicants are never exposed. The applicant email is the snapshot captured at submission time.',
  })
  @ResponseMessage('Admission application retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Admission application retrieved successfully',
    model: ApplicantApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid application identifier')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Only a guest or fighter account may read its own admission history')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_NOT_FOUND',
    'Admission application not found',
  )
  getMine(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
  ) {
    return this.service.getOwnApplication(actor, params.id);
  }

  @Post('activation')
  @RequireRoles(USER.GUEST, USER.FIGHTER)
  @ApiOperation({
    summary: 'Activate the approved fighter account',
    description:
      'Completes an approved admission after the password was changed through the recovery link. The call is idempotent and always requires a valid session.',
  })
  @ResponseMessage('Fighter account activated successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Fighter account activated successfully',
    model: ActivationResponseDto,
  })
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiNotFoundEnvelope(
    'FIGHTER_ACTIVATION_NOT_APPROVED',
    'No approved admission is awaiting activation',
  )
  @ApiConflictEnvelope(
    'FIGHTER_ACTIVATION_PASSWORD_NOT_SET',
    'The recovery password has not been set yet, or another recovery is in progress',
  )
  activate(@CurrentUser() actor: AuthenticatedUser) {
    return this.service.activate(actor, randomUUID());
  }
}

/**
 * Administration surface. These routes declare ADMIN role metadata only: adding
 * permission metadata would take precedence over the role check and let an
 * individually granted permission bypass the ADMIN restriction.
 */
@ApiTags('Fighter Admissions')
@Controller('fighter-admissions/applications')
@UsePipes(appZodValidationPipe)
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles(USER.ADMIN)
@ApiBearerAuth()
export class FighterAdmissionsAdminController {
  constructor(private readonly service: FighterAdmissionsService) {}

  @Get()
  @RequireRoles(USER.ADMIN)
  @ApiOperation({
    summary: 'List admission applications',
    description:
      'Returns every admission attempt with its assignment history, assessment, decision and activation state, with bounded pagination.',
  })
  @ResponseMessage('Admission applications retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Admission applications retrieved successfully',
    model: StaffApplicationListDto,
  })
  @ApiValidationErrorEnvelope('Invalid pagination or status filter')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Administrator role is required')
  list(@Query() query: ListApplicationsQueryDto) {
    return this.service.listApplications(query);
  }

  @Get(':id')
  @RequireRoles(USER.ADMIN)
  @ApiOperation({ summary: 'Read one admission application' })
  @ResponseMessage('Admission application retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Admission application retrieved successfully',
    model: StaffApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid application identifier')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Administrator role is required')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_NOT_FOUND',
    'Admission application not found',
  )
  get(@Param() params: ApplicationIdParamsDto) {
    return this.service.getApplication(params.id);
  }

  @Post(':id/assign-coach')
  @RequireRoles(USER.ADMIN)
  @ApiOperation({
    summary: 'Assign the evaluating coach',
    description:
      'Opens a new assignment period for the application. Replacing an assigned coach closes the current period with a reason and is refused once the entrance assessment exists.',
  })
  @ResponseMessage('Coach assigned successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Coach assigned successfully',
    model: StaffApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid coach assignment payload')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Administrator role is required')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_COACH_NOT_ASSIGNABLE',
    'Application or coach not found',
  )
  @ApiConflictEnvelope(
    'FIGHTER_APPLICATION_ASSIGNMENT_LOCKED',
    'The application state does not allow a coach assignment',
  )
  assignCoach(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
    @Body() body: AssignCoachDto,
  ) {
    return this.service.assignCoach(actor, params.id, body, randomUUID());
  }

  @Post(':id/decision')
  @RequireRoles(USER.ADMIN)
  @ApiOperation({
    summary: 'Approve or reject a passed application',
    description:
      'Records the final admission decision. Approval creates the pending activation and then requests the password recovery email; a mail failure never reverses the decision.',
  })
  @ResponseMessage('Admission decision recorded successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Admission decision recorded successfully',
    model: StaffApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid decision payload')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Administrator role is required')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_NOT_FOUND',
    'Admission application not found',
  )
  @ApiConflictEnvelope(
    'FIGHTER_APPLICATION_DECISION_REQUIRES_PASS',
    'The application has no PASS assessment, or a decision already exists',
  )
  decide(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
    @Body() body: SubmitDecisionDto,
  ) {
    return this.service.submitDecision(actor, params.id, body, randomUUID());
  }

  @Post(':id/resend-activation-email')
  @RequireRoles(USER.ADMIN)
  @ApiOperation({
    summary: 'Resend the activation recovery email',
    description:
      'Requests the password recovery mail again for a pending activation. The response reports whether the provider accepted the request, which is not a delivery confirmation.',
  })
  @ResponseMessage('Activation email requested successfully')
  @HttpCode(HttpStatus.OK)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Activation email requested successfully',
    model: RecoveryEmailStatusDto,
  })
  @ApiValidationErrorEnvelope('Invalid application identifier')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('Administrator role is required')
  @ApiNotFoundEnvelope(
    'FIGHTER_ACTIVATION_NOT_APPROVED',
    'No approved admission is awaiting activation',
  )
  @ApiConflictEnvelope(
    'FIGHTER_ACTIVATION_RESEND_COOLDOWN',
    'A recovery email was sent recently, or the activation is already complete',
  )
  resend(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
  ) {
    return this.service.resendActivationEmail(actor, params.id, randomUUID());
  }
}

/**
 * Assigned coach surface. The permission is the coarse gate; the use case still
 * requires an active coach profile holding the open assignment.
 */
@ApiTags('Fighter Admissions')
@Controller('fighter-admissions/assigned')
@UsePipes(appZodValidationPipe)
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@ApiBearerAuth()
export class FighterAdmissionsAssignedController {
  constructor(private readonly service: FighterAdmissionsService) {}

  @Get()
  @RequirePermissions({ allOf: [FIGHTER_APPLICATION_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: 'List applications assigned to me',
    description:
      'Returns the admission attempts whose open assignment belongs to the requesting coach.',
  })
  @ResponseMessage('Assigned applications retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Assigned applications retrieved successfully',
    model: StaffApplicationListDto,
  })
  @ApiValidationErrorEnvelope('Invalid pagination query')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('The assigned-application permission is required')
  listAssigned(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: ListOwnApplicationsQueryDto,
  ) {
    return this.service.listAssignedApplications(actor, query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [FIGHTER_APPLICATION_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Read an application assigned to me' })
  @ResponseMessage('Assigned application retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Assigned application retrieved successfully',
    model: StaffApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid application identifier')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('The application is not assigned to you')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_NOT_FOUND',
    'Admission application not found',
  )
  getAssigned(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
  ) {
    return this.service.getAssignedApplication(actor, params.id);
  }

  @Post(':id/assessment')
  @RequirePermissions({ allOf: [FIGHTER_APPLICATION_PERMISSIONS.EVALUATE] })
  @ApiOperation({
    summary: 'Submit the entrance assessment',
    description:
      'Records the coach criteria, evidence and manual PASS or FAIL conclusion. The submitted assessment is final and cannot be edited or deleted.',
  })
  @ResponseMessage('Entrance assessment submitted successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Entrance assessment submitted successfully',
    model: StaffApplicationDto,
  })
  @ApiValidationErrorEnvelope('Invalid assessment payload')
  @ApiUnauthorizedEnvelope('A valid access token is required')
  @ApiForbiddenEnvelope('The application is not assigned to you')
  @ApiNotFoundEnvelope(
    'FIGHTER_APPLICATION_NOT_FOUND',
    'Admission application not found',
  )
  @ApiConflictEnvelope(
    'FIGHTER_APPLICATION_ASSESSMENT_EXISTS',
    'An entrance assessment already exists, or the application state does not allow one',
  )
  assess(
    @CurrentUser() actor: AuthenticatedUser,
    @Param() params: ApplicationIdParamsDto,
    @Body() body: SubmitAssessmentDto,
  ) {
    return this.service.submitAssessment(actor, params.id, body, randomUUID());
  }
}
