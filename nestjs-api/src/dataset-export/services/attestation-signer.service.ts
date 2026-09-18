import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';

export interface AttestationClaims {
  attestationVersion: string;
  attestationId: string;
  issuer: string;
  audience: string;
  purpose: string;
  keyId: string;
  algorithm: string;
  issuedAt: string;
  expiresAt: string;
  nonce: string;
  exportId: string;
  datasetHash: string;
  manifestDigest: string;
  reviewEvidenceDigest: string;
  qualityEvidenceDigest: string;
  policyVersion: string;
  reviewPolicyVersion: string;
  coveredActionIdsHash: string;
  decision: 'GOLD_READY' | 'NOT_GOLD_READY';
}

export interface SignatureResult {
  signature: string;
  keyId: string;
  algorithm: string;
  digest: string;
}

@Injectable()
export class AttestationSignerService {
  private readonly logger = new Logger(AttestationSignerService.name);

  private readonly issuer: string;
  private readonly audience: string;
  private readonly currentKeyId: string;
  private readonly algorithm: string;

  private privateKeyPem?: string;
  private publicKeyPem?: string;
  private hmacSecret?: string;

  private readonly allowedAlgorithms = new Set(['Ed25519', 'ES256', 'HMAC-SHA256']);

  constructor(private readonly configService: ConfigService) {
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    const isGoldExportEnabled =
      this.configService.get<string>('GOLD_EXPORT_ENABLED', 'false') === 'true';

    this.issuer = this.configService.get<string>(
      'GOLD_PROMOTION_ISSUER',
      'mma-tms-product-backend',
    );
    this.audience = this.configService.get<string>(
      'GOLD_PROMOTION_AUDIENCE',
      'mma-tms-dataset-export',
    );
    this.currentKeyId = isProduction
      ? (this.configService.get<string>('DATASET_SIGNING_KEY_ID') || '')
      : this.configService.get<string>(
          'DATASET_SIGNING_KEY_ID',
          'dataset-signing-2026-09',
        );
    this.algorithm = this.configService.get<string>(
      'DATASET_SIGNING_ALGORITHM',
      'Ed25519',
    );

    if (!this.allowedAlgorithms.has(this.algorithm)) {
      throw new Error(
        `Invalid signing algorithm '${this.algorithm}'. Allowed: ${Array.from(this.allowedAlgorithms).join(', ')}`,
      );
    }

    this.privateKeyPem = this.configService.get<string>('DATASET_SIGNING_PRIVATE_KEY');
    this.publicKeyPem = this.configService.get<string>('DATASET_SIGNING_PUBLIC_KEY');
    this.hmacSecret = this.configService.get<string>('DATASET_SIGNING_HMAC_SECRET');

    if (isProduction && isGoldExportEnabled) {
      if (this.algorithm === 'HMAC-SHA256') {
        throw new Error('HMAC-SHA256 signing algorithm is forbidden in production environment.');
      }
      if (!this.privateKeyPem || !this.currentKeyId) {
        throw new Error(
          'Production startup failed: GOLD_EXPORT_ENABLED=true requires DATASET_SIGNING_PRIVATE_KEY and DATASET_SIGNING_KEY_ID.',
        );
      }
    }

    // Ephemeral key generation ONLY allowed in non-production local/test environments
    if (!this.privateKeyPem && !this.hmacSecret && !isProduction) {
      if (this.algorithm === 'HMAC-SHA256') {
        this.hmacSecret = crypto.randomBytes(32).toString('hex');
        this.logger.warn('Generated ephemeral in-memory HMAC secret for local dev/test.');
      } else if (this.algorithm === 'ES256') {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
          namedCurve: 'prime256v1',
        });
        this.privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        this.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        this.logger.log('Generated ephemeral in-memory ES256 keypair for local dev/test.');
      } else {
        const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
        this.privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
        this.publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
        this.logger.log('Generated ephemeral in-memory Ed25519 keypair for local dev/test.');
      }
    }
  }

  getIssuer(): string {
    return this.issuer;
  }

  getAudience(): string {
    return this.audience;
  }

  getKeyId(): string {
    return this.currentKeyId;
  }

  getAlgorithm(): string {
    return this.algorithm;
  }

  /**
   * Produce RFC 8785 Canonical JSON representation.
   */
  canonicalizeJson(data: any): string {
    if (data === null || typeof data !== 'object') {
      if (typeof data === 'number' && !Number.isFinite(data)) {
        throw new BadRequestException(`Canonical JSON error: Non-finite number (${data}) is rejected.`);
      }
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
   * Computes SHA-256 hex digest of canonicalized claims string.
   */
  computeClaimsDigest(claims: AttestationClaims): string {
    const canonicalString = this.canonicalizeJson(claims);
    return 'sha256:' + crypto.createHash('sha256').update(canonicalString, 'utf8').digest('hex');
  }

  /**
   * Signs attestation claims and returns signature result.
   */
  signAttestation(claims: AttestationClaims): SignatureResult {
    if (claims.keyId !== this.currentKeyId) {
      throw new BadRequestException(
        `Key ID mismatch during signing: requested=${claims.keyId}, current=${this.currentKeyId}`,
      );
    }

    const digest = this.computeClaimsDigest(claims);
    const canonicalString = this.canonicalizeJson(claims);

    let signature: string;

    if (this.algorithm === 'HMAC-SHA256' || (!this.privateKeyPem && this.hmacSecret)) {
      const secret = this.hmacSecret || 'default_hmac_secret';
      signature = crypto
        .createHmac('sha256', secret)
        .update(canonicalString, 'utf8')
        .digest('hex');
    } else if (this.privateKeyPem) {
      const privateKey = crypto.createPrivateKey(this.privateKeyPem);
      const signAlgorithm = this.algorithm === 'ES256' ? 'sha256' : null;
      signature = crypto
        .sign(signAlgorithm, Buffer.from(canonicalString, 'utf8'), privateKey)
        .toString('hex');
    } else {
      throw new Error('No valid private key configured for attestation signing.');
    }

    return {
      signature,
      keyId: claims.keyId,
      algorithm: this.algorithm,
      digest,
    };
  }

  /**
   * Verifies signature against claims without throwing unhandled exceptions on malformed inputs.
   */
  verifySignature(
    claims: AttestationClaims,
    signature: string,
    keyId: string,
    overridePublicKeyOrSecret?: string,
  ): boolean {
    if (!claims || !signature || !keyId) {
      return false;
    }

    if (keyId !== this.currentKeyId && !overridePublicKeyOrSecret) {
      this.logger.warn(
        `Key ID mismatch during verification: provided=${keyId}, current=${this.currentKeyId}`,
      );
      return false;
    }

    try {
      const canonicalString = this.canonicalizeJson(claims);

      if (this.algorithm === 'HMAC-SHA256' || (!this.publicKeyPem && !overridePublicKeyOrSecret)) {
        const secret = overridePublicKeyOrSecret || this.hmacSecret || 'default_hmac_secret';
        const expected = crypto
          .createHmac('sha256', secret)
          .update(canonicalString, 'utf8')
          .digest('hex');
        return crypto.timingSafeEqual(
          Buffer.from(signature, 'hex'),
          Buffer.from(expected, 'hex'),
        );
      }

      const pubKeyPem = overridePublicKeyOrSecret || this.publicKeyPem;
      if (!pubKeyPem) {
        return false;
      }

      const publicKey = crypto.createPublicKey(pubKeyPem);
      const verifyAlgorithm = this.algorithm === 'ES256' ? 'sha256' : null;
      return crypto.verify(
        verifyAlgorithm,
        Buffer.from(canonicalString, 'utf8'),
        publicKey,
        Buffer.from(signature, 'hex'),
      );
    } catch (err) {
      this.logger.warn(`Signature verification failed safely: ${(err as Error).message}`);
      return false;
    }
  }
}
