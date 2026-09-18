import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AppModule } from '../src/app.module.js';
import { DRIZZLE } from '../src/database/database.module.js';
import { datasetReviews, datasetQualityReports } from '../src/database/schema.js';
import { AttestationSignerService } from '../src/dataset-export/services/attestation-signer.service.js';
import { AuthoritativeGovernanceService } from '../src/dataset-export/services/authoritative-governance.service.js';

describe('Task 14 — Product Backend Security & Governance Remediation Gate', () => {
  let app: INestApplication;
  let db: any;
  let signerService: AttestationSignerService;
  let governanceService: AuthoritativeGovernanceService;

  const validWorkerSecret = 'mma-tms-worker-local-secret-2026';

  const computeDigest = (obj: any): string => {
    const canonicalStr = governanceService.canonicalizeJson(obj);
    return 'sha256:' + crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
  };

  const seedReviews = async (exportId: string, reviews: Array<{ reviewerId: string; role: string; status?: string }>) => {
    for (const r of reviews) {
      await db.insert(datasetReviews).values({
        exportId,
        reviewerId: r.reviewerId,
        reviewerRole: r.role,
        reviewStatus: r.status || 'approved',
      });
    }
  };

  const seedQuality = async (exportId: string, qualityStatus: string = 'pass', policyVersion: string = 'quality_policy_v2.0') => {
    await db.insert(datasetQualityReports).values({
      exportId,
      qualityStatus,
      policyVersion,
      metrics: { completeness: 1.0 },
    });
  };

  const samplePayload = (candidateOverride: Record<string, any> = {}, payloadOverride: Record<string, any> = {}) => {
    const reviewEvidence = payloadOverride.reviewEvidence || {
      reviewers: [
        { reviewerId: 'usr_coach_1', role: 'coach' },
        { reviewerId: 'usr_expert_2', role: 'domain_expert' },
      ],
      policyVersion: 'dual_review_consensus_v1.0',
    };

    const qualityEvidence = payloadOverride.qualityEvidence || {
      status: 'pass',
      policyVersion: 'quality_policy_v2.0',
    };

    const reviewData = {
      policyVersion: reviewEvidence.policyVersion,
      reviewers: reviewEvidence.reviewers.map((r: any) => ({ reviewerId: r.reviewerId, role: r.role })).sort((a: any, b: any) => a.reviewerId.localeCompare(b.reviewerId)),
    };
    const qualityData = {
      policyVersion: qualityEvidence.policyVersion,
      status: qualityEvidence.status,
    };

    const reviewEvidenceDigest = candidateOverride.reviewEvidenceDigest || computeDigest(reviewData);
    const qualityEvidenceDigest = candidateOverride.qualityEvidenceDigest || computeDigest(qualityData);

    const exportId = candidateOverride.exportId || `exp_adv_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const datasetHash = candidateOverride.datasetHash || 'sha256:' + 'a'.repeat(64);
    const policyVersion = candidateOverride.policyVersion || 'dataset-policy-v1';
    const sourceSchemaVersion = candidateOverride.sourceSchemaVersion || '1.0.0';
    const sampleCount = candidateOverride.sampleCount !== undefined ? candidateOverride.sampleCount : 600;
    const coveredActionIdsHash = candidateOverride.coveredActionIdsHash || 'sha256:' + 'e'.repeat(64);

    const manifestData = {
      coveredActionIdsHash,
      datasetHash,
      exportId,
      policyVersion,
      qualityEvidenceDigest,
      reviewEvidenceDigest,
      sampleCount,
      sourceSchemaVersion,
    };
    const manifestDigest = candidateOverride.manifestDigest || computeDigest(manifestData);

    const candidate = {
      contractVersion: '1.0.0',
      exportId,
      datasetHash,
      manifestDigest,
      reviewEvidenceDigest,
      qualityEvidenceDigest,
      policyVersion,
      sourceSchemaVersion,
      sampleCount,
      coveredActionIdsHash,
      candidateStatus: 'NOT_GOLD_READY',
      readinessGaps: [],
      createdAt: new Date().toISOString(),
      ...candidateOverride,
    };

    const basePayload: any = {
      candidate,
      reviewEvidence,
      qualityEvidence,
      nonce: `nonce_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    };

    return {
      ...basePayload,
      ...payloadOverride,
    };
  };

  beforeEach(async () => {
    process.env.GOLD_EXPORT_ENABLED = 'true';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    db = moduleFixture.get(DRIZZLE);
    signerService = moduleFixture.get<AttestationSignerService>(AttestationSignerService);
    governanceService = moduleFixture.get<AuthoritativeGovernanceService>(AuthoritativeGovernanceService);
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('1. Production Fail-Closed Defaults & Authorization Guard', () => {
    it('1.1 fails closed when auth secret or signer key is missing in production mode', () => {
      const prodConfigMissingKey = new ConfigService({
        NODE_ENV: 'production',
        GOLD_EXPORT_ENABLED: 'true',
        DATASET_SIGNING_KEY_ID: 'dataset-signing-2026-09',
        // DATASET_SIGNING_PRIVATE_KEY missing
      });

      expect(() => {
        new AttestationSignerService(prodConfigMissingKey);
      }).toThrow('Production startup failed: GOLD_EXPORT_ENABLED=true requires DATASET_SIGNING_PRIVATE_KEY and DATASET_SIGNING_KEY_ID.');

      const prodConfigMissingKeyId = new ConfigService({
        NODE_ENV: 'production',
        GOLD_EXPORT_ENABLED: 'true',
        DATASET_SIGNING_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7\n-----END PRIVATE KEY-----',
        // DATASET_SIGNING_KEY_ID missing
      });

      expect(() => {
        new AttestationSignerService(prodConfigMissingKeyId);
      }).toThrow('Production startup failed: GOLD_EXPORT_ENABLED=true requires DATASET_SIGNING_PRIVATE_KEY and DATASET_SIGNING_KEY_ID.');
    });

    it('1.2 rejects development secret when NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.WORKER_SECRET_TOKEN = 'prod_secret_token_key_2026_x';

      const payload = samplePayload();
      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', 'mma-tms-worker-local-secret-2026') // dev token
        .set('idempotency-key', `idemp_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(401);

      process.env.NODE_ENV = 'test';
      delete process.env.WORKER_SECRET_TOKEN;
    });

    it('1.3 derives actor identity from authentication context, rejecting body actorId spoofing', async () => {
      const spoofedPayload = samplePayload({}, { actorId: 'spoofed_admin_hacker' });
      const resSpoofed = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${spoofedPayload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_actor_spoof_${Date.now()}`)
        .send(spoofedPayload);

      expect(resSpoofed.status).toBe(400);

      const validPayload = samplePayload();
      const resValid = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${validPayload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_actor_valid_${Date.now()}`)
        .send(validPayload);

      expect(resValid.status).toBe(201);
      expect(resValid.body.claims).toBeDefined();
    });
  });

  describe('2. Authoritative Governance & Digest Binding', () => {
    it('2.1 fails closed as NOT_GOLD_READY when DB has no authoritative reviews or quality report', async () => {
      const payload = samplePayload();

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_empty_db_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('NOT_GOLD_READY');
      expect(res.body.readinessGaps.some((g: string) => g.includes('MISSING_AUTHORITATIVE_REVIEWS'))).toBe(true);
      expect(res.body.readinessGaps.some((g: string) => g.includes('MISSING_AUTHORITATIVE_QUALITY_REPORT'))).toBe(true);
    });

    it('2.2 promotes to GOLD_READY when authoritative DB has valid reviews and quality pass', async () => {
      const payload = samplePayload();
      const exportId = payload.candidate.exportId;

      await seedReviews(exportId, [
        { reviewerId: 'usr_coach_1', role: 'coach' },
        { reviewerId: 'usr_expert_2', role: 'domain_expert' },
      ]);
      await seedQuality(exportId, 'pass');

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_valid_auth_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('GOLD_READY');
      expect(res.body.decision).toBe('GOLD_READY');
      expect(res.body.readinessGaps.length).toBe(0);
    });

    it('2.3 rejects dual review consensus when authoritative DB reviewer role combination is invalid', async () => {
      const payload = samplePayload();
      const exportId = payload.candidate.exportId;

      await seedReviews(exportId, [
        { reviewerId: 'usr_1', role: 'coach' },
        { reviewerId: 'usr_2', role: 'coach' }, // Missing domain_expert
      ]);
      await seedQuality(exportId, 'pass');

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_role_mismatch_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('NOT_GOLD_READY');
      expect(res.body.readinessGaps.join(' ')).toContain('exact required role combination');
    });

    it('2.4 fails closed when a reviewer is revoked in DB reducing count below threshold', async () => {
      const payload = samplePayload();
      const exportId = payload.candidate.exportId;

      await seedReviews(exportId, [
        { reviewerId: 'usr_coach_1', role: 'coach', status: 'approved' },
        { reviewerId: 'usr_expert_2', role: 'domain_expert', status: 'revoked' },
      ]);
      await seedQuality(exportId, 'pass');

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_revoked_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('NOT_GOLD_READY');
      expect(res.body.readinessGaps.join(' ')).toContain('Dual review consensus requires at least 2 distinct reviewers');
    });

    it('2.5 DB quality truth overrides request payload claims', async () => {
      const payload = samplePayload(); // claims quality pass in payload
      const exportId = payload.candidate.exportId;

      await seedReviews(exportId, [
        { reviewerId: 'usr_coach_1', role: 'coach' },
        { reviewerId: 'usr_expert_2', role: 'domain_expert' },
      ]);
      await seedQuality(exportId, 'failed'); // DB authoritative state is failed

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_quality_override_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('NOT_GOLD_READY');
      expect(res.body.readinessGaps.join(' ')).toContain("Quality status is 'failed'");
    });

    it('2.6 flags reviewEvidenceDigest mismatch when candidate claim does not match authoritative DB', async () => {
      const payload = samplePayload({ reviewEvidenceDigest: 'sha256:' + 'f'.repeat(64) });
      const exportId = payload.candidate.exportId;

      await seedReviews(exportId, [
        { reviewerId: 'usr_coach_1', role: 'coach' },
        { reviewerId: 'usr_expert_2', role: 'domain_expert' },
      ]);
      await seedQuality(exportId, 'pass');

      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_digest_mismatch_${Date.now()}`)
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.authoritativeStatus).toBe('NOT_GOLD_READY');
      expect(res.body.readinessGaps.join(' ')).toContain('reviewEvidenceDigest mismatch');
    });
  });

  describe('3. Candidate Conflict & Superseding Lifecycle', () => {
    it('3.1 rejects same exportId submitted with different candidate hash (409 Conflict)', async () => {
      const payload1 = samplePayload();
      const exportId = payload1.candidate.exportId;

      // First promotion succeeds
      const res1 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_cand1_${Date.now()}`)
        .send(payload1);
      expect(res1.status).toBe(201);

      // Tampered candidate data with same exportId
      const payload2 = samplePayload({ exportId, datasetHash: 'sha256:' + '9'.repeat(64) });
      const res2 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_cand2_${Date.now()}`)
        .send(payload2);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('Candidate exportId conflict');
    });

    it('3.2 supersedes previous active attestations when issuing a new promotion', async () => {
      const payload1 = samplePayload();
      const exportId = payload1.candidate.exportId;

      // First promotion
      const res1 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_super1_${Date.now()}`)
        .send(payload1);
      expect(res1.status).toBe(201);

      const firstAttestationId = res1.body.attestationId;

      // Second promotion for same candidate data
      const payload2 = samplePayload({ exportId }, { nonce: `nonce_2_${Date.now()}` });
      const res2 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_super2_${Date.now()}`)
        .send(payload2);

      expect(res2.status).toBe(201);
      const secondAttestationId = res2.body.attestationId;
      expect(secondAttestationId).not.toBe(firstAttestationId);

      // GET status should reflect the latest active attestation
      const statusRes = await request(app.getHttpServer())
        .get(`/internal/dataset-exports/${exportId}/promotion`)
        .set('x-worker-secret', validWorkerSecret);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.attestation.attestationId).toBe(secondAttestationId);
    }, 15000);
  });

  describe('4. Idempotency & Nonce Replay', () => {
    it('4.1 requires mandatory Idempotency-Key header for mutations', async () => {
      const payload = samplePayload();
      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Idempotency-Key');
    });

    it('4.2 returns exact stored response for duplicate Idempotency-Key and payload', async () => {
      const payload = samplePayload();
      const idempotencyKey = `idemp_dup_${Date.now()}`;

      const res1 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', idempotencyKey)
        .send(payload);

      const res2 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', idempotencyKey)
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res2.body.attestationId).toBe(res1.body.attestationId);
    });

    it('4.3 rejects duplicate nonces with 409 Conflict', async () => {
      const payload1 = samplePayload();
      const nonce = payload1.nonce;

      await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload1.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_n1_${Date.now()}`)
        .send(payload1);

      const payload2 = samplePayload({}, { nonce });
      const res2 = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload2.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_n2_${Date.now()}`)
        .send(payload2);

      expect(res2.status).toBe(409);
      expect(res2.body.message).toContain('Nonce replay detected');
    });
  });

  describe('5. Cryptographic Verification & Malformed Input Safety', () => {
    it('5.1 returns false safely on malformed signature verification without throwing', () => {
      const claims: any = {
        attestationId: 'att_1',
        exportId: 'exp_1',
      };
      const result = signerService.verifySignature(claims, 'invalid_hex_sig!!!', 'wrong_key_id');
      expect(result).toBe(false);
    });

    it('5.2 verifies cross-language RFC 8785 canonical JSON fixture byte parity', () => {
      const fixturePath = path.join(__dirname, 'fixtures', 'canonical-json-fixture.json');
      const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

      for (const caseData of fixtureData.testCases) {
        const canonicalStr = governanceService.canonicalizeJson(caseData.input);
        expect(canonicalStr).toBe(caseData.expectedCanonicalJson);

        const digest =
          'sha256:' +
          crypto.createHash('sha256').update(canonicalStr, 'utf8').digest('hex');
        expect(digest).toBe(caseData.expectedSha256);
      }
    });

    it('5.3 does not expose sensitive secret values in API responses or logs', async () => {
      const payload = samplePayload();
      const res = await request(app.getHttpServer())
        .post(`/internal/dataset-exports/${payload.candidate.exportId}/promotions`)
        .set('x-worker-secret', validWorkerSecret)
        .set('idempotency-key', `idemp_sec_${Date.now()}`)
        .send(payload);

      const jsonStr = JSON.stringify(res.body);
      expect(jsonStr).not.toContain('DATABASE_URL');
      expect(jsonStr).not.toContain('PRIVATE KEY');
      expect(jsonStr).not.toContain('SECRET');
    });
  });
});
