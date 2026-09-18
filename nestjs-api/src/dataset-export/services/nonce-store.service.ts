import { Injectable, Inject, Logger, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { DRIZZLE } from '../../database/database.module.js';
import { attestationNonces } from '../../database/schema.js';
import { eq, and, gt } from 'drizzle-orm';

@Injectable()
export class NonceStoreService {
  private readonly logger = new Logger(NonceStoreService.name);
  private redisClient: Redis | null = null;

  constructor(
    @Inject(DRIZZLE) private readonly db: any,
    private readonly configService: ConfigService,
  ) {
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, { lazyConnect: true });
        this.redisClient.connect().catch((err: Error) => {
          this.logger.warn(`Redis connection for NonceStore failed: ${err.message}. Relying on PostgreSQL DB.`);
        });
      } catch (err: any) {
        this.logger.warn(`Failed initializing Redis client: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Atomically acquires a nonce.
   * Accepts an optional transaction handle `tx` to participate in database transactions.
   * Throws ConflictException if the nonce has already been used within the window.
   */
  async acquireNonce(
    issuer: string,
    nonce: string,
    ttlSeconds: number = 600,
    attestationId?: string,
    tx?: any,
  ): Promise<void> {
    if (!nonce || nonce.trim().length === 0) {
      throw new ConflictException('Nonce validation failed: Nonce cannot be empty.');
    }

    const dbClient = tx || this.db;
    const redisKey = `nonce:${issuer}:${nonce}`;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    // 1. Redis atomic check & set if available
    if (this.redisClient && this.redisClient.status === 'ready') {
      try {
        const result = await this.redisClient.set(redisKey, attestationId || '1', 'EX', ttlSeconds, 'NX');
        if (!result) {
          throw new ConflictException(`Nonce replay detected: Nonce '${nonce}' has already been used for issuer '${issuer}'.`);
        }
      } catch (err) {
        if (err instanceof ConflictException) {
          throw err;
        }
        this.logger.error(`Redis nonce error, falling back to DB: ${(err as Error).message}`);
      }
    }

    // 2. PostgreSQL DB atomic insert check (authoritative persistence)
    try {
      await dbClient.insert(attestationNonces).values({
        issuer,
        nonce,
        expiresAt,
        attestationId: attestationId || null,
        createdAt: new Date(),
      });
    } catch (err: any) {
      const errCode = err.code || err.cause?.code;
      const errMsg = String(err.message || '') + String(err.cause?.message || '');
      if (
        errCode === '23505' ||
        errMsg.includes('duplicate key') ||
        errMsg.includes('UNIQUE constraint') ||
        errMsg.includes('attestation_nonces_pkey')
      ) {
        throw new ConflictException(`Nonce replay detected in persistence: Nonce '${nonce}' already used.`);
      }
      throw err;
    }
  }

  /**
   * Checks if a nonce was already registered and active.
   */
  async isNonceUsed(issuer: string, nonce: string, tx?: any): Promise<boolean> {
    const dbClient = tx || this.db;
    if (this.redisClient && this.redisClient.status === 'ready') {
      const redisKey = `nonce:${issuer}:${nonce}`;
      const exists = await this.redisClient.exists(redisKey);
      if (exists > 0) return true;
    }

    const existing = await dbClient
      .select()
      .from(attestationNonces)
      .where(
        and(
          eq(attestationNonces.issuer, issuer),
          eq(attestationNonces.nonce, nonce),
          gt(attestationNonces.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return existing.length > 0;
  }
}
