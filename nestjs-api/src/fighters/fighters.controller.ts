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
import {
  AssignCoachDto,
  AssignmentIdParamsDto,
  CoachAssignmentDto,
  CreateMeasurementDto,
  EndCoachAssignmentDto,
  FighterIdParamsDto,
  FighterMeasurementDto,
  FighterMedicalSummaryDto,
  ListFighterSessionsQueryDto,
  ListFightersQueryDto,
  ListMeasurementsQueryDto,
  MeasurementIdParamsDto,
  PublicFighterDto,
  TrainingSessionSummaryDto,
  UpdateFighterProfileDto,
} from './fighters.dto.js';
import { FIGHTER_PERMISSIONS } from './fighters.model.js';
import { FightersService } from './fighters.service.js';

@ApiTags('Fighters')
@ApiBearerAuth()
@Controller('fighters')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class FightersController {
  constructor(private readonly fightersService: FightersService) {}
  
  @Get()
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: 'List fighters',
    description:
      'Retrieves a permission-protected, scope-aware paginated fighter list with optional filtering',
  })
  @ResponseMessage('Get fighters list successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get fighters list successfully',
    model: PublicFighterDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter:get_all permission')
  async findAll(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListFightersQueryDto,
  ) {
    return this.fightersService.findAll(this.requireActor(actor), query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.READ] })
  @ApiOperation({
    summary: 'Get fighter profile by ID',
    description:
      'Retrieves fighter details; Fighter users remain limited to their own profile',
  })
  @ResponseMessage('Get fighter profile successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get fighter profile successfully',
    model: PublicFighterDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Fighters cannot view profiles of other fighters')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async findById(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
  ) {
    return this.fightersService.findById(this.requireActor(actor), params.id);
  }

  @Patch(':id')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.UPDATE] })
  @ApiOperation({
    summary: 'Update fighter profile',
    description:
      'Updates fighter physical attributes or biographical information',
  })
  @ResponseMessage('Update fighter profile successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Update fighter profile successfully',
    model: PublicFighterDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires fighter:update; Fighter users may update only their own profile',
  )
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async updateProfile(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: UpdateFighterProfileDto,
  ) {
    return this.fightersService.updateProfile(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  // --- Body Measurement Endpoints (Append-Only) ---

  @Get(':id/measurements')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_READ] })
  @ApiOperation({
    summary: 'Get body measurements',
    description:
      'Retrieves historical measurements for a fighter (with pagination and supersede filter)',
  })
  @ResponseMessage('Get body measurements successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get body measurements successfully',
    model: FighterMeasurementDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Fighters can only view their own measurements')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async findMeasurements(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListMeasurementsQueryDto,
  ) {
    return this.fightersService.findMeasurements(
      this.requireActor(actor),
      params.id,
      query,
    );
  }

  @Post(':id/measurements')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_WRITE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record body measurement',
    description: 'Appends a new body measurement record (append-only)',
  })
  @ResponseMessage('Record body measurement successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Record body measurement successfully',
    model: FighterMeasurementDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Fighters may only record measurements with SELF_REPORTED context',
  )
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async createMeasurement(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: CreateMeasurementDto,
  ) {
    return this.fightersService.createMeasurement(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post(':id/measurements/:measurementId/supersede')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.MEASUREMENTS_WRITE] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Supersede body measurement',
    description:
      'Appends a corrected body measurement that supersedes an earlier record',
  })
  @ResponseMessage('Supersede body measurement successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Supersede body measurement successfully',
    model: FighterMeasurementDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope(
    'MEASUREMENT_NOT_FOUND',
    'Target measurement record not found',
  )
  @ApiConflictEnvelope(
    'MEASUREMENT_ALREADY_SUPERSEDED',
    'Target measurement has already been superseded',
  )
  async supersedeMeasurement(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: MeasurementIdParamsDto,
    @Body() body: CreateMeasurementDto,
  ) {
    return this.fightersService.supersedeMeasurement(
      this.requireActor(actor),
      params.id,
      params.measurementId,
      body,
      randomUUID(),
    );
  }

  // --- Coach Assignment Endpoints (Temporal) ---

  @Get(':id/coaches')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.COACHES_READ] })
  @ApiOperation({
    summary: 'List coach assignments',
    description:
      'Retrieves current active and historical coach assignments for a fighter',
  })
  @ResponseMessage('Get coach assignments successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get coach assignments successfully',
    model: CoachAssignmentDto,
    isArray: true,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Fighters can only view their own coach assignments')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async findCoachAssignments(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
  ) {
    return this.fightersService.findCoachAssignments(
      this.requireActor(actor),
      params.id,
    );
  }

  @Post(':id/coaches')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.COACHES_ASSIGN] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Assign coach to fighter',
    description:
      'Creates a new temporal coach assignment period; requires fighter.coach:assign',
  })
  @ResponseMessage('Assign coach successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Assign coach successfully',
    model: CoachAssignmentDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter.coach:assign permission')
  @ApiNotFoundEnvelope('COACH_NOT_FOUND', 'Coach not found or inactive')
  @ApiConflictEnvelope(
    'COACH_ASSIGNMENT_ALREADY_ACTIVE',
    'An active assignment already exists for this coach and fighter',
  )
  async assignCoach(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Body() body: AssignCoachDto,
  ) {
    return this.fightersService.assignCoach(
      this.requireActor(actor),
      params.id,
      body,
      randomUUID(),
    );
  }

  @Post(':id/coaches/:assignmentId/end')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.COACHES_END] })
  @ApiOperation({
    summary: 'End coach assignment',
    description:
      'Ends an active coach-fighter assignment with a required reason; requires fighter.coach:end',
  })
  @ResponseMessage('End coach assignment successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'End coach assignment successfully',
    model: CoachAssignmentDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter.coach:end permission')
  @ApiNotFoundEnvelope(
    'COACH_ASSIGNMENT_NOT_FOUND',
    'Coach assignment record not found',
  )
  @ApiConflictEnvelope(
    'COACH_ASSIGNMENT_ALREADY_CLOSED',
    'This assignment has already been closed',
  )
  async endCoachAssignment(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: AssignmentIdParamsDto,
    @Body() body: EndCoachAssignmentDto,
  ) {
    return this.fightersService.endCoachAssignment(
      this.requireActor(actor),
      params.id,
      params.assignmentId,
      body,
      randomUUID(),
    );
  }

  // --- Training History Endpoints ---

  @Get(':id/sessions')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.SESSIONS_READ] })
  @ApiOperation({
    summary: 'Get training sessions',
    description:
      'Retrieves paginated training history for a fighter with optional filters',
  })
  @ResponseMessage('Get training sessions successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get training sessions successfully',
    model: TrainingSessionSummaryDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Fighters can only view their own training sessions')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async findTrainingSessions(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
    @Query() query: ListFighterSessionsQueryDto,
  ) {
    return this.fightersService.findTrainingSessions(
      this.requireActor(actor),
      params.id,
      query,
    );
  }

  // --- Medical Record Link Endpoints ---

  @Get(':id/medical-summary')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.MEDICAL_READ] })
  @ApiOperation({
    summary: 'Get fighter medical summary',
    description:
      'Retrieves current clearances, injuries, joint health states, and medical disclaimer',
  })
  @ResponseMessage('Get fighter medical summary successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get fighter medical summary successfully',
    model: FighterMedicalSummaryDto,
  })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Fighters can only view their own medical summary')
  @ApiNotFoundEnvelope('FIGHTER_NOT_FOUND', 'Fighter profile not found')
  async getMedicalSummary(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: FighterIdParamsDto,
  ) {
    return this.fightersService.getMedicalSummary(
      this.requireActor(actor),
      params.id,
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
