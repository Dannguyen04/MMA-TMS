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
  FighterPerformanceParamsDto,
  HistoryQueryDto,
  PerformanceMetricResponseDto,
  PerformanceSummaryResponseDto,
  TeamPerformanceResponseDto,
  TeamQueryDto,
  TechniqueDetailResponseDto,
  TechniqueParamsDto,
  WeeklyVolumeQueryDto,
  WeeklyVolumeResponseDto,
} from './performance.dto.js';
import { PERFORMANCE_PERMISSIONS } from './performance.model.js';
import { PerformanceService } from './performance.service.js';

function actor(value: AuthenticatedUser | undefined) {
  if (!value) throw authenticationRequired();
  return value;
}

@ApiTags('Performance')
@ApiBearerAuth()
@Controller('performance')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class PerformanceController {
  constructor(private readonly service: PerformanceService) {}

  @Get('fighters/:fighterId/history')
  @RequirePermissions({ allOf: [PERFORMANCE_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get fighter weekly performance history' })
  @ResponseMessage('Get performance history successfully')
  @ApiSuccessEnvelope({
    message: 'Get performance history successfully',
    model: PerformanceMetricResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires performance:read and valid fighter scope')
  history(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: FighterPerformanceParamsDto,
    @Query() query: HistoryQueryDto,
  ) {
    return this.service.getHistory(actor(user), params.fighterId, query.weeks);
  }

  @Get('fighters/:fighterId/summary')
  @RequirePermissions({ allOf: [PERFORMANCE_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get fighter performance summary' })
  @ResponseMessage('Get performance summary successfully')
  @ApiSuccessEnvelope({
    message: 'Get performance summary successfully',
    model: PerformanceSummaryResponseDto,
    nullable: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires performance:read and valid fighter scope')
  summary(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: FighterPerformanceParamsDto,
  ) {
    return this.service.getSummary(actor(user), params.fighterId);
  }

  @Get('fighters/:fighterId/techniques/:technique')
  @RequirePermissions({ allOf: [PERFORMANCE_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get fighter technique performance detail' })
  @ResponseMessage('Get technique performance successfully')
  @ApiSuccessEnvelope({
    message: 'Get technique performance successfully',
    model: TechniqueDetailResponseDto,
    nullable: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires performance:read and valid fighter scope')
  technique(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param() params: TechniqueParamsDto,
  ) {
    return this.service.getTechnique(
      actor(user),
      params.fighterId,
      params.technique,
    );
  }

  @Get('team')
  @RequirePermissions({ allOf: [PERFORMANCE_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get assigned team performance' })
  @ResponseMessage('Get team performance successfully')
  @ApiSuccessEnvelope({
    message: 'Get team performance successfully',
    model: TeamPerformanceResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires performance:read and valid fighter scope')
  team(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: TeamQueryDto,
  ) {
    return this.service.getTeam(actor(user), query.fighterId);
  }

  @Get('weekly-volume')
  @RequirePermissions({ allOf: [PERFORMANCE_PERMISSIONS.READ] })
  @ApiOperation({ summary: 'Get assigned team weekly training volume' })
  @ResponseMessage('Get weekly volume successfully')
  @ApiSuccessEnvelope({
    message: 'Get weekly volume successfully',
    model: WeeklyVolumeResponseDto,
    isArray: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires performance:read and valid fighter scope')
  weekly(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: WeeklyVolumeQueryDto,
  ) {
    return this.service.getWeeklyVolume(
      actor(user),
      query.fighterId,
      query.weeks,
    );
  }
}
