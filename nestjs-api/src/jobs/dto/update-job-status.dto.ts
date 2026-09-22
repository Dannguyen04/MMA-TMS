import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { HealthAlert, JointStatesMap } from '../../database/schema.js';

export const workerJobStatuses = ['PROCESSING', 'DONE', 'FAILED'] as const;
export type WorkerJobStatus = (typeof workerJobStatuses)[number];

/** Dữ liệu trạng thái do Python worker gửi về cho một lần xử lý. */
export class UpdateJobStatusDto {
  @ApiProperty({
    description: 'Trạng thái xử lý hợp lệ do worker báo về',
    enum: workerJobStatuses,
    example: 'DONE',
  })
  @IsIn(workerJobStatuses)
  status!: WorkerJobStatus;

  @ApiPropertyOptional({
    description: 'Địa chỉ kết quả đã được lưu bởi storage adapter',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  resultUrl?: string;

  @ApiPropertyOptional({
    description: 'Điểm kỹ thuật tổng thể từ 0 đến 100',
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  @ApiPropertyOptional({
    description: 'Mã lỗi ổn định, an toàn để hiển thị khi xử lý thất bại',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  errorCode?: string;

  @ApiPropertyOptional({
    description: 'Thông báo lỗi đã loại bỏ dữ liệu nhạy cảm',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  errorMessage?: string;

  @ApiPropertyOptional({
    description: 'Danh sách cảnh báo sức khỏe đã xác nhận',
    type: 'array',
  })
  @IsOptional()
  @IsArray()
  healthAlerts?: HealthAlert[];

  @ApiPropertyOptional({
    description: 'Trạng thái sức khỏe cuối cùng của từng khớp',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  jointStates?: JointStatesMap;
}
