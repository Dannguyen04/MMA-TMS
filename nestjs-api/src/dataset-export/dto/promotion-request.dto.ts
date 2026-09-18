import {
  IsString,
  ValidateNested,
  IsArray,
  IsOptional,
  IsNotEmpty,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CandidateExportDto } from './candidate-export.dto.js';

export class ReviewerInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  reviewerId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  role!: string;
}

export class ReviewEvidencePayloadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewerInfoDto)
  reviewers!: ReviewerInfoDto[];

  @IsString()
  @IsNotEmpty()
  policyVersion!: string;
}

export class QualityEvidencePayloadDto {
  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsString()
  @IsNotEmpty()
  policyVersion!: string;
}

export class PromotionRequestDto {
  @ValidateNested()
  @Type(() => CandidateExportDto)
  candidate!: CandidateExportDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ReviewEvidencePayloadDto)
  reviewEvidence?: ReviewEvidencePayloadDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QualityEvidencePayloadDto)
  qualityEvidence?: QualityEvidencePayloadDto;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  nonce!: string;
}

export class RevocationRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  reason!: string;
}
