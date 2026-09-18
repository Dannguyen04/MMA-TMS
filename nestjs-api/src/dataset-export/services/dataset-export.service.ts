import {
  Injectable,
  Inject,
  Logger,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { DRIZZLE } from '../../database/database.module.js';
import {
  datasetExportCandidates,
  datasetAttestations,
  datasetAttestationAudit,
  datasetIdempotencyKeys,
} from '../../database/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { PromotionRequestDto } from '../dto/promotion-request.dto.js';
import {
  AttestationSignerService,
  AttestationClaims,
} from './attestation-signer.service.js';
import { NonceStoreService } from './nonce-store.service.js';
import { AuthoritativeGovernanceService } from './authoritative-governance.service.js';

export interface PromotionResponse {
  attestationId: string;
  exportId: string;
  authoritativeStatus: 'GOLD_READY' | 'NOT_GOLD_READY';
  decision: 'GOLD_READY' | 'NOT_GOLD_READY';
  readinessGaps: string[];
  claims: AttestationClaims;
  signature: string;
  keyId: string;
  algorithm: string;
  issuedAt: string;
  expiresAt: string;
}

@Injectable()
export class DatasetExportService {
  private readonly logger = new Logger(DatasetExportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly configService: ConfigService,
    private readonly signerService: AttestationSignerService,
    private readonly nonceStore: NonceStoreService,
    private readonly governanceService: AuthoritativeGovernanceService,
  ) {}

  /**
   * Promotes a candidate export to authoritative GOLD_READY status inside a single DB transaction.
   */
  async promoteCandidate(
    dto: PromotionRequestDto,
    idempotencyKey: string,
    authenticatedActorId: string,
  ): Promise<PromotionResponse> {
    const isGoldExportEnabled =
      this.configService.get<string>('GOLD_EXPORT_ENABLED', 'false') === 'true';

    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Header \'Idempotency-Key\' is required for dataset promotion.');
    }

    const candidate = dto.candidate;

    // Fail closed if GOLD export feature flag is disabled
    if (!isGoldExportEnabled) {
      this.logger.warn(
        `Gold export disabled by production configuration (GOLD_EXPORT_ENABLED=false) for export ${candidate.exportId}`,
      );
      throw new ForbiddenException(
        'GOLD promotion is currently disabled by production configuration (GOLD_EXPORT_ENABLED=false).',
      );
    }

    // Compute canonical request digest for idempotency checking
    const canonicalRequestStr = this.governanceService.canonicalizeJson(dto);
    const requestDigest =
      'sha256:' +
      crypto.createHash('sha256').update(canonicalRequestStr, 'utf8').digest('hex');

    // Execute promotion inside a single PostgreSQL transaction
    return await this.db.transaction(async (tx: any) => {
      // 1. Check Idempotency Key persistence
      const existingIdempotency = await tx
        .select()
        .from(datasetIdempotencyKeys)
        .where(eq(datasetIdempotencyKeys.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingIdempotency.length > 0) {
        const stored = existingIdempotency[0];
        if (stored.requestDigest !== requestDigest) {
          throw new ConflictException(
            `Idempotency-Key '${idempotencyKey}' was already used with a different request payload digest.`,
          );
        }
        return stored.responsePayload as PromotionResponse;
      }

      // 2. Candidate conflict verification
      const existingCandidates = await tx
        .select()
        .from(datasetExportCandidates)
        .where(eq(datasetExportCandidates.exportId, candidate.exportId))
        .limit(1);

      if (existingCandidates.length > 0) {
        const existing = existingCandidates[0];
        const isIdentical =
          existing.datasetHash === candidate.datasetHash &&
          existing.manifestDigest === candidate.manifestDigest &&
          existing.reviewEvidenceDigest === candidate.reviewEvidenceDigest &&
          existing.qualityEvidenceDigest === candidate.qualityEvidenceDigest &&
          existing.policyVersion === candidate.policyVersion &&
          existing.coveredActionIdsHash === candidate.coveredActionIdsHash &&
          existing.sampleCount === candidate.sampleCount;

        if (!isIdentical) {
          throw new ConflictException(
            `Candidate exportId conflict: Export ID '${candidate.exportId}' already exists with different candidate metadata.`,
          );
        }
      } else {
        // Register candidate in DB
        await tx.insert(datasetExportCandidates).values({
          exportId: candidate.exportId,
          datasetHash: candidate.datasetHash,
          manifestDigest: candidate.manifestDigest,
          reviewEvidenceDigest: candidate.reviewEvidenceDigest,
          qualityEvidenceDigest: candidate.qualityEvidenceDigest,
          policyVersion: candidate.policyVersion,
          sourceSchemaVersion: candidate.sourceSchemaVersion,
          sampleCount: candidate.sampleCount,
          coveredActionIdsHash: candidate.coveredActionIdsHash,
          candidateStatus: candidate.candidateStatus,
          readinessGaps: candidate.readinessGaps || [],
          sourceJobId: candidate.sourceJobId || null,
          createdAt: new Date(candidate.createdAt),
        });
      }

      // 3. Evaluate Authoritative Governance & Consensus
      const governance = await this.governanceService.evaluateGovernance(
        candidate,
        dto.reviewEvidence,
        dto.qualityEvidence,
        tx,
      );

      // 4. Acquire Nonce atomically inside transaction
      const issuer = this.signerService.getIssuer();
      const attestationId = `att_${crypto.randomUUID()}`;

      await this.nonceStore.acquireNonce(issuer, dto.nonce, 600, attestationId, tx);

      // 5. Supersede previous ACTIVE attestations for this exportId
      await tx
        .update(datasetAttestations)
        .set({ status: 'SUPERSEDED' })
        .where(
          and(
            eq(datasetAttestations.exportId, candidate.exportId),
            eq(datasetAttestations.status, 'ACTIVE'),
          ),
        );

      // 6. Build & Sign Attestation Claims
      const now = new Date();
      const expires = new Date(now.getTime() + 10 * 60 * 1000); // 10 min TTL

      const claims: AttestationClaims = {
        attestationVersion: '1.0.0',
        attestationId,
        issuer,
        audience: this.signerService.getAudience(),
        purpose: 'gold-dataset-promotion',
        keyId: this.signerService.getKeyId(),
        algorithm: this.signerService.getAlgorithm(),
        issuedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        nonce: dto.nonce,
        exportId: candidate.exportId,
        datasetHash: candidate.datasetHash,
        manifestDigest: governance.recomputedManifestDigest,
        reviewEvidenceDigest: governance.recomputedReviewEvidenceDigest,
        qualityEvidenceDigest: governance.recomputedQualityEvidenceDigest,
        policyVersion: candidate.policyVersion,
        reviewPolicyVersion: governance.reviewPolicyVersion,
        coveredActionIdsHash: candidate.coveredActionIdsHash,
        decision: governance.decision,
      };

      const signatureResult = this.signerService.signAttestation(claims);

      // 7. Persist Attestation record
      await tx.insert(datasetAttestations).values({
        attestationId,
        exportId: candidate.exportId,
        issuer,
        audience: claims.audience,
        purpose: claims.purpose,
        keyId: signatureResult.keyId,
        algorithm: signatureResult.algorithm,
        decision: governance.decision,
        claims,
        signature: signatureResult.signature,
        status: 'ACTIVE',
        issuedAt: now,
        expiresAt: expires,
        actorId: authenticatedActorId,
        auditCorrelationId: `audit_${crypto.randomUUID()}`,
        createdAt: now,
      });

      // 8. Log Audit Event
      await tx.insert(datasetAttestationAudit).values({
        eventType: governance.passed ? 'issued' : 'rejected',
        exportId: candidate.exportId,
        attestationId,
        actorId: authenticatedActorId,
        reasonCode: `idempotency:${idempotencyKey}`,
        requestDigest,
        details: {
          readinessGaps: governance.readinessGaps,
          decision: governance.decision,
          keyId: signatureResult.keyId,
          algorithm: signatureResult.algorithm,
        },
        createdAt: now,
      });

      const response: PromotionResponse = {
        attestationId,
        exportId: candidate.exportId,
        authoritativeStatus: governance.decision,
        decision: governance.decision,
        readinessGaps: governance.readinessGaps,
        claims,
        signature: signatureResult.signature,
        keyId: signatureResult.keyId,
        algorithm: signatureResult.algorithm,
        issuedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
      };

      // 9. Persist Idempotency Record
      await tx.insert(datasetIdempotencyKeys).values({
        idempotencyKey,
        operation: 'promoteCandidate',
        actorId: authenticatedActorId,
        requestDigest,
        responsePayload: response,
        createdAt: now,
      });

      this.logger.log(
        `Dataset export ${candidate.exportId} promoted with attestation ${attestationId}. Decision: ${governance.decision}`,
      );

      return response;
    });
  }

  /**
   * Retrieves authoritative promotion status for an exportId.
   */
  async getPromotionStatus(exportId: string): Promise<{
    exportId: string;
    authoritativeStatus: 'GOLD_READY' | 'NOT_GOLD_READY';
    attestation?: any;
  }> {
    const attestations = await this.db
      .select()
      .from(datasetAttestations)
      .where(
        and(
          eq(datasetAttestations.exportId, exportId),
          eq(datasetAttestations.status, 'ACTIVE'),
        ),
      )
      .orderBy(desc(datasetAttestations.createdAt))
      .limit(1);

    if (attestations.length === 0) {
      return {
        exportId,
        authoritativeStatus: 'NOT_GOLD_READY',
      };
    }

    const latest = attestations[0];
    const isExpired = new Date() > new Date(latest.expiresAt);

    if (isExpired || latest.decision !== 'GOLD_READY') {
      return {
        exportId,
        authoritativeStatus: 'NOT_GOLD_READY',
        attestation: latest,
      };
    }

    return {
      exportId,
      authoritativeStatus: 'GOLD_READY',
      attestation: latest,
    };
  }

  /**
   * Revokes an active attestation inside a DB transaction.
   */
  async revokeAttestation(
    attestationId: string,
    reason: string,
    idempotencyKey: string,
    actorId: string,
  ): Promise<{ attestationId: string; status: string; revokedAt: string }> {
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException('Header \'Idempotency-Key\' is required for attestation revocation.');
    }

    const canonicalRequestStr = this.governanceService.canonicalizeJson({ attestationId, reason });
    const requestDigest =
      'sha256:' +
      crypto.createHash('sha256').update(canonicalRequestStr, 'utf8').digest('hex');

    return await this.db.transaction(async (tx: any) => {
      // 1. Check Idempotency Key
      const existingIdempotency = await tx
        .select()
        .from(datasetIdempotencyKeys)
        .where(eq(datasetIdempotencyKeys.idempotencyKey, idempotencyKey))
        .limit(1);

      if (existingIdempotency.length > 0) {
        const stored = existingIdempotency[0];
        if (stored.requestDigest !== requestDigest) {
          throw new ConflictException(
            `Idempotency-Key '${idempotencyKey}' was already used with a different request payload digest.`,
          );
        }
        return stored.responsePayload;
      }

      // 2. Fetch attestation
      const existing = await tx
        .select()
        .from(datasetAttestations)
        .where(eq(datasetAttestations.attestationId, attestationId))
        .limit(1);

      if (existing.length === 0) {
        throw new NotFoundException(`Attestation '${attestationId}' not found.`);
      }

      const now = new Date();

      // 3. Mark as REVOKED
      await tx
        .update(datasetAttestations)
        .set({
          status: 'REVOKED',
          revokedAt: now,
          revokedReason: reason,
        })
        .where(eq(datasetAttestations.attestationId, attestationId));

      // 4. Audit event
      await tx.insert(datasetAttestationAudit).values({
        eventType: 'revoked',
        exportId: existing[0].exportId,
        attestationId,
        actorId,
        reasonCode: 'attestation_revocation',
        details: { reason },
        createdAt: now,
      });

      const response = {
        attestationId,
        status: 'REVOKED',
        revokedAt: now.toISOString(),
      };

      // 5. Store Idempotency Key
      await tx.insert(datasetIdempotencyKeys).values({
        idempotencyKey,
        operation: 'revokeAttestation',
        actorId,
        requestDigest,
        responsePayload: response,
        createdAt: now,
      });

      this.logger.warn(`Attestation ${attestationId} revoked by ${actorId}. Reason: ${reason}`);

      return response;
    });
  }
}
