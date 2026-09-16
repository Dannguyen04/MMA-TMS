import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JobsService } from './jobs.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @ResponseMessage('Job created successfully')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  /** GET /jobs — Danh sách jobs (tùy chọn lọc theo userId) */
  @Get()
  @ResponseMessage('Jobs retrieved successfully')
  list(@Query('userId') userId?: string) {
    return this.jobsService.listJobs(userId);
  }

  /**
   * GET /jobs/impairments — Tất cả jobs có cảnh báo chấn thương
   * Dùng partial index has_impairment = TRUE → rất nhanh.
   * Đặt TRƯỚC /:id để tránh conflict route.
   */
  @Get('impairments')
  @ResponseMessage('Impairment jobs retrieved successfully')
  listImpairments(@Query('userId') userId?: string) {
    return this.jobsService.listImpairmentAlerts(userId);
  }

  /** GET /jobs/:id — Lấy trạng thái và toàn bộ kết quả job */
  @Get(':id')
  @ResponseMessage('Job retrieved successfully')
  findOne(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }

  /**
   * GET /jobs/:id/health-alerts — Chỉ lấy anomaly detection data
   * Trả về: { alertCount, hasImpairment, healthAlerts[], jointStates{} }
   */
  @Get(':id/health-alerts')
  @ResponseMessage('Health alerts retrieved successfully')
  getHealthAlerts(@Param('id') id: string) {
    return this.jobsService.getHealthAlerts(id);
  }

  /**
   * PATCH /jobs/:id/status — Python Worker báo hoàn thành
   * Yêu cầu header: x-worker-secret
   * Body bao gồm cả healthAlerts và jointStates từ Anomaly Detection pipeline.
   */
  @Patch(':id/status')
  @ResponseMessage('Job status updated successfully')
  @UseGuards(WorkerAuthGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateJobStatusDto) {
    return this.jobsService.updateJobStatus(id, dto);
  }
}
