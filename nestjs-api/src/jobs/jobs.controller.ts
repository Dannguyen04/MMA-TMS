import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import {
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
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import { USER } from '../shared/types/user.role.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import { JobsService } from './jobs.service.js';

/**
 * Authenticated, resource-scoped analysis-job surface. Clients identify a
 * persisted video; the server resolves the worker URL and ownership context.
 */
@ApiTags('Video Analysis Jobs (Hàng đợi AI)')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo job phân tích video mới',
    description:
      'Tạo một job mới trong CSDL (status: PENDING) và đẩy job vào hàng đợi Redis BullMQ (queue: video-analysis).',
  })
  @ResponseMessage('Job created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Job created successfully',
  })
  @ApiValidationErrorEnvelope(
    'Dữ liệu đầu vào không hợp lệ (videoId phải là UUID)',
  )
  create(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Body() dto: CreateJobDto,
  ) {
    return this.jobsService.createJob(this.requireActor(actor), dto);
  }

  /** GET /jobs — Danh sách jobs trong phạm vi người dùng hiện tại */
  @Get()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách các jobs',
    description:
      'Trả về các jobs phân tích video mà người dùng hiện tại được phép truy cập.',
  })
  @ResponseMessage('Jobs retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Jobs retrieved successfully',
  })
  list(@CurrentUser() actor: AuthenticatedUser | undefined) {
    return this.jobsService.listJobs(this.requireActor(actor));
  }

  /**
   * GET /jobs/impairments — Tất cả jobs có cảnh báo chấn thương
   * Dùng partial index has_impairment = TRUE → rất nhanh.
   * Đặt TRƯỚC /:id để tránh conflict route.
   */
  @Get('impairments')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách các jobs có cảnh báo chấn thương (Impairments)',
    description:
      'Truy vấn cực nhanh bằng Partial Index `has_impairment = TRUE` để hỗ trợ Bác sĩ thể thao lọc nhanh các ca nghi ngờ chấn thương.',
  })
  @ResponseMessage('Impairment jobs retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Impairment jobs retrieved successfully',
  })
  listImpairments(@CurrentUser() actor: AuthenticatedUser | undefined) {
    return this.jobsService.listImpairmentAlerts(this.requireActor(actor));
  }

  /** GET /jobs/:id — Lấy trạng thái và toàn bộ kết quả job */
  @Get(':id')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy chi tiết và kết quả của một job theo UUID',
    description:
      'Trả về trạng thái xử lý (PENDING, PROCESSING, DONE, FAILED), điểm số và URL kết quả JSON từ Supabase Storage.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của job cần truy vấn',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ResponseMessage('Job retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Job retrieved successfully',
  })
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  findOne(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.jobsService.getJobForActor(this.requireActor(actor), id);
  }

  @Get(':id/result')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ResponseMessage('Analysis result retrieved successfully')
  getResult(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.jobsService.getResult(this.requireActor(actor), id);
  }

  /**
   * GET /jobs/:id/health-alerts — Chỉ lấy anomaly detection data
   * Trả về: { alertCount, hasImpairment, healthAlerts[], jointStates{} }
   */
  @Get(':id/health-alerts')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy dữ liệu Anomaly Detection & Máy trạng thái sức khỏe khớp',
    description:
      'Chỉ trả về các thông tin cảnh báo chấn thương (healthAlerts) và trạng thái các khớp (jointStates) của bài tập.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID của job',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @ResponseMessage('Health alerts retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Health alerts retrieved successfully',
  })
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  getHealthAlerts(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ) {
    return this.jobsService.getHealthAlerts(this.requireActor(actor), id);
  }

  /**
   * PATCH /jobs/:id/status — Python Worker báo hoàn thành
   * Yêu cầu header: x-worker-secret
   * Body bao gồm cả healthAlerts và jointStates từ Anomaly Detection pipeline.
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Python Worker callback cập nhật trạng thái job',
    description:
      'Endpoint bảo mật dành cho Python Worker gọi sau khi phân tích xong video để cập nhật trạng thái (DONE/FAILED), score, resultUrl và mảng cảnh báo healthAlerts.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job cần cập nhật' })
  @ApiHeader({
    name: 'x-worker-secret',
    required: true,
    description: 'Shared worker authentication secret',
  })
  @ApiSecurity('x-worker-secret')
  @ResponseMessage('Job status updated successfully')
  @UseGuards(WorkerAuthGuard)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Job status updated successfully',
  })
  @ApiUnauthorizedEnvelope('Invalid or missing x-worker-secret header')
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateJobStatus(id, dto);
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
