import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUrl, IsOptional, MaxLength } from 'class-validator';

export class CreateJobDto {
  @ApiProperty({
    description: 'Public URL to the uploaded video file in storage',
    example: 'https://example.com/videos/sparring-01.mp4',
  })
  @IsUrl({}, { message: 'videoUrl phải là URL hợp lệ' })
  videoUrl: string;

  @ApiPropertyOptional({
    description: 'User ID of the athlete',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;
}
