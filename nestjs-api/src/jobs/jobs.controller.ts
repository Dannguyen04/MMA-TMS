import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequireRoles,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import {
  parseByteRange,
  sendStoredObject,
} from '../videos/stored-object.response.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';
import { JobsService } from './jobs.service.js';

function requireActor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!actor) throw authenticationRequired();
  return actor;
}

@ApiTags('Video Analysis Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('FIGHTER', 'COACH', 'ADMIN')
  @ApiOperation({ summary: 'Create an authenticated video-analysis job' })
  @ResponseMessage('Job created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Job created successfully',
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Requires fighter, coach, or admin role')
  create(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(requireActor(actor), dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'List jobs visible to the authenticated user' })
  @ResponseMessage('Jobs retrieved successfully')
  @ApiSuccessEnvelope({ message: 'Jobs retrieved successfully' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  list(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query('userId') userId?: string,
  ) {
    return this.jobsService.listJobs(requireActor(actor), userId);
  }

  @Get('impairments')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('ADMIN')
  @ApiOperation({ summary: 'List analysis jobs with confirmed impairments' })
  @ResponseMessage('Impairment jobs retrieved successfully')
  @ApiSuccessEnvelope({ message: 'Impairment jobs retrieved successfully' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope('Only administrators can query unscoped job alerts')
  listImpairments(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query('userId') userId?: string,
  ) {
    return this.jobsService.listImpairmentAlerts(requireActor(actor), userId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get an analysis job in the caller scope' })
  @ResponseMessage('Job retrieved successfully')
  @ApiSuccessEnvelope({ message: 'Job retrieved successfully' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  findOne(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.getJobForActor(requireActor(actor), id);
  }

  @Get(':id/health-alerts')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
  @ApiOperation({ summary: 'Get scoped health-alert data for a job' })
  @ResponseMessage('Health alerts retrieved successfully')
  @ApiSuccessEnvelope({ message: 'Health alerts retrieved successfully' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  getHealthAlerts(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.getHealthAlerts(requireActor(actor), id);
  }

  @Get(':id/result')
  @ApiBearerAuth()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
  @ApiOperation({
    summary: 'Get a validated worker result in the caller scope',
  })
  @ResponseMessage('Analysis result retrieved successfully')
  @ApiSuccessEnvelope({ message: 'Analysis result retrieved successfully' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  result(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.jobsService.getResultForActor(requireActor(actor), id);
  }

  @Get(':id/input')
  @UseGuards(WorkerAuthGuard)
  @ApiOperation({ summary: 'Stream private job input to the trusted worker' })
  @ApiHeader({ name: 'x-worker-secret', required: true })
  @ApiSecurity('x-worker-secret')
  @ApiUnauthorizedEnvelope('Invalid or missing x-worker-secret header')
  @ApiNotFoundEnvelope('JOB_VIDEO_NOT_FOUND', 'Job video was not found')
  async input(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() response: Response,
  ) {
    const content = await this.jobsService.openWorkerInput(
      id,
      parseByteRange(rangeHeader),
    );
    sendStoredObject(response, content);
  }

  @Post(':id/result')
  @UseGuards(WorkerAuthGuard)
  @ApiOperation({ summary: 'Validate and finalize a trusted worker result' })
  @ApiHeader({ name: 'x-worker-secret', required: true })
  @ApiSecurity('x-worker-secret')
  @ResponseMessage('Analysis result finalized successfully')
  @ApiSuccessEnvelope({ message: 'Analysis result finalized successfully' })
  @ApiUnauthorizedEnvelope('Invalid or missing x-worker-secret header')
  async finalizeResult(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('content-length') contentLength: string | undefined,
    @Req() request: Request,
  ) {
    return this.jobsService.finalizeWorkerResult(
      id,
      request,
      Number(contentLength),
    );
  }

  @Patch(':id/status')
  @UseGuards(WorkerAuthGuard)
  @ApiOperation({ summary: 'Update a job from the trusted Python worker' })
  @ApiHeader({ name: 'x-worker-secret', required: true })
  @ApiSecurity('x-worker-secret')
  @ResponseMessage('Job status updated successfully')
  @ApiSuccessEnvelope({ message: 'Job status updated successfully' })
  @ApiUnauthorizedEnvelope('Invalid or missing x-worker-secret header')
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateJobStatus(id, dto);
  }
}
