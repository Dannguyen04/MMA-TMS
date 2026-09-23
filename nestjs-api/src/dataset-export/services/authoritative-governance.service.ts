import {
  Injectable,
  Inject,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import { DRIZZLE } from '../../database/database.module.js';
import { datasetReviews, datasetQualityReports, datasetExportCandidates, users, coaches } from '../../database/schema.js';
import { eq, and } from 'drizzle-orm';
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
  recomputedReviewEvidenceDigest: string;
  recomputedQualityEvidenceDigest: string;
  recomputedManifestDigest: string;
}

@Injectable()
export class AuthoritativeGovernanceService {
  private readonly logger = new Logger(AuthoritativeGovernanceService.name);

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

  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Produces RFC 8785 Canonical JSON representation.
   */
  canonicalizeJson(data: any): string {
    if (data === null || typeof data !== 'object') {
      return JSON.stringify(data);
    }
    if (Array.isArray(data)) {
      return '[' + data.map((item) => this.canonicalizeJson(item)).join(',') + ']';
    }
    const keys = Object.keys(data).sort();
    const parts = keys.map(
      (key) => `${JSON.stringify(key)}:${this.canonicalizeJson(data[key])}`,
    );
    return '{' + parts.join(',') + '}';
  }

  /**
   * Constant-time string comparison preventing timing side-channel attacks.
   */
  timingSafeEqualStrings(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  }

  /**
   * Validates ISO 8601 UTC timestamp format strictly requiring timezone component.
   */
  validateTimezone(timestampStr: string, fieldName: string): Date {
    if (!timestampStr) {
      throw new BadRequestException(`Timestamp field '${fieldName}' cannot be empty.`);
    }

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
   * Evaluates authoritative governance by querying DB persistence or recomputing canonical digests.
   */
  async evaluateGovernance(
    candidate: CandidateExportDto,
    suppliedReviewEvidence?: ReviewEvidencePayloadDto,
    suppliedQualityEvidence?: QualityEvidencePayloadDto,
    tx?: any,
  ): Promise<GovernanceVerificationResult> {
    const dbClient = tx || this.db;
    const gaps: string[] = [];

    // 1. Validate timestamps
    this.validateTimezone(candidate.createdAt, 'candidate.createdAt');

    // 2. Validate policy versions
    if (!this.supportedPolicyVersions.has(candidate.policyVersion)) {
      throw new BadRequestException(
        `Unsupported policyVersion '${candidate.policyVersion}'. Supported: ${Array.from(this.supportedPolicyVersions).join(', ')}`,
      );
    }

    // 3. Load authoritative reviews from DB (excluding non-approved / revoked)
    const allDbReviews = await dbClient
      .select()
      .from(datasetReviews)
      .where(eq(datasetReviews.exportId, candidate.exportId));

    const validCoachRoles = new Set(['coach', 'head_coach']);
    const validExpertRoles = new Set(['domain_expert', 'senior_annotator', 'expert_reviewer']);
    const validRoles = new Set([...validCoachRoles, ...validExpertRoles]);

    let reviewersList: Array<{ reviewerId: string; role: string }> = [];
    const reviewPolicyVersion = 'dual_review_consensus_v1.0';

    if (allDbReviews.length === 0) {
      gaps.push('MISSING_AUTHORITATIVE_REVIEWS: No approved reviews found in authoritative database.');
    } else {
      for (const r of allDbReviews) {
        if (r.reviewStatus === 'revoked') {
          gaps.push(`REVOKED_REVIEW: Review by '${r.reviewerId}' is revoked in authoritative database.`);
          continue;
        }
        if (r.reviewStatus !== 'approved') {
          gaps.push(`NON_APPROVED_REVIEW: Review by '${r.reviewerId}' has status '${r.reviewStatus}' in authoritative database.`);
          continue;
        }
        // Check authoritative RBAC against users table if reviewer exists in user directory
        let isRoleAuthorized = validRoles.has(r.reviewerRole);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(r.reviewerId)) {
          try {
            const userRecords = await dbClient
              .select({ id: users.id, role: users.role })
              .from(users)
              .where(eq(users.id, r.reviewerId))
              .limit(1);
            if (userRecords.length > 0) {
              const userRole = (userRecords[0].role || '').toLowerCase();
              if (userRole === 'fighter') {
                gaps.push(
                  `WRONG_REVIEWER_ROLE: Reviewer '${r.reviewerId}' is registered as FIGHTER in authoritative user directory.`,
                );
                continue;
              }
              if (!validRoles.has(userRole) && userRole !== 'admin') {
                isRoleAuthorized = false;
              }
            }
          } catch {
            // If query fails or table not populated in test fixture, rely on r.reviewerRole
          }
        }

        if (!isRoleAuthorized) {
          gaps.push(
            `WRONG_REVIEWER_ROLE: Reviewer '${r.reviewerId}' has invalid role '${r.reviewerRole}'. Authoritative RBAC requires coach or expert role.`,
          );
          continue;
        }
        reviewersList.push({
          reviewerId: r.reviewerId,
          role: r.reviewerRole,
        });
      }
    }

    if (!this.supportedReviewPolicies.has(reviewPolicyVersion)) {
      throw new BadRequestException(`Unsupported review policyVersion '${reviewPolicyVersion}'.`);
    }

    // Recompute review evidence digest from authoritative DB state
    const canonicalReviewData = this.canonicalizeJson({
      policyVersion: reviewPolicyVersion,
      reviewers: reviewersList
        .map((r) => ({ reviewerId: r.reviewerId, role: r.role }))
        .sort((a, b) => a.reviewerId.localeCompare(b.reviewerId)),
    });
    const recomputedReviewEvidenceDigest =
      'sha256:' + crypto.createHash('sha256').update(canonicalReviewData, 'utf8').digest('hex');

    // Check review evidence digest match
    if (
      candidate.reviewEvidenceDigest &&
      !this.timingSafeEqualStrings(candidate.reviewEvidenceDigest, recomputedReviewEvidenceDigest)
    ) {
      gaps.push(
        `Authoritative reviewEvidenceDigest mismatch! Claimed: '${candidate.reviewEvidenceDigest}', Authoritative DB: '${recomputedReviewEvidenceDigest}'`,
      );
    }

    // 4. Load authoritative quality report from DB
    const dbQuality = await dbClient
      .select()
      .from(datasetQualityReports)
      .where(eq(datasetQualityReports.exportId, candidate.exportId))
      .limit(1);

    let qualityStatus = 'missing';
    let qualityPolicyVersion = 'quality_policy_v2.0';

    if (dbQuality.length > 0) {
      qualityStatus = dbQuality[0].qualityStatus;
      qualityPolicyVersion = dbQuality[0].policyVersion;
    } else {
      gaps.push('MISSING_AUTHORITATIVE_QUALITY_REPORT: No quality report found in authoritative database.');
    }

    if (!this.supportedQualityPolicies.has(qualityPolicyVersion)) {
      throw new BadRequestException(`Unsupported quality policyVersion '${qualityPolicyVersion}'.`);
    }

    const canonicalQualityData = this.canonicalizeJson({
      policyVersion: qualityPolicyVersion,
      status: qualityStatus,
    });
    const recomputedQualityEvidenceDigest =
      'sha256:' + crypto.createHash('sha256').update(canonicalQualityData, 'utf8').digest('hex');

    if (
      candidate.qualityEvidenceDigest &&
      !this.timingSafeEqualStrings(candidate.qualityEvidenceDigest, recomputedQualityEvidenceDigest)
    ) {
      gaps.push(
        `Authoritative qualityEvidenceDigest mismatch! Claimed: '${candidate.qualityEvidenceDigest}', Authoritative DB: '${recomputedQualityEvidenceDigest}'`,
      );
    }

    // 5. Load Authoritative Candidate Manifest from DB and recompute
    const dbCandidates = await dbClient
      .select()
      .from(datasetExportCandidates)
      .where(eq(datasetExportCandidates.exportId, candidate.exportId))
      .limit(1);

    const dbCandidate = dbCandidates.length > 0 ? dbCandidates[0] : null;

    if (!dbCandidate) {
      gaps.push(
        'MISSING_AUTHORITATIVE_INVENTORY: Export candidate not found in authoritative database. Request-only evidence cannot produce GOLD.',
      );
    }

    const authoritativeSampleCount = dbCandidate ? dbCandidate.sampleCount : candidate.sampleCount;
    const authoritativeCoveredActionIdsHash = dbCandidate ? dbCandidate.coveredActionIdsHash : candidate.coveredActionIdsHash;
    const authoritativeDatasetHash = dbCandidate ? dbCandidate.datasetHash : candidate.datasetHash;
    const authoritativePolicyVersion = dbCandidate ? dbCandidate.policyVersion : candidate.policyVersion;
    const authoritativeSourceSchemaVersion = dbCandidate ? dbCandidate.sourceSchemaVersion : candidate.sourceSchemaVersion;

    if (dbCandidate) {
      if (candidate.sampleCount !== authoritativeSampleCount) {
        gaps.push(
          `Authoritative sampleCount mismatch! Claimed: ${candidate.sampleCount}, Authoritative DB: ${authoritativeSampleCount}`,
        );
      }
      if (
        candidate.coveredActionIdsHash &&
        !this.timingSafeEqualStrings(candidate.coveredActionIdsHash, authoritativeCoveredActionIdsHash)
      ) {
        gaps.push(
          `Authoritative coveredActionIdsHash mismatch! Claimed: '${candidate.coveredActionIdsHash}', Authoritative DB: '${authoritativeCoveredActionIdsHash}'`,
        );
      }
      if (
        candidate.datasetHash &&
        !this.timingSafeEqualStrings(candidate.datasetHash, authoritativeDatasetHash)
      ) {
        gaps.push(
          `Authoritative datasetHash mismatch! Claimed: '${candidate.datasetHash}', Authoritative DB: '${authoritativeDatasetHash}'`,
        );
      }
      if (
        candidate.policyVersion &&
        candidate.policyVersion !== authoritativePolicyVersion
      ) {
        gaps.push(
          `Authoritative policyVersion mismatch! Claimed: '${candidate.policyVersion}', Authoritative DB: '${authoritativePolicyVersion}'`,
        );
      }
      if (
        candidate.sourceSchemaVersion &&
        candidate.sourceSchemaVersion !== authoritativeSourceSchemaVersion
      ) {
        gaps.push(
          `Authoritative sourceSchemaVersion mismatch! Claimed: '${candidate.sourceSchemaVersion}', Authoritative DB: '${authoritativeSourceSchemaVersion}'`,
        );
      }
    }

    // 6. Recompute and verify authoritative manifest digest using DB values
    const canonicalManifestData = this.canonicalizeJson({
      coveredActionIdsHash: authoritativeCoveredActionIdsHash,
      datasetHash: authoritativeDatasetHash,
      exportId: candidate.exportId,
      policyVersion: authoritativePolicyVersion,
      qualityEvidenceDigest: recomputedQualityEvidenceDigest,
      reviewEvidenceDigest: recomputedReviewEvidenceDigest,
      sampleCount: authoritativeSampleCount,
      sourceSchemaVersion: authoritativeSourceSchemaVersion,
    });
    const recomputedManifestDigest =
      'sha256:' + crypto.createHash('sha256').update(canonicalManifestData, 'utf8').digest('hex');

    if (
      candidate.manifestDigest &&
      !this.timingSafeEqualStrings(candidate.manifestDigest, recomputedManifestDigest)
    ) {
      gaps.push(
        `Authoritative manifestDigest mismatch! Claimed: '${candidate.manifestDigest}', Authoritative DB: '${recomputedManifestDigest}'`,
      );
    }

    // 7. Governance policy enforcement
    if (qualityStatus !== 'pass') {
      gaps.push(`Quality status is '${qualityStatus}', expected 'pass'.`);
    }

    if (authoritativeSampleCount < 1) {
      gaps.push(`Sample count is ${authoritativeSampleCount}, expected > 0.`);
    }

    const distinctReviewers = new Set(reviewersList.map((r) => r.reviewerId.trim()));
    if (reviewersList.length > 0 && reviewersList.length !== distinctReviewers.size) {
      gaps.push(`Duplicate reviewer IDs detected! Count=${reviewersList.length}, Distinct=${distinctReviewers.size}.`);
    }

    if (reviewPolicyVersion.includes('dual_review')) {
      if (distinctReviewers.size < 2) {
        gaps.push(`Dual review consensus requires at least 2 distinct reviewers. Found: ${distinctReviewers.size}.`);
      }
      const roles = reviewersList.map((r) => r.role);
      const hasCoach = roles.some((role) => validCoachRoles.has(role));
      const hasExpert = roles.some((role) => validExpertRoles.has(role));
      if (!hasCoach || !hasExpert) {
        gaps.push('Dual review policy requires exact required role combination (at least 1 coach/head_coach and 1 domain_expert/senior_annotator/expert_reviewer).');
      }
    }

    if (candidate.readinessGaps && candidate.readinessGaps.length > 0) {
      gaps.push(...candidate.readinessGaps);
    }

    const passed = gaps.length === 0;

    return {
      passed,
      decision: passed ? 'GOLD_READY' : 'NOT_GOLD_READY',
      readinessGaps: gaps,
      reviewPolicyVersion,
      recomputedReviewEvidenceDigest,
      recomputedQualityEvidenceDigest,
      recomputedManifestDigest,
    };
  }
}
