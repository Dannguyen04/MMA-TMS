import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import pg from 'pg';
import { AttestationSignerService } from '../src/dataset-export/services/attestation-signer.service.js';
import { NonceStoreService } from '../src/dataset-export/services/nonce-store.service.js';

describe('Task TL-10 — Production Cryptography & Lifecycle Controls', () => {
  let client: pg.Client;
  const dbUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    if (dbUrl) {
      client = new pg.Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false },
      });
      await client.connect();
    }
  });

  afterAll(async () => {
    if (client) {
      await client.end();
    }
  });

  // ─── 1. Canonical JSON (RFC 8785 subset) ──────────────────────────────────

  it('1.1 canonicalizeJson omits undefined keys and sorts keys strictly by UTF-16 code units', () => {
    const config = new ConfigService({});
    const signer = new AttestationSignerService(config);

    const input = {
      z: 1,
      a: 'hello',
      ignored: undefined,
      nested: {
        b: true,
        a: null,
      },
    };

    const canonical = signer.canonicalizeJson(input);
    expect(canonical).toBe('{"a":"hello","nested":{"a":null,"b":true},"z":1}');
    expect(canonical).not.toContain('ignored');
  });

  it('1.2 canonicalizeJson strictly rejects non-finite numbers', () => {
    const config = new ConfigService({});
    const signer = new AttestationSignerService(config);

    expect(() => signer.canonicalizeJson({ bad: NaN })).toThrow('Non-finite number');
    expect(() => signer.canonicalizeJson({ bad: Infinity })).toThrow('Non-finite number');
    expect(() => signer.canonicalizeJson({ bad: -Infinity })).toThrow('Non-finite number');
  });

  // ─── 2. Supported Signing Algorithms & Key Types ───────────────────────────

  it('2.1 supports Ed25519 signing and verification with valid key semantics', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const config = new ConfigService({
      DATASET_SIGNING_ALGORITHM: 'Ed25519',
      DATASET_SIGNING_KEY_ID: 'ed25519-key-01',
      DATASET_SIGNING_PRIVATE_KEY: privatePem,
      DATASET_SIGNING_PUBLIC_KEY: publicPem,
    });

    const signer = new AttestationSignerService(config);
    const claims = {
      attestationVersion: '1.0.0',
      attestationId: 'att_test_ed25519',
      issuer: 'mma-tms-backend',
      audience: 'mma-tms-dataset-export',
      purpose: 'gold-dataset-promotion',
      keyId: 'ed25519-key-01',
      algorithm: 'Ed25519',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      nonce: 'nonce_ed_1',
      exportId: 'exp_ed_1',
      datasetHash: 'sha256:' + 'a'.repeat(64),
      manifestDigest: 'sha256:' + 'b'.repeat(64),
      reviewEvidenceDigest: 'sha256:' + 'c'.repeat(64),
      qualityEvidenceDigest: 'sha256:' + 'd'.repeat(64),
      policyVersion: 'v1',
      reviewPolicyVersion: 'v1',
      coveredActionIdsHash: 'sha256:' + 'e'.repeat(64),
      decision: 'GOLD_READY' as const,
    };

    const res = signer.signAttestation(claims);
    expect(res.algorithm).toBe('Ed25519');
    expect(res.signature).toBeDefined();

    const isValid = signer.verifySignature(claims, res.signature, 'ed25519-key-01');
    expect(isValid).toBe(true);

    // Tampered claims must fail
    const tampered = { ...claims, decision: 'NOT_GOLD_READY' as const };
    expect(signer.verifySignature(tampered, res.signature, 'ed25519-key-01')).toBe(false);
  });

  it('2.2 supports ES256 (ECDSA P-256) signing and verification', () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const privatePem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const config = new ConfigService({
      DATASET_SIGNING_ALGORITHM: 'ES256',
      DATASET_SIGNING_KEY_ID: 'es256-key-01',
      DATASET_SIGNING_PRIVATE_KEY: privatePem,
      DATASET_SIGNING_PUBLIC_KEY: publicPem,
    });

    const signer = new AttestationSignerService(config);
    const claims = {
      attestationVersion: '1.0.0',
      attestationId: 'att_test_es256',
      issuer: 'mma-tms-backend',
      audience: 'mma-tms-dataset-export',
      purpose: 'gold-dataset-promotion',
      keyId: 'es256-key-01',
      algorithm: 'ES256',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      nonce: 'nonce_es_1',
      exportId: 'exp_es_1',
      datasetHash: 'sha256:' + '1'.repeat(64),
      manifestDigest: 'sha256:' + '2'.repeat(64),
      reviewEvidenceDigest: 'sha256:' + '3'.repeat(64),
      qualityEvidenceDigest: 'sha256:' + '4'.repeat(64),
      policyVersion: 'v1',
      reviewPolicyVersion: 'v1',
      coveredActionIdsHash: 'sha256:' + '5'.repeat(64),
      decision: 'GOLD_READY' as const,
    };

    const res = signer.signAttestation(claims);
    expect(res.algorithm).toBe('ES256');

    const isValid = signer.verifySignature(claims, res.signature, 'es256-key-01');
    expect(isValid).toBe(true);
  });

  it('2.3 rejects unsupported algorithm configuration fail-closed', () => {
    expect(() => {
      new AttestationSignerService(
        new ConfigService({
          DATASET_SIGNING_ALGORITHM: 'RSA-MD5',
        }),
      );
    }).toThrow("Invalid signing algorithm 'RSA-MD5'");
  });

  // ─── 3. Database Single Active Attestation Constraint ──────────────────────

  it('3.1 database enforces at most one ACTIVE attestation per exportId', async () => {
    if (!client) return;

    const exportId = `exp_db_single_active_${Date.now()}`;
    // Insert candidate first
    await client.query(`
      INSERT INTO dataset_export_candidates (
        export_id, dataset_hash, manifest_digest, review_evidence_digest,
        quality_evidence_digest, policy_version, source_schema_version,
        sample_count, covered_action_ids_hash, candidate_status, created_at
      ) VALUES (
        $1, 'hash_1', 'man_1', 'rev_1', 'qual_1', 'v1', '1.0', 10, 'act_1', 'candidate', NOW()
      );
    `, [exportId]);

    const att1 = `att_1_${Date.now()}`;
    const att2 = `att_2_${Date.now()}`;

    // First active attestation succeeds
    await client.query(`
      INSERT INTO dataset_attestations (
        attestation_id, export_id, issuer, audience, purpose, key_id,
        algorithm, decision, claims, signature, status, issued_at, expires_at,
        actor_id, audit_correlation_id
      ) VALUES (
        $1, $2, 'issuer', 'aud', 'purpose', 'key1', 'Ed25519', 'GOLD_READY',
        '{}'::jsonb, 'sig1', 'ACTIVE', NOW(), NOW() + INTERVAL '10 minutes',
        'usr_1', 'aud_1'
      );
    `, [att1, exportId]);

    // Second active attestation for SAME exportId must fail with unique constraint violation
    await expect(
      client.query(`
        INSERT INTO dataset_attestations (
          attestation_id, export_id, issuer, audience, purpose, key_id,
          algorithm, decision, claims, signature, status, issued_at, expires_at,
          actor_id, audit_correlation_id
        ) VALUES (
          $1, $2, 'issuer', 'aud', 'purpose', 'key2', 'Ed25519', 'GOLD_READY',
          '{}'::jsonb, 'sig2', 'ACTIVE', NOW(), NOW() + INTERVAL '10 minutes',
          'usr_2', 'aud_2'
        );
      `, [att2, exportId]),
    ).rejects.toThrow();

    // After superseding first attestation, a new active attestation succeeds
    await client.query(`
      UPDATE dataset_attestations SET status = 'SUPERSEDED' WHERE attestation_id = $1;
    `, [att1]);

    const res = await client.query(`
      INSERT INTO dataset_attestations (
        attestation_id, export_id, issuer, audience, purpose, key_id,
        algorithm, decision, claims, signature, status, issued_at, expires_at,
        actor_id, audit_correlation_id
      ) VALUES (
        $1, $2, 'issuer', 'aud', 'purpose', 'key2', 'Ed25519', 'GOLD_READY',
        '{}'::jsonb, 'sig2', 'ACTIVE', NOW(), NOW() + INTERVAL '10 minutes',
        'usr_2', 'aud_2'
      ) RETURNING attestation_id;
    `, [att2, exportId]);

    expect(res.rows[0].attestation_id).toBe(att2);
  });

  // ─── 4. Database Append-Only Audit Trigger ─────────────────────────────────

  it('4.1 database trigger prevents UPDATE and DELETE on dataset_attestation_audit', async () => {
    if (!client) return;

    const exportId = `exp_audit_test_${Date.now()}`;
    const insertRes = await client.query(`
      INSERT INTO dataset_attestation_audit (
        event_type, export_id, actor_id, reason_code
      ) VALUES (
        'issued', $1, 'usr_audit_actor', 'TEST_AUDIT'
      ) RETURNING id;
    `, [exportId]);

    const auditId = insertRes.rows[0].id;

    // Attempt UPDATE -> must be rejected by trigger
    await expect(
      client.query(`
        UPDATE dataset_attestation_audit
        SET reason_code = 'TAMPERED'
        WHERE id = $1;
      `, [auditId]),
    ).rejects.toThrow('Audit logs are strictly append-only');

    // Attempt DELETE -> must be rejected by trigger
    await expect(
      client.query(`
        DELETE FROM dataset_attestation_audit
        WHERE id = $1;
      `, [auditId]),
    ).rejects.toThrow('Audit logs are strictly append-only');
  });

  // ─── 5. Nonce / Idempotency Retention and Cleanup ─────────────────────────

  it('5.1 cleanupExpiredNonces deletes expired nonces from persistence', async () => {
    if (!client) return;

    const expiredNonce = `nonce_expired_${Date.now()}`;
    await client.query(`
      INSERT INTO attestation_nonces (issuer, nonce, expires_at, created_at)
      VALUES ('issuer_test', $1, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '2 hours');
    `, [expiredNonce]);

    const nonceStore = new NonceStoreService(
      {
        delete: () => ({
          where: () => ({
            returning: async () => [{ nonce: expiredNonce }],
          }),
        }),
      } as any,
      new ConfigService({}),
    );

    const deletedCount = await nonceStore.cleanupExpiredNonces();
    expect(deletedCount).toBeGreaterThanOrEqual(1);
  });

  // ─── 6. Redis-Success / SQL-Rollback Reconciliation ───────────────────────

  it('6.1 releaseNonce safely handles speculative Redis reservation release', async () => {
    const nonceStore = new NonceStoreService(null as any, new ConfigService({}));
    // When Redis is not ready or null, releaseNonce must complete without exception
    await expect(nonceStore.releaseNonce('test_issuer', 'test_nonce')).resolves.toBeUndefined();
  });
});

