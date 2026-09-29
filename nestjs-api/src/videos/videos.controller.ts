import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { IsUUID } from 'class-validator';
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
import { USER } from '../shared/types/user.role.js';
import { ListVideosQueryDto, UploadVideoQueryDto } from './videos.dto.js';
import { VideosService } from './videos.service.js';

class VideoIdParamsDto {
  @IsUUID()
  id: string;
}

@Controller('videos')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload')
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.ADMIN)
  @ResponseMessage('Video uploaded successfully')
  async upload(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: UploadVideoQueryDto,
    @Req() request: Request,
  ) {
    return this.videosService.upload(this.requireActor(actor), query, request);
  }

  @Get()
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ResponseMessage('Videos retrieved successfully')
  list(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListVideosQueryDto,
  ) {
    return this.videosService.list(this.requireActor(actor), query);
  }

  @Get(':id')
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  @ResponseMessage('Video retrieved successfully')
  get(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
  ) {
    return this.videosService.getById(this.requireActor(actor), params.id);
  }

  @Get(':id/content')
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.DOCTOR, USER.ADMIN)
  async content(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
    @Res() response: Response,
  ) {
    const url = await this.videosService.signedContentUrl(
      this.requireActor(actor),
      params.id,
    );
    response.setHeader('Cache-Control', 'private, no-store');
    response.redirect(HttpStatus.TEMPORARY_REDIRECT, url);
  }

  @Delete(':id')
  @RequireRoles(USER.FIGHTER, USER.COACH, USER.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Video deleted successfully')
  remove(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
  ) {
    return this.videosService.remove(this.requireActor(actor), params.id);
  }

  private requireActor(
    actor: AuthenticatedUser | undefined,
  ): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
