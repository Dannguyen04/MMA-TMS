import { IsUUID, IsOptional, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({
    description: 'ID của video đã upload và được phân quyền trong hệ thống',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  @IsUUID()
  videoId: string;

  @IsOptional()
  @IsUUID()
  sessionExerciseId?: string;

  @IsOptional()
  @IsIn(['whole_body_v1', 'upper_body_v1', 'lower_body_v1'])
  evidenceProtocol?: 'whole_body_v1' | 'upper_body_v1' | 'lower_body_v1';
}
