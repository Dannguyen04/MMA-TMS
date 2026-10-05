import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../shared/decorators/auth.decorator.js';
import { AccessTokenGuard, AuthorizationGuard } from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { MovementJobParamsDto, MovementSessionParamsDto, MovementReviewDto } from './movement-review.dto.js';
import { MovementReviewService } from './movement-review.service.js';

@Controller('movement-evidence')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class MovementReviewController {
  constructor(private readonly service: MovementReviewService) {}

  @Get('sessions/:sessionId/exercises')
  @RequirePermissions({ allOf: ['movement.evidence:read'] })
  exercises(@CurrentUser() actor: AuthenticatedUser, @Param() params: MovementSessionParamsDto) {
    return this.service.exercises(actor, params.sessionId);
  }

  @Get('jobs/:jobId/reviews')
  @RequirePermissions({ allOf: ['movement.evidence:read'] })
  read(@CurrentUser() actor: AuthenticatedUser, @Param() params: MovementJobParamsDto) {
    return this.service.read(actor, params.jobId);
  }

  @Post('jobs/:jobId/reviews')
  @RequirePermissions({ allOf: ['movement.evidence:read', 'movement.evidence:review'] })
  append(@CurrentUser() actor: AuthenticatedUser, @Param() params: MovementJobParamsDto, @Body() dto: MovementReviewDto) {
    return this.service.append(actor, params.jobId, dto);
  }
}
