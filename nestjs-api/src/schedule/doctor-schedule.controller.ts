import { Controller, Get, HttpStatus, Query, UseGuards, UsePipes } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { BOUT_PERMISSIONS } from '../bouts/bouts.constants.js';
import {
  ApiForbiddenEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import { CurrentUser, RequirePermissions } from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import { AccessTokenGuard, AuthorizationGuard } from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { SUSPENSION_PERMISSIONS } from '../suspensions/suspensions.constants.js';
import { doctorScheduleQuerySchema, doctorScheduleResponseSchema } from './doctor-schedule.model.js';
import { DoctorScheduleService } from './doctor-schedule.service.js';
import { doctorReviewsResponseSchema } from './doctor-reviews.model.js';
import { MEDICAL_PERMISSIONS } from '../medical/medical.constants.js';

export class DoctorScheduleQueryDto extends createZodDto(doctorScheduleQuerySchema) {}
export class DoctorScheduleResponseDto extends createZodDto(doctorScheduleResponseSchema) {}
export const DOCTOR_SCHEDULE_MESSAGE = 'Get doctor schedule successfully';
export class DoctorReviewsResponseDto extends createZodDto(doctorReviewsResponseSchema) {}
export const DOCTOR_REVIEWS_MESSAGE = 'Get open review requests successfully';

@ApiTags('Doctor schedule')
@ApiBearerAuth()
@Controller()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class DoctorScheduleController {
  constructor(private readonly service: DoctorScheduleService) {}

  @Get('doctor/schedule')
  @RequirePermissions({ allOf: [BOUT_PERMISSIONS.GET_ALL, SUSPENSION_PERMISSIONS.READ] })
  @ApiOperation({
    summary: "Doctor's schedule",
    description:
      'Follow-up examinations, clearance expiries, weigh-ins, bouts (open bouts only) and suspension end dates of the ' +
      "doctor's currently assigned fighters, between from and to (academy dates, inclusive, at most 62 days). " +
      'DOCTOR only; computed on read.',
  })
  @ResponseMessage(DOCTOR_SCHEDULE_MESSAGE)
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: DOCTOR_SCHEDULE_MESSAGE, model: DoctorScheduleResponseDto })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires bout:get_all, suspension:read and the DOCTOR role')
  async getSchedule(@CurrentUser() actor: AuthenticatedUser | undefined, @Query() query: DoctorScheduleQueryDto) {
    if (!actor) throw authenticationRequired();
    return this.service.getSchedule(actor, query);
  }

  @Get('doctor/review-requests')
  @RequirePermissions({ allOf: [MEDICAL_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Open medical review requests of the doctor',
    description:
      "OPEN review requests (a coach or doctor asked for an examination) of the doctor's currently assigned fighters, " +
      'oldest first, at most 50 (truncated says when more exist). Read-only: an examination resolves a request. DOCTOR only.',
  })
  @ResponseMessage(DOCTOR_REVIEWS_MESSAGE)
  @ApiSuccessEnvelope({ status: HttpStatus.OK, message: DOCTOR_REVIEWS_MESSAGE, model: DoctorReviewsResponseDto })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter.medical:read and the DOCTOR role')
  async getOpenReviews(@CurrentUser() actor: AuthenticatedUser | undefined) {
    if (!actor) throw authenticationRequired();
    return this.service.getOpenReviews(actor);
  }
}
