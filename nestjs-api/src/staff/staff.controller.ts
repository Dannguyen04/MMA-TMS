import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import { RequirePermissions } from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  CoachDirectoryResponseDto,
  DoctorDirectoryResponseDto,
  ListStaffQueryDto,
  StaffIdParamsDto,
} from './staff.dto.js';
import { STAFF_PERMISSIONS } from './staff.model.js';
import { StaffService } from './staff.service.js';

@ApiTags('Coaches')
@ApiBearerAuth()
@Controller('coaches')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class CoachesController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @RequirePermissions({ allOf: [STAFF_PERMISSIONS.COACH_GET_ALL] })
  @ApiOperation({ summary: 'List active coaches' })
  @ResponseMessage('Get coaches successfully')
  @ApiSuccessEnvelope({
    message: 'Get coaches successfully',
    model: CoachDirectoryResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires staff.coach:get_all permission')
  list(@Query() query: ListStaffQueryDto) {
    return this.service.listCoaches(query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [STAFF_PERMISSIONS.COACH_READ] })
  @ApiOperation({ summary: 'Get coach profile' })
  @ResponseMessage('Get coach successfully')
  @ApiSuccessEnvelope({
    message: 'Get coach successfully',
    model: CoachDirectoryResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires staff.coach:read permission')
  @ApiNotFoundEnvelope('COACH_NOT_FOUND', 'Coach profile not found')
  get(@Param() params: StaffIdParamsDto) {
    return this.service.getCoach(params.id);
  }
}

@ApiTags('Doctors')
@ApiBearerAuth()
@Controller('doctors')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class DoctorsController {
  constructor(private readonly service: StaffService) {}

  @Get()
  @RequirePermissions({ allOf: [STAFF_PERMISSIONS.DOCTOR_GET_ALL] })
  @ApiOperation({ summary: 'List active sports doctors' })
  @ResponseMessage('Get doctors successfully')
  @ApiSuccessEnvelope({
    message: 'Get doctors successfully',
    model: DoctorDirectoryResponseDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires staff.doctor:get_all permission')
  list(@Query() query: ListStaffQueryDto) {
    return this.service.listDoctors(query);
  }

  @Get(':id')
  @RequirePermissions({ allOf: [STAFF_PERMISSIONS.DOCTOR_READ] })
  @ApiOperation({ summary: 'Get sports-doctor profile' })
  @ResponseMessage('Get doctor successfully')
  @ApiSuccessEnvelope({
    message: 'Get doctor successfully',
    model: DoctorDirectoryResponseDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires staff.doctor:read permission')
  @ApiNotFoundEnvelope('DOCTOR_NOT_FOUND', 'Doctor profile not found')
  get(@Param() params: StaffIdParamsDto) {
    return this.service.getDoctor(params.id);
  }
}
