import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import type { HealthAlert, JointStatesMap } from '../../database/schema.js';

// ─── UpdateJobStatusDto ───────────────────────────────────────────────────────

/**
 * DTO dùng cho PATCH /jobs/:id/status
 * Gọi bởi Python Worker sau khi hoàn thành phân tích video.
 */
export class UpdateJobStatusDto {
  @ApiProperty({
    description: 'New job processing status',
    example: 'DONE',
    enum: ['PENDING', 'PROCESSING', 'DONE', 'FAILED'],
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'Storage URL of the full JSON result',
    example: 'https://example.com/results/job-123.json',
  })
  @IsOptional()
  @IsString()
  resultUrl?: string;

  @ApiPropertyOptional({
    description: 'Overall movement score (0–100)',
    example: 85.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  /**
   * Mảng AlertPayload từ SessionHealthMonitor.get_confirmed_alerts().
   * Chỉ chứa các alert CONFIRMED_IMPAIRMENT.
   */
  @ApiPropertyOptional({
    description:
      'Array of confirmed impairment health alerts from Python worker',
  })
  @IsOptional()
  @IsArray()
  healthAlerts?: HealthAlert[];

  /**
   * Snapshot { JointName → JointHealthState } tại cuối video.
   * Vd: { "LEFT_SHOULDER": "CONFIRMED_IMPAIRMENT", "RIGHT_KNEE": "HEALTHY" }
   */
  @ApiPropertyOptional({
    description: 'Map of final joint health states at end of video session',
  })
  @IsOptional()
  @IsObject()
  jointStates?: JointStatesMap;
}
