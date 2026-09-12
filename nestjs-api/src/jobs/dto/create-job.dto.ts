import { IsString, IsUrl, IsOptional, MaxLength } from 'class-validator';

export class CreateJobDto {
  @IsUrl({}, { message: 'videoUrl phải là URL hợp lệ' })
  videoUrl: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  userId?: string;
}
