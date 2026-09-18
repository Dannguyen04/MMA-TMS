import {
  IsString,
  IsInt,
  IsArray,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class CandidateExportDto {
  @IsString()
  contractVersion!: string;

  @IsString()
  @Matches(/^exp_[a-zA-Z0-9_\-]+$/)
  exportId!: string;

  @IsString()
  @Matches(/^sha256:[a-fA-F0-9]{64}$/)
  datasetHash!: string;

  @IsString()
  @Matches(/^sha256:[a-fA-F0-9]{64}$/)
  manifestDigest!: string;

  @IsString()
  @Matches(/^sha256:[a-fA-F0-9]{64}$/)
  reviewEvidenceDigest!: string;

  @IsString()
  @Matches(/^sha256:[a-fA-F0-9]{64}$/)
  qualityEvidenceDigest!: string;

  @IsString()
  policyVersion!: string;

  @IsString()
  sourceSchemaVersion!: string;

  @IsInt()
  @Min(0)
  sampleCount!: number;

  @IsString()
  @Matches(/^sha256:[a-fA-F0-9]{64}$/)
  coveredActionIdsHash!: string;

  @IsString()
  candidateStatus!: string;

  @IsArray()
  @IsString({ each: true })
  readinessGaps!: string[];

  @IsString()
  createdAt!: string;

  @IsOptional()
  @IsString()
  sourceJobId?: string;
}

