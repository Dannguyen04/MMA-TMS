import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateJobDto {
  @ApiProperty({
    description: 'ID video riêng tư đã được tải lên và kiểm tra quyền truy cập',
    format: 'uuid',
  })
  @IsUUID('4', { message: 'videoId phải là UUID hợp lệ' })
  videoId: string;
}
