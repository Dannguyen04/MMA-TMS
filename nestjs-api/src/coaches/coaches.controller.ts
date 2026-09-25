import {
  Controller,
  Get,
  HttpStatus,
  Param,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  ApiForbiddenEnvelope,
  ApiNotFoundEnvelope,
  ApiSuccessEnvelope,
  ApiUnauthorizedEnvelope,
  ApiValidationErrorEnvelope,
} from '../shared/decorators/api-envelope.decorator.js';
import {
  CurrentUser,
  RequirePermissions,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import { FIGHTER_PERMISSIONS } from '../fighters/fighters.model.js';
import {
  PublicFighterDto,
  CoachIdParamsDto,
  ListCoachFightersQueryDto,
} from './coaches.dto.js';
import { CoachesService } from './coaches.service.js';

@ApiTags('Coaches')
@ApiBearerAuth()
@Controller('coaches')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@UsePipes(appZodValidationPipe)
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  @Get(':id/fighters')
  @RequirePermissions({ allOf: [FIGHTER_PERMISSIONS.GET_ALL] })
  @ApiOperation({
    summary: "List a Coach's assigned Fighters",
    description:
      'Retrieves the paginated, currently-assigned Fighter roster for a Coach; ' +
      'a Coach may only request its own profile, Admin may request any active Coach',
  })
  @ResponseMessage('Get coach fighters list successfully')
  @ApiSuccessEnvelope({
    status: HttpStatus.OK,
    message: 'Get coach fighters list successfully',
    model: PublicFighterDto,
    isPaginated: true,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope(
    'Requires fighter:get_all permission; Coach limited to its own assigned Fighters',
  )
  @ApiNotFoundEnvelope('COACH_NOT_FOUND', 'Coach profile not found or inactive')
  async findAssignedFighters(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: CoachIdParamsDto,
    @Query() query: ListCoachFightersQueryDto,
  ) {
    return this.coachesService.findAssignedFighters(
      this.requireActor(actor),
      params.id,
      query,
    );
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
