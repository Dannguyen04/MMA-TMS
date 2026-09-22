import { createZodDto } from 'nestjs-zod';
import {
  fighterPerformanceParamsSchema,
  historyQuerySchema,
  performanceMetricSchema,
  performanceSummarySchema,
  teamPerformanceRowSchema,
  teamQuerySchema,
  techniqueDetailSchema,
  techniqueParamsSchema,
  weeklyVolumeQuerySchema,
  weeklyVolumeSchema,
} from './performance.model.js';

export class FighterPerformanceParamsDto extends createZodDto(
  fighterPerformanceParamsSchema,
) {}
export class TechniqueParamsDto extends createZodDto(techniqueParamsSchema) {}
export class HistoryQueryDto extends createZodDto(historyQuerySchema) {}
export class TeamQueryDto extends createZodDto(teamQuerySchema) {}
export class WeeklyVolumeQueryDto extends createZodDto(
  weeklyVolumeQuerySchema,
) {}
export class PerformanceMetricResponseDto extends createZodDto(
  performanceMetricSchema,
) {}
export class PerformanceSummaryResponseDto extends createZodDto(
  performanceSummarySchema,
) {}
export class TechniqueDetailResponseDto extends createZodDto(
  techniqueDetailSchema,
) {}
export class TeamPerformanceResponseDto extends createZodDto(
  teamPerformanceRowSchema,
) {}
export class WeeklyVolumeResponseDto extends createZodDto(weeklyVolumeSchema) {}
