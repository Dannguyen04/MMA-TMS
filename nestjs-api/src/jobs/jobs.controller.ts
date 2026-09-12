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
import { WorkerAuthGuard } from './guards/worker-auth.guard.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  /** POST /jobs — Tạo job phân tích video mới */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateJobDto) {
    return this.jobsService.createJob(dto);
  }

  /** GET /jobs — Danh sách jobs (tùy chọn lọc theo userId) */
  @Get()
  list(@Query('userId') userId?: string) {
    return this.jobsService.listJobs(userId);
  }

  /** GET /jobs/:id — Lấy trạng thái và kết quả job */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.jobsService.getJob(id);
  }

  /** PATCH /jobs/:id/status — Python Worker báo hoàn thành (Yêu cầu Worker Secret) */
  @Patch(':id/status')
  @UseGuards(WorkerAuthGuard)
  updateStatus(
    @Param('id') id: string,
    @Body() data: { status: string; resultUrl?: string; score?: number },
  ) {
    return this.jobsService.updateJobStatus(id, data);
  }
}
