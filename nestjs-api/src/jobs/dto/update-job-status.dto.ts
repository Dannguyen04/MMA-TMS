import { IsObject, IsArray, IsOptional, ValidateNested, IsString, IsNumber, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import type { HealthAlert, JointStatesMap } from '../../database/schema.js';

// ─── UpdateJobStatusDto ───────────────────────────────────────────────────────

/**
 * DTO dùng cho PATCH /jobs/:id/status
 * Gọi bởi Python Worker sau khi hoàn thành phân tích video.
 */
export class UpdateJobStatusDto {
  @IsString()
  status: string;

  @IsOptional()
  @IsString()
  resultUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  score?: number;

  /**
   * Mảng AlertPayload từ SessionHealthMonitor.get_confirmed_alerts().
   * Chỉ chứa các alert CONFIRMED_IMPAIRMENT.
   */
  @IsOptional()
  @IsArray()
  healthAlerts?: HealthAlert[];

  /**
   * Snapshot { JointName → JointHealthState } tại cuối video.
   * Vd: { "LEFT_SHOULDER": "CONFIRMED_IMPAIRMENT", "RIGHT_KNEE": "HEALTHY" }
   */
  @IsOptional()
  @IsObject()
  jointStates?: JointStatesMap;
}
