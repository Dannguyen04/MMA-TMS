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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiSecurity,
  ApiTags,
  ApiResponse,
} from '@nestjs/swagger';
import {
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import { RequireRoles } from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import { USER } from '../shared/types/user.role.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';
import { JobsService } from './jobs.service.js';

/**
 * Legacy analysis-job surface (migrations 001/002). The read and create routes
 * now require an authenticated non-guest role, which closes unauthenticated
 * access. Per-fighter ownership scoping is still NOT implemented here, because
 * `analysis_jobs.user_id` is untrusted free text supplied by the request body
 * with no relation to `public.users`; filtering on it would present an
 * attacker-controlled value as an ownership claim. Narrowing that access needs a
 * schema change in a future migration.
 */
@ApiTags('Video Analysis Jobs (Hàng đợi AI)')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Tạo job phân tích video mới',
    description: 'Tạo một job mới trong CSDL (status: PENDING) và đẩy job vào hàng đợi Redis BullMQ (queue: video-analysis).',
  })
  @ResponseMessage('Job created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Job created successfully',
  })
  @ApiValidationErrorEnvelope('Dữ liệu đầu vào không hợp lệ (ví dụ: videoUrl không đúng định dạng URL)')
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  /** GET /jobs — Danh sách jobs (tùy chọn lọc theo userId) */
  @Get()
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy danh sách các jobs',
    description: 'Trả về danh sách các jobs phân tích video, có thể lọc theo ID võ sĩ (userId).',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'ID người dùng / Võ sĩ để lọc danh sách jobs',
    example: 'u-minh-tran',
  })
  @ResponseMessage('Jobs retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Jobs retrieved successfully',
  })
  list(@Query('userId') userId?: string) {
    return this.jobsService.listJobs(userId);
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
    description: 'Truy vấn cực nhanh bằng Partial Index `has_impairment = TRUE` để hỗ trợ Bác sĩ thể thao lọc nhanh các ca nghi ngờ chấn thương.',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Lọc theo ID võ sĩ',
    example: 'u-kenji-morita',
  })
  @ResponseMessage('Impairment jobs retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Impairment jobs retrieved successfully',
  })
  listImpairments(@Query('userId') userId?: string) {
    return this.jobsService.listImpairmentAlerts(userId);
  }

  /** GET /jobs/:id — Lấy trạng thái và toàn bộ kết quả job */
  @Get(':id')
  @UseGuards(AccessTokenGuard, AuthorizationGuard)
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Lấy chi tiết và kết quả của một job theo UUID',
    description: 'Trả về trạng thái xử lý (PENDING, PROCESSING, DONE, FAILED), điểm số và URL kết quả JSON từ Supabase Storage.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job cần truy vấn', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @ResponseMessage('Job retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Job retrieved successfully',
  })
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  findOne(@Param('id') id: string) {
    return this.jobsService.getJob(id);
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
    description: 'Chỉ trả về các thông tin cảnh báo chấn thương (healthAlerts) và trạng thái các khớp (jointStates) của bài tập.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @ResponseMessage('Health alerts retrieved successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Health alerts retrieved successfully',
  })
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  getHealthAlerts(@Param('id') id: string) {
    return this.jobsService.getHealthAlerts(id);
  }

  /**
   * PATCH /jobs/:id/status — Python Worker báo hoàn thành
   * Yêu cầu header: x-worker-secret
   * Body bao gồm cả healthAlerts và jointStates từ Anomaly Detection pipeline.
   */
  @Patch(':id/status')
  @ApiOperation({
    summary: 'Python Worker callback cập nhật trạng thái job',
    description: 'Endpoint bảo mật dành cho Python Worker gọi sau khi phân tích xong video để cập nhật trạng thái (DONE/FAILED), score, resultUrl và mảng cảnh báo healthAlerts.',
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
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateJobStatus(id, dto);
  }
}

