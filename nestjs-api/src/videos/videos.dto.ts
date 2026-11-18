import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export const VIDEO_TRAINING_TYPES = [
  'SHADOW_BOXING',
  'PAD_WORK',
  'HEAVY_BAG',
  'SPARRING',
] as const;

export const VIDEO_CAMERA_ANGLES = ['FRONT', 'SIDE', 'DIAGONAL'] as const;

export class UploadVideoQueryDto {
  @IsUUID()
  fighterId: string;

  @IsString()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(VIDEO_TRAINING_TYPES)
  trainingType: (typeof VIDEO_TRAINING_TYPES)[number];

  @IsEnum(VIDEO_CAMERA_ANGLES)
  cameraAngle: (typeof VIDEO_CAMERA_ANGLES)[number];

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(86_400_000)
  durationMs: number;

  @IsString()
  @MaxLength(255)
  originalFilename: string;
}

export const VIDEO_UPLOAD_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const;

/**
 * Body of `POST /videos/upload-url`: the same metadata as the streamed upload,
 * plus the file's type and size, which the browser declares before it sends
 * the bytes straight to storage.
 */
export class CreateVideoUploadDto extends UploadVideoQueryDto {
  @IsString()
  @IsIn(VIDEO_UPLOAD_MIME_TYPES)
  contentType: (typeof VIDEO_UPLOAD_MIME_TYPES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  fileSizeBytes: number;
}

export class ListVideosQueryDto {
  @IsOptional()
  @IsUUID()
  fighterId?: string;

  @IsOptional()
  @IsEnum(VIDEO_TRAINING_TYPES)
  trainingType?: (typeof VIDEO_TRAINING_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
