import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service.js';
import { ResponseMessage } from './shared/decorators/response-message.decorator.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ResponseMessage('API response retrieved successfully')
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ResponseMessage('Health check successful')
  getHealth() {
    return {
      status: 'ok',
      service: 'mma-tms-api',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
