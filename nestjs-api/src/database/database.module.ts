import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { X509Certificate } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

export function readBoolean(
  config: ConfigService,
  key: string,
  fallback: boolean,
) {
  const configuredValue = config.get<string>(key)?.trim().toLowerCase();

  if (!configuredValue) {
    return fallback;
  }

  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  throw new Error(`${key} chỉ chấp nhận giá trị true hoặc false.`);
}

function validateCertificate(certificate: string, source: string) {
  const normalizedCertificate = certificate.replace(/\\n/g, '\n').trim();

  if (
    !normalizedCertificate.includes('-----BEGIN CERTIFICATE-----') ||
    !normalizedCertificate.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error(`${source} phải chứa chứng chỉ CA ở định dạng PEM.`);
  }

  try {
    new X509Certificate(normalizedCertificate);
  } catch (error) {
    throw new Error(`${source} phải chứa chứng chỉ X.509 hợp lệ.`, {
      cause: error,
    });
  }

  return normalizedCertificate;
}

export function readCertificateAuthority(config: ConfigService) {
  const inlineCertificate = config.get<string>('DATABASE_SSL_CA')?.trim();
  const certificateFile = config.get<string>('DATABASE_SSL_CA_FILE')?.trim();

  if (inlineCertificate && certificateFile) {
    throw new Error(
      'Chỉ được cấu hình một trong DATABASE_SSL_CA hoặc DATABASE_SSL_CA_FILE.',
    );
  }

  if (inlineCertificate) {
    return validateCertificate(inlineCertificate, 'DATABASE_SSL_CA');
  }

  if (!certificateFile) {
    return undefined;
  }

  const resolvedCertificateFile = resolve(process.cwd(), certificateFile);
  let certificate: string;

  try {
    certificate = readFileSync(resolvedCertificateFile, 'utf8');
  } catch (error) {
    throw new Error(
      `Không thể đọc chứng chỉ CA từ DATABASE_SSL_CA_FILE: ${resolvedCertificateFile}`,
      { cause: error },
    );
  }

  return validateCertificate(certificate, 'DATABASE_SSL_CA_FILE');
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL');
        const isRemote =
          !!connectionString &&
          !connectionString.includes('localhost') &&
          !connectionString.includes('127.0.0.1') &&
          !connectionString.includes('@postgres:');

        const ssl = isRemote
          ? {
              rejectUnauthorized: readBoolean(
                config,
                'DATABASE_SSL_REJECT_UNAUTHORIZED',
                true,
              ),
              ca: readCertificateAuthority(config),
            }
          : undefined;

        const pool = new Pool({
          connectionString,
          ssl,
        });
        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule {}
