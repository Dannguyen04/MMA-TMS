import { IsObject, IsArray, IsOptional, ValidateNested, IsString, IsNumber, IsBoolean, IsIn, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { HealthAlert, JointStatesMap } from '../../database/schema.js';

// ─── UpdateJobStatusDto ───────────────────────────────────────────────────────

/**
 * DTO dùng cho PATCH /jobs/:id/status
 * Gọi bởi Python Worker sau khi hoàn thành phân tích video.
 */
export class UpdateJobStatusDto {
  @ApiProperty({
    description: 'Trạng thái xử lý của job (DONE hoặc FAILED)',
    enum: ['DONE', 'FAILED'],
    example: 'DONE',
  })
  @IsString()
  status: string;

  @ApiPropertyOptional({
    description: 'URL chứa file JSON kết quả phân tích AI chi tiết trên Supabase Storage',
    example: 'https://wskisxkpbhisnqfpjqrm.supabase.co/storage/v1/object/public/analysis-results/job-123-result.json',
  })
  @IsOptional()
  @IsString()
  resultUrl?: string;

  @ApiPropertyOptional({
    description: 'Điểm kỹ thuật tổng thể (0 - 100)',
    example: 85,
    minimum: 0,
    maximum: 100,
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
    description: 'Danh sách cảnh báo chấn thương CONFIRMED_IMPAIRMENT do Anomaly Detection Engine phát hiện',
    example: [
      {
        joint: 'RIGHT_SHOULDER',
        state: 'CONFIRMED_IMPAIRMENT',
        severity: 'high',
        triggerTimeMs: 1250,
        windowStartMs: 500,
        consecutiveLowRom: 3,
        avgRomRatio: 0.55,
        motionClass: 'POWER_STRIKE',
        recommendation: 'Cảnh báo: Biên độ vận động vai phải bị suy giảm. HLV cần giảm cường độ đấm Cross.',
      },
    ],
  })
  @IsOptional()
  @IsArray()
  healthAlerts?: HealthAlert[];

  /**
   * Snapshot { JointName → JointHealthState } tại cuối video.
   * Vd: { "LEFT_SHOULDER": "CONFIRMED_IMPAIRMENT", "RIGHT_KNEE": "HEALTHY" }
   */
  @ApiPropertyOptional({
    description: 'Bản đồ trạng thái sức khỏe các khớp chính tại thời điểm kết thúc bài tập',
    example: {
      RIGHT_SHOULDER: 'CONFIRMED_IMPAIRMENT',
      LEFT_SHOULDER: 'HEALTHY',
      RIGHT_KNEE: 'HEALTHY',
      LEFT_KNEE: 'HEALTHY',
    },
  })
  @IsOptional()
  @IsObject()
  jointStates?: JointStatesMap;
}

