import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CoachingService } from './coaching.service.js';
import { AccessTokenGuard, AuthorizationGuard } from '../shared/guards/auth.guard.js';
import { CurrentUser } from '../shared/decorators/auth.decorator.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { USER } from '../shared/types/user.role.js';
import {
  CreateAssignmentDto,
  UploadVideoDto,
  CreateAnalysisJobDto,
  PersistWorkerResultDto,
  ReviewFindingDto,
  CoachCorrectionDto,
  SelectReferenceDto,
  RevokeReferenceDto,
  CreateBaselineDto,
} from './dto/coaching.dto.js';

@ApiTags('Coaching Loop')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@Controller('coaching')
export class CoachingController {
  constructor(private readonly coachingService: CoachingService) {}

  @Post('assignments')
  @ApiOperation({ summary: 'Coach creates assignment for fighter' })
  @HttpCode(HttpStatus.CREATED)
  async createAssignment(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssignmentDto,
  ) {
    if (user.role !== USER.ADMIN) {
      if (user.role !== USER.COACH) {
        throw new ForbiddenException('Only coaches or admins can create assignments.');
      }
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) {
        throw new ForbiddenException('Authenticated user is not registered as a coach.');
      }
      if (dto.coachId && dto.coachId !== coach.id) {
        throw new ForbiddenException('Cannot create assignment for a different coach.');
      }
      dto.coachId = coach.id;
    }
    return this.coachingService.createAssignment(dto);
  }

  @Post('videos')
  @ApiOperation({ summary: 'Athlete or coach uploads video for session' })
  @HttpCode(HttpStatus.CREATED)
  async uploadVideo(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UploadVideoDto,
  ) {
    if (user.role === USER.FIGHTER) {
      const fighter = await this.coachingService.getFighterByUserId(user.id);
      if (!fighter || fighter.id !== dto.fighterId) {
        throw new ForbiddenException('Fighter can only upload videos for themselves.');
      }
    } else if (user.role === USER.COACH) {
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) {
        throw new ForbiddenException('Authenticated user is not registered as a coach.');
      }
      await this.coachingService.verifyCoachAuthorization(coach.id, dto.fighterId);
    } else if (user.role !== USER.ADMIN) {
      throw new ForbiddenException('Unauthorized to upload videos.');
    }
    return this.coachingService.uploadVideo(dto, user.id);
  }

  @Post('jobs')
  @ApiOperation({ summary: 'Create analysis job for uploaded video' })
  @HttpCode(HttpStatus.CREATED)
  async createAnalysisJob(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAnalysisJobDto,
  ) {
    if (user.role === USER.FIGHTER) {
      const fighter = await this.coachingService.getFighterByUserId(user.id);
      if (!fighter || fighter.id !== dto.fighterId) {
        throw new ForbiddenException('Fighter can only create jobs for their own videos.');
      }
    } else if (user.role === USER.COACH) {
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      await this.coachingService.verifyCoachAuthorization(coach.id, dto.fighterId);
    }
    return this.coachingService.createAnalysisJob(dto, user.id);
  }

  @Post('videos/:videoId/reanalyze')
  @ApiOperation({ summary: 'Non-destructive re-analysis of a video creating new revision' })
  @HttpCode(HttpStatus.CREATED)
  async reanalyzeVideo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('videoId') videoId: string,
    @Body('fighterId') fighterId: string,
  ) {
    if (user.role === USER.FIGHTER) {
      const fighter = await this.coachingService.getFighterByUserId(user.id);
      if (!fighter || fighter.id !== fighterId) {
        throw new ForbiddenException('Fighter can only reanalyze their own videos.');
      }
    } else if (user.role === USER.COACH) {
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      await this.coachingService.verifyCoachAuthorization(coach.id, fighterId);
    }
    return this.coachingService.reanalyzeVideo(videoId, fighterId, user.id);
  }

  @Post('results')
  @ApiOperation({ summary: 'Persist structured worker analysis result' })
  @HttpCode(HttpStatus.OK)
  async persistWorkerResult(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PersistWorkerResultDto,
  ) {
    return this.coachingService.persistWorkerResult(dto, user.id);
  }

  @Post('findings/review')
  @ApiOperation({ summary: 'Coach approves or rejects a specific finding' })
  @HttpCode(HttpStatus.OK)
  async reviewFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewFindingDto,
  ) {
    if (user.role !== USER.ADMIN) {
      if (user.role !== USER.COACH) {
        throw new ForbiddenException('Only coaches or admins can review findings.');
      }
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      if (dto.coachId && dto.coachId !== coach.id) {
        throw new ForbiddenException('Cannot review findings on behalf of another coach.');
      }
      dto.coachId = coach.id;
    }
    return this.coachingService.reviewFinding(dto);
  }

  @Post('corrections')
  @ApiOperation({ summary: 'Coach submits append-only correction revision' })
  @HttpCode(HttpStatus.CREATED)
  async submitCoachCorrection(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CoachCorrectionDto,
  ) {
    if (user.role !== USER.ADMIN) {
      if (user.role !== USER.COACH) {
        throw new ForbiddenException('Only coaches or admins can submit corrections.');
      }
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      if (dto.coachId && dto.coachId !== coach.id) {
        throw new ForbiddenException('Cannot submit corrections on behalf of another coach.');
      }
      dto.coachId = coach.id;
    }
    return this.coachingService.submitCoachCorrection(dto);
  }

  @Post('references')
  @ApiOperation({ summary: 'Coach selects action as reference standard' })
  @HttpCode(HttpStatus.CREATED)
  async selectReference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SelectReferenceDto,
  ) {
    if (user.role !== USER.ADMIN) {
      if (user.role !== USER.COACH) {
        throw new ForbiddenException('Only coaches or admins can select reference standards.');
      }
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      if (dto.coachId && dto.coachId !== coach.id) {
        throw new ForbiddenException('Cannot select references on behalf of another coach.');
      }
      dto.coachId = coach.id;
    }
    return this.coachingService.selectReference(dto);
  }

  @Post('references/revoke')
  @ApiOperation({ summary: 'Coach revokes reference standard' })
  @HttpCode(HttpStatus.OK)
  async revokeReference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RevokeReferenceDto,
  ) {
    if (user.role !== USER.ADMIN) {
      if (user.role !== USER.COACH) {
        throw new ForbiddenException('Only coaches or admins can revoke reference standards.');
      }
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      if (dto.coachId && dto.coachId !== coach.id) {
        throw new ForbiddenException('Cannot revoke references on behalf of another coach.');
      }
      dto.coachId = coach.id;
    }
    return this.coachingService.revokeReference(dto);
  }

  @Post('baselines')
  @ApiOperation({ summary: 'Create or update baseline snapshot' })
  @HttpCode(HttpStatus.CREATED)
  async createBaseline(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBaselineDto,
  ) {
    if (user.role !== USER.ADMIN && user.role !== USER.COACH) {
      throw new ForbiddenException('Only coaches or admins can create baselines.');
    }
    return this.coachingService.createBaseline(dto);
  }

  @Get('loop-state/:fighterId')
  @ApiOperation({ summary: 'Query comprehensive coaching loop state' })
  async getCoachingLoopState(
    @CurrentUser() user: AuthenticatedUser,
    @Param('fighterId') fighterId: string,
    @Query('sessionId') sessionId?: string,
  ) {
    if (user.role === USER.FIGHTER) {
      const fighter = await this.coachingService.getFighterByUserId(user.id);
      if (!fighter || fighter.id !== fighterId) {
        throw new ForbiddenException('Fighter can only view their own coaching loop state.');
      }
    } else if (user.role === USER.COACH) {
      const coach = await this.coachingService.getCoachByUserId(user.id);
      if (!coach) throw new ForbiddenException('Not a registered coach.');
      await this.coachingService.verifyCoachAuthorization(coach.id, fighterId);
    }
    return this.coachingService.getCoachingLoopState(fighterId, sessionId);
  }
}
