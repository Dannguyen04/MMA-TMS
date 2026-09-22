import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
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
import { NavigationBadgeCountsDto } from './navigation.dto.js';
import { NavigationService } from './navigation.service.js';

@ApiTags('Navigation')
@ApiBearerAuth()
@Controller('navigation')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
export class NavigationController {
  constructor(private readonly navigationService: NavigationService) {}

  @Get('badges')
  @ApiOperation({
    summary: 'Get scoped navigation badge counts',
    description:
      'Returns unread notifications and the operational count allowed for the authenticated role',
  })
  @ResponseMessage('Navigation badges retrieved successfully')
  @ApiSuccessEnvelope({
    message: 'Navigation badges retrieved successfully',
    model: NavigationBadgeCountsDto,
  })
  @ApiUnauthorizedEnvelope()
  getBadges(@CurrentUser() actor: AuthenticatedUser | undefined) {
    if (!actor) throw authenticationRequired();
    return this.navigationService.getBadges(actor);
  }
}
