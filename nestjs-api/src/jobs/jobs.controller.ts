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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiSecurity,
} from '@nestjs/swagger';
import { JobsService } from './jobs.service.js';
import { CreateJobDto } from './dto/create-job.dto.js';
import { UpdateJobStatusDto } from './dto/update-job-status.dto.js';
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';

@ApiTags('Video Analysis Jobs (Hàng đợi AI)')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Tạo job phân tích video mới',
    description: 'Tạo một job mới trong CSDL (status: PENDING) và đẩy job vào hàng đợi Redis BullMQ (queue: video-analysis).',
  })
  @ApiResponse({ status: 201, description: 'Job đã được tạo và enqueue thành công.' })
  @ApiResponse({ status: 400, description: 'Dữ liệu đầu vào không hợp lệ (ví dụ: videoUrl không đúng định dạng URL).' })
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  /** GET /jobs — Danh sách jobs (tùy chọn lọc theo userId) */
  @Get()
  @ApiOperation({
    summary: 'Lấy danh sách các jobs',
    description: 'Trả về danh sách các jobs phân tích video, có thể lọc theo ID võ sĩ (userId).',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'ID người dùng / Võ sĩ để lọc danh sách jobs', example: 'u-minh-tran' })
  @ApiResponse({ status: 200, description: 'Danh sách các jobs.' })
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
    summary: 'Lấy danh sách các jobs có cảnh báo chấn thương (Impairments)',
    description: 'Truy vấn cực nhanh bằng Partial Index `has_impairment = TRUE` để hỗ trợ Bác sĩ thể thao lọc nhanh các ca nghi ngờ chấn thương.',
  })
  @ApiQuery({ name: 'userId', required: false, description: 'Lọc theo ID võ sĩ', example: 'u-kenji-morita' })
  @ApiResponse({ status: 200, description: 'Danh sách các jobs chứa cảnh báo chấn thương.' })
  listImpairments(@Query('userId') userId?: string) {
    return this.jobsService.listImpairmentAlerts(userId);
  }

  /** GET /jobs/:id — Lấy trạng thái và toàn bộ kết quả job */
  @Get(':id')
  @ApiOperation({
    summary: 'Lấy chi tiết và kết quả của một job theo UUID',
    description: 'Trả về trạng thái xử lý (PENDING, PROCESSING, DONE, FAILED), điểm số và URL kết quả JSON từ Supabase Storage.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job cần truy vấn', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @ApiResponse({ status: 200, description: 'Chi tiết thông tin job.' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy job với ID tương ứng.' })
  findOne(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }

  /**
   * GET /jobs/:id/health-alerts — Chỉ lấy anomaly detection data
   * Trả về: { alertCount, hasImpairment, healthAlerts[], jointStates{} }
   */
  @Get(':id/health-alerts')
  @ApiOperation({
    summary: 'Lấy dữ liệu Anomaly Detection & Máy trạng thái sức khỏe khớp',
    description: 'Chỉ trả về các thông tin cảnh báo chấn thương (healthAlerts) và trạng thái các khớp (jointStates) của bài tập.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job', example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' })
  @ApiResponse({ status: 200, description: 'Thông tin cảnh báo chấn thương của job.' })
  getHealthAlerts(@Param('id') id: string) {
    return this.jobsService.getHealthAlerts(id);
  }

  /**
   * PATCH /jobs/:id/status — Python Worker báo hoàn thành
   * Yêu cầu header: x-worker-secret
   * Body bao gồm cả healthAlerts và jointStates từ Anomaly Detection pipeline.
   */
  @Patch(':id/status')
  @UseGuards(WorkerAuthGuard)
  @ApiSecurity('x-worker-secret')
  @ApiOperation({
    summary: 'Python Worker callback cập nhật trạng thái job',
    description: 'Endpoint bảo mật dành cho Python Worker gọi sau khi phân tích xong video để cập nhật trạng thái (DONE/FAILED), score, resultUrl và mảng cảnh báo healthAlerts.',
  })
  @ApiParam({ name: 'id', description: 'UUID của job cần cập nhật' })
  @ApiResponse({ status: 200, description: 'Cập nhật trạng thái thành công.' })
  @ApiResponse({ status: 401, description: 'Header x-worker-secret không hợp lệ hoặc bị thiếu.' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobsService.updateJobStatus(id, dto);
  }
}
