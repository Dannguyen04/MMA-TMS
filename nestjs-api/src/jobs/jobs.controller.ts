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
  ApiHeader,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';
import { JobsService } from './jobs.service.js';

@ApiTags('Jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @ApiOperation({
    summary: 'Create video analysis job',
    description: 'Enqueues a new asynchronous video analysis job in BullMQ',
  })
  @ResponseMessage('Job created successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Job created successfully',
  })
  @ApiValidationErrorEnvelope('Invalid videoUrl or user ID format')
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  /** GET /jobs — Danh sách jobs (tùy chọn lọc theo userId) */
  @Get()
  @ApiOperation({
    summary: 'List analysis jobs',
    description:
      'Retrieves analysis jobs, optionally filtered by athlete user ID',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter jobs by athlete user UUID',
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
  @ApiOperation({
    summary: 'List jobs with health impairments',
    description:
      'Retrieves all analysis jobs with detected joint impairment health alerts',
  })
  @ApiQuery({
    name: 'userId',
    required: false,
    description: 'Filter impairment jobs by athlete user UUID',
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
  @ApiOperation({
    summary: 'Get job by ID',
    description:
      'Retrieves processing status and results for a specific analysis job',
  })
  @ApiParam({ name: 'id', description: 'Job UUID' })
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
  @ApiOperation({
    summary: 'Get job health alerts',
    description:
      'Retrieves joint anomaly alerts and final joint states for a job',
  })
  @ApiParam({ name: 'id', description: 'Job UUID' })
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
    summary: 'Update job status (Worker Callback)',
    description:
      'Callback endpoint invoked by Python AI worker upon job completion or failure',
  })
  @ApiParam({ name: 'id', description: 'Job UUID' })
  @ApiHeader({
    name: 'x-worker-secret',
    required: true,
    description: 'Shared worker authentication secret',
  })
  @ResponseMessage('Job status updated successfully')
  @UseGuards(WorkerAuthGuard)
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Job status updated successfully',
  })
  @ApiUnauthorizedEnvelope('Invalid or missing x-worker-secret header')
  @ApiNotFoundEnvelope('JOB_NOT_FOUND', 'Analysis job not found')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.jobsService.updateJobStatus(id, dto);
  }
}
