import {
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
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
  RequireRoles,
} from '../shared/decorators/auth.decorator.js';
import { ResponseMessage } from '../shared/decorators/response-message.decorator.js';
import { authenticationRequired } from '../shared/errors/access.error.js';
import {
  AccessTokenGuard,
  AuthorizationGuard,
} from '../shared/guards/auth.guard.js';
import type { AuthenticatedUser } from '../shared/models/auth-context.model.js';
import { appZodValidationPipe } from '../shared/pipes/zod-validation.pipe.js';
import {
  PublicVideoDto,
  ListVideosQueryDto,
  UploadVideoQueryDto,
  VideoIdParamsDto,
  VideoPageDto,
} from './videos.dto.js';
import { videoSizeInvalid } from './videos.error.js';
import { VideosService } from './videos.service.js';
import { parseByteRange, sendStoredObject } from './stored-object.response.js';

@ApiTags('Videos')
@ApiBearerAuth()
@Controller('videos')
@UseGuards(AccessTokenGuard, AuthorizationGuard)
@RequireRoles('FIGHTER', 'COACH', 'DOCTOR', 'ADMIN')
@UsePipes(appZodValidationPipe)
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  @ApiOperation({ summary: 'List videos in the caller assignment scope' })
  @ResponseMessage('Videos retrieved successfully')
  @ApiSuccessEnvelope({
    message: 'Videos retrieved successfully',
    model: VideoPageDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  list(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: ListVideosQueryDto,
  ) {
    return this.videosService.list(this.actor(actor), query);
  }

  @Post('upload')
  @RequireRoles('FIGHTER', 'COACH', 'ADMIN')
  @ApiOperation({
    summary: 'Stream a private video into backend-owned storage',
  })
  @ResponseMessage('Video uploaded successfully')
  @HttpCode(HttpStatus.CREATED)
  @ApiSuccessEnvelope({
    status: HttpStatus.CREATED,
    message: 'Video uploaded successfully',
    model: PublicVideoDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  upload(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Query() query: UploadVideoQueryDto,
    @Headers('content-type') contentType: string | undefined,
    @Headers('content-length') contentLength: string | undefined,
    @Req() request: Request,
  ) {
    const fileSizeBytes = Number(contentLength);
    if (!Number.isSafeInteger(fileSizeBytes)) throw videoSizeInvalid();
    return this.videosService.upload(
      this.actor(actor),
      {
        ...query,
        description: query.description ?? null,
        sessionId: query.sessionId ?? null,
        mimeType: contentType?.split(';')[0].trim().toLowerCase() ?? '',
        fileSizeBytes,
      },
      request,
      randomUUID(),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one video in the caller assignment scope' })
  @ResponseMessage('Video retrieved successfully')
  @ApiSuccessEnvelope({
    message: 'Video retrieved successfully',
    model: PublicVideoDto,
  })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('VIDEO_NOT_FOUND', 'Video was not found')
  findOne(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
  ) {
    return this.videosService.findOne(this.actor(actor), params.id);
  }

  @Get(':id/content')
  @ApiOperation({ summary: 'Stream protected video bytes with range support' })
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('VIDEO_NOT_FOUND', 'Video was not found')
  async content(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
    @Headers('range') rangeHeader: string | undefined,
    @Res() response: Response,
  ) {
    const content = await this.videosService.openContent(
      this.actor(actor),
      params.id,
      parseByteRange(rangeHeader),
    );
    sendStoredObject(response, content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a video owned by the caller or an admin' })
  @ResponseMessage('Video deleted successfully')
  @ApiSuccessEnvelope({ message: 'Video deleted successfully' })
  @ApiValidationErrorEnvelope()
  @ApiUnauthorizedEnvelope()
  @ApiForbiddenEnvelope()
  @ApiNotFoundEnvelope('VIDEO_NOT_FOUND', 'Video was not found')
  delete(
    @CurrentUser() actor: AuthenticatedUser | undefined,
    @Param() params: VideoIdParamsDto,
  ) {
    return this.videosService.delete(
      this.actor(actor),
      params.id,
      randomUUID(),
    );
  }

  private actor(actor: AuthenticatedUser | undefined): AuthenticatedUser {
    if (!actor) throw authenticationRequired();
    return actor;
  }
}
