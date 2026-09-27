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
  AssignmentIdParamsDto,
  FighterIdParamsDto,
  ListFightersQueryDto,
  PublicFighterDto,
} from '../fighters/fighters.dto.js';
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
  AssignDoctorDto,
  DoctorAssignmentDto,
  DoctorIdParamsDto,
  EndDoctorAssignmentDto,
  ListDoctorAssignmentsQueryDto,
} from './medical.dto.js';
import { MedicalService } from './medical.service.js';

@ApiTags('Doctor Assignments')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class MedicalAssignmentController {
  constructor(private readonly medicalService: MedicalService) {}

  @Post('fighters/:id/doctors')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.DOCTOR_ASSIGN] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assign a doctor to a fighter',
    description:
      'Creates an immediately effective assignment; startsAt and assignedById are server-owned. Assignment administration grants no clinical authority.',
  })
  @ResponseMessage('Assign doctor successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Assign doctor successfully',
    model: DoctorAssignmentDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires fighter.doctor:assign and the ADMIN role; a permission override does not let another role assign',
  )
  @ApiNotFoundEnvelope(
    'DOCTOR_NOT_FOUND',
    'Doctor profile not found or inactive',
    'FIGHTER_NOT_FOUND or DOCTOR_NOT_FOUND',
  )
  @ApiConflictEnvelope(
    'DOCTOR_ASSIGNMENT_ALREADY_ACTIVE',
    'An active assignment already exists for this doctor and fighter',
  )
  async assignDoctor(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: AssignDoctorDto,
  ) {
    return this.medicalService.assignDoctor(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post('fighters/:id/doctors/:assignmentId/end')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.DOCTOR_END] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'End a doctor assignment',
    description:
      'Closes the episode at the server time with a required reason. ADMIN may end any episode; a DOCTOR only their own. Closed episodes are immutable; signed clinical records remain.',
  })
  @ResponseMessage('End doctor assignment successfully')
  @ApiSuccessEnvelope({
    message: 'End doctor assignment successfully',
    model: DoctorAssignmentDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires fighter.doctor:end; a DOCTOR may end only their own assignment',
  )
  @ApiNotFoundEnvelope(
    'DOCTOR_ASSIGNMENT_NOT_FOUND',
    'Doctor assignment record not found',
  )
  @ApiConflictEnvelope(
    'DOCTOR_ASSIGNMENT_ALREADY_CLOSED',
    'This doctor assignment has already been ended',
    'DOCTOR_ASSIGNMENT_ALREADY_CLOSED or DOCTOR_ASSIGNMENT_PERIOD_CONFLICT',
  )
  async endDoctorAssignment(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: AssignmentIdParamsDto,
    @Body() body: EndDoctorAssignmentDto,
  ) {
    return this.medicalService.endDoctorAssignment(
      this.requireActor(actor),
      params.id,
      params.assignmentId,
      body,
      randomUUID(),
    );
  }

  @Get('fighters/:id/doctors')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.DOCTOR_READ] })
  @ApiOperation({
    summary: 'List doctor assignments of a fighter',
    description:
      'Paginated assignment history with no clinical content. ADMIN all, FIGHTER self, COACH/DOCTOR only currently assigned Fighters.',
  })
  @ResponseMessage('Get doctor assignments successfully')
  @ApiSuccessEnvelope({
    message: 'Get doctor assignments successfully',
    model: DoctorAssignmentDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter.doctor:read and Fighter scope')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async listDoctorAssignments(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListDoctorAssignmentsQueryDto,
  ) {
    return this.medicalService.listDoctorAssignments(
      this.requireActor(actor),
      params.id,
      query,
    );
  }

  @Get('doctors/:id/fighters')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.DOCTOR_ROSTER] })
  @ApiOperation({
    summary: "List a Doctor's assigned Fighters",
    description:
      'Paginated Fighters under a currently effective assignment. A DOCTOR may request only their own profile; ADMIN any active Doctor.',
  })
  @ResponseMessage('Get doctor fighters list successfully')
  @ApiSuccessEnvelope({
    message: 'Get doctor fighters list successfully',
    model: PublicFighterDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires doctor.fighter:get_all; a DOCTOR may request only their own profile',
  )
  @ApiNotFoundEnvelope('DOCTOR_NOT_FOUND', 'Doctor profile not found or inactive')
  async listDoctorRoster(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: DoctorIdParamsDto,
    @Query() query: ListFightersQueryDto,
  ) {
    return this.medicalService.listDoctorRoster(
      this.requireActor(actor),
      params.id,
      query,
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
