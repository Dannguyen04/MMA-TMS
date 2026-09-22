import { createZodDto } from 'nestjs-zod';
import {
  publicVideoSchema,
  listVideosQuerySchema,
  uploadVideoQuerySchema,
  videoIdParamsSchema,
  videoPageSchema,
} from './videos.model.js';

export class UploadVideoQueryDto extends createZodDto(uploadVideoQuerySchema) {}
export class ListVideosQueryDto extends createZodDto(listVideosQuerySchema) {}
export class VideoIdParamsDto extends createZodDto(videoIdParamsSchema) {}
export class PublicVideoDto extends createZodDto(publicVideoSchema) {}
export class VideoPageDto extends createZodDto(videoPageSchema) {}
