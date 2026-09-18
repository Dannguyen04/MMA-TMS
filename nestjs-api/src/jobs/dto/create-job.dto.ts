import { IsString, IsUrl, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({
    description: 'URL công khai của video đòn đánh cần phân tích (Supabase Storage hoặc HTTP URL)',
    example: 'https://wskisxkpbhisnqfpjqrm.supabase.co/storage/v1/object/public/videos/sample.mp4',
  })
  @IsUrl({}, { message: 'videoUrl phải là URL hợp lệ' })
  videoUrl: string;

  @ApiPropertyOptional({
    description: 'ID người dùng (Võ sĩ) thực hiện upload video',
    example: 'u-minh-tran',
    maxLength: 64,
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;
}

