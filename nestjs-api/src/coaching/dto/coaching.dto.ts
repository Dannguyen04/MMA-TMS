import {
  IsString,
  IsUUID,
  IsOptional,
  IsNumber,
  IsArray,
  IsBoolean,
  IsIn,
  Min,
  Max,
  ValidateNested,
  IsInt,
  ArrayMaxSize,
  ArrayUnique,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateAssignmentDto {
  @IsUUID()
  coachId: string;

  @IsUUID()
  fighterId: string;

  @IsString()
  title: string;

  @IsOptional()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  sessionType?: string;

  @IsOptional()
  @IsString()
  planTitle?: string;
}

export class UploadVideoDto {
  @IsUUID()
  fighterId: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsString()
  title: string;

  @IsString()
  storageKey: string;

  @IsOptional()
  @IsNumber()
  fileSizeBytes?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  durationMs?: number;

  @IsOptional()
  @IsString()
  cameraAngle?: string;
}

export class CreateAnalysisJobDto {
  @IsUUID()
  videoId: string;

  @IsUUID()
  fighterId: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsUUID()
  algorithmConfigId?: string;
}

export class PersistActionAssessmentDto {
  @IsString()
  actionId: string;

  @IsString()
  technique: string;

  @IsString()
  limbSide: string;

  @IsString()
  assessmentStatus: string;

  @IsOptional()
  @IsNumber()
  overallScore?: number | null;

  @IsOptional()
  @IsString()
  grade?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number | null;

  @IsOptional()
  @IsString()
  rubricId?: string;

  @IsOptional()
  evidence?: Record<string, any>;

  @IsOptional()
  phases?: Record<string, any>;

  @IsOptional()
  kinematicFeatures?: Record<string, any>;

  @IsOptional()
  criteriaScores?: Record<string, any>;

  @IsOptional()
  findings?: any[];

  @IsOptional()
  provenance?: Record<string, any>;
}

export class PersistWorkerResultDto {
  @IsUUID()
  jobId: string;

  @IsOptional()
  @IsUUID()
  analysisId?: string;

  @IsOptional()
  @IsNumber()
  overallScore?: number;

  @IsArray()
  @ArrayMaxSize(10000)
  @ArrayUnique((action: PersistActionAssessmentDto) => action.actionId)
  @ValidateNested({ each: true })
  @Type(() => PersistActionAssessmentDto)
  actions: PersistActionAssessmentDto[];

  @IsOptional()
  provenance?: Record<string, any>;
}

export class ReviewFindingDto {
  @IsOptional()
  @IsUUID()
  coachId: string;

  @IsUUID()
  analysisId: string;

  @IsString()
  actionId: string;

  @IsString()
  findingId: string;

  @IsIn(['approved', 'rejected', 'corrected'])
  status: 'approved' | 'rejected' | 'corrected';

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  correctedLabel?: string;
}

export class CoachCorrectionDto {
  @IsOptional()
  @IsUUID()
  coachId: string;

  @IsUUID()
  analysisId: string;

  @IsString()
  reviewText: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  techniqueRating?: number;

  @IsOptional()
  correctedStrikeCounts?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  overridesAi?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  revision?: number;

  @IsOptional()
  @IsUUID()
  supersedesId?: string;
}

export class SelectReferenceDto {
  @IsUUID()
  coachId: string;

  @IsUUID()
  fighterId: string;

  @IsString()
  technique: string;

  @IsString()
  actionId: string;

  @IsUUID()
  videoId: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;
}

export class RevokeReferenceDto {
  @IsUUID()
  coachId: string;

  @IsUUID()
  referenceId: string;

  @IsString()
  reason: string;
}

export class CreateBaselineDto {
  @IsUUID()
  fighterId: string;

  @IsUUID()
  algorithmConfigId: string;

  @IsString()
  techniqueType: string;

  @IsString()
  limbSide: string;

  @IsNumber()
  romBaselineDeg: number;

  @IsNumber()
  velocityBaseline: number;

  @IsNumber()
  jerkThreshold: number;

  @IsOptional()
  covarianceMatrix?: any[];

  @IsOptional()
  @IsNumber()
  sampleCount?: number;

  @IsOptional()
  @IsNumber()
  sampleSessions?: number;

  @IsOptional()
  @IsString()
  sourceDescription?: string;

  @IsOptional()
  @IsUUID()
  approvedById?: string;
}

