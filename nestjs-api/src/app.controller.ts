import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { AppReadinessService } from './app-readiness.service.js';
import { ApiSuccessEnvelope } from './shared/decorators/api-envelope.decorator.js';
import { ResponseMessage } from './shared/decorators/response-message.decorator.js';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly readinessService: AppReadinessService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get base API message',
    description: 'Returns API operational status greeting',
  })
  @ResponseMessage('API response retrieved successfully')
  @ApiSuccessEnvelope({ message: 'API response retrieved successfully' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({
    summary: 'System health check',
    description: 'Returns current service health, uptime, and timestamp',
  })
  @ResponseMessage('Health check successful')
  @ApiSuccessEnvelope({ message: 'Health check successful' })
  getHealth() {
    return {
      status: 'ok',
      service: 'mma-tms-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({
    summary: 'System readiness check',
    description: 'Checks PostgreSQL and Redis before accepting traffic',
  })
  @ResponseMessage('Readiness check successful')
  @ApiSuccessEnvelope({ message: 'Readiness check successful' })
  getReady() {
    return this.readinessService.check();
  }
}
