import { Injectable, BadRequestException } from '@nestjs/common';
import { CandidateExportDto } from '../dto/candidate-export.dto.js';
import {
  ReviewEvidencePayloadDto,
  QualityEvidencePayloadDto,
} from '../dto/promotion-request.dto.js';

export interface GovernanceVerificationResult {
  passed: boolean;
  decision: 'GOLD_READY' | 'NOT_GOLD_READY';
  readinessGaps: string[];
  reviewPolicyVersion: string;
}

@Injectable()
export class GovernanceVerifierService {
  private readonly supportedPolicyVersions = new Set([
    'dataset-policy-v1',
    'dataset-policy-v2',
  ]);

  private readonly supportedReviewPolicies = new Set([
    'dual_review_consensus_v1.0',
    'expert_supervision_single_expert_technique_v1.0',
    'inter_rater_agreement_v1.0',
    'review-policy-v1',
  ]);

  private readonly supportedQualityPolicies = new Set([
    'quality_policy_v1.0',
    'quality_policy_v2.0',
  ]);

  /**
   * Validates ISO 8601 UTC timestamp format strictly requiring timezone component.
   */
  validateTimezone(timestampStr: string, fieldName: string): Date {
    if (!timestampStr) {
      throw new BadRequestException(`Timestamp field '${fieldName}' cannot be empty.`);
    }

    // Must have timezone indicator ('Z' or '+HH:MM' or '-HH:MM')
    const hasTimezone =
      timestampStr.endsWith('Z') ||
      /[+\-]\d{2}:\d{2}$/.test(timestampStr) ||
      /[+\-]\d{4}$/.test(timestampStr);

    if (!hasTimezone) {
      throw new BadRequestException(
        `Naive timestamp rejected for '${fieldName}': '${timestampStr}'. Timezone offset (e.g. 'Z' or '+00:00') is required.`,
      );
    }

    const date = new Date(timestampStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid timestamp date for '${fieldName}': '${timestampStr}'.`);
    }

    return date;
  }

  /**
   * Evaluates candidate export governance & review consensus policy.
   */
  verifyGovernance(
    candidate: CandidateExportDto,
    reviewEvidence: ReviewEvidencePayloadDto,
    qualityEvidence: QualityEvidencePayloadDto,
  ): GovernanceVerificationResult {
    const gaps: string[] = [];

    // 1. Validate timestamps
    this.validateTimezone(candidate.createdAt, 'candidate.createdAt');

    // 2. Validate policy versions
    if (!this.supportedPolicyVersions.has(candidate.policyVersion)) {
      throw new BadRequestException(
        `Unsupported policyVersion '${candidate.policyVersion}'. Supported: ${Array.from(this.supportedPolicyVersions).join(', ')}`,
      );
    }

    if (!this.supportedReviewPolicies.has(reviewEvidence.policyVersion)) {
      throw new BadRequestException(
        `Unsupported review policyVersion '${reviewEvidence.policyVersion}'.`,
      );
    }

    if (!this.supportedQualityPolicies.has(qualityEvidence.policyVersion)) {
      throw new BadRequestException(
        `Unsupported quality policyVersion '${qualityEvidence.policyVersion}'.`,
      );
    }

    // 3. Quality status check
    if (qualityEvidence.status !== 'pass') {
      gaps.push(`Quality evidence status is '${qualityEvidence.status}', expected 'pass'.`);
    }

    // 4. Sample count requirement (e.g. >= 500 samples for GOLD_READY or policy threshold)
    if (candidate.sampleCount < 1) {
      gaps.push(`Sample count is ${candidate.sampleCount}, expected > 0 samples.`);
    }

    // 5. Review consensus check: distinct reviewers requirement
    const distinctReviewers = new Set(
      reviewEvidence.reviewers.map((r) => r.reviewerId.trim()),
    );

    if (reviewEvidence.reviewers.length !== distinctReviewers.size) {
      gaps.push(
        `Duplicate reviewer IDs detected! Count=${reviewEvidence.reviewers.length}, Distinct=${distinctReviewers.size}.`,
      );
    }

    // Policy specific consensus checks
    if (reviewEvidence.policyVersion.includes('dual_review')) {
      if (distinctReviewers.size < 2) {
        gaps.push(
          `Dual review consensus requires at least 2 distinct reviewers. Found: ${distinctReviewers.size}.`,
        );
      }
      const roles = reviewEvidence.reviewers.map((r) => r.role);
      const hasCoachOrExpert = roles.some((role) =>
        ['coach', 'domain_expert', 'senior_annotator', 'head_coach'].includes(role),
      );
      if (!hasCoachOrExpert) {
        gaps.push('Dual review policy requires at least one reviewer with role coach/domain_expert.');
      }
    } else if (reviewEvidence.policyVersion.includes('expert_supervision')) {
      const expertCount = reviewEvidence.reviewers.filter((r) =>
        ['domain_expert', 'head_coach'].includes(r.role),
      ).length;
      if (expertCount < 1) {
        gaps.push('Expert supervision policy requires at least 1 domain_expert or head_coach.');
      }
    }

    // 6. Existing readiness gaps from candidate
    if (candidate.readinessGaps && candidate.readinessGaps.length > 0) {
      gaps.push(...candidate.readinessGaps);
    }

    const isGoldReady = gaps.length === 0;

    return {
      passed: isGoldReady,
      decision: isGoldReady ? 'GOLD_READY' : 'NOT_GOLD_READY',
      readinessGaps: gaps,
      reviewPolicyVersion: reviewEvidence.policyVersion,
    };
  }
}

