import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rootCertificates } from 'node:tls';
import { readBoolean, readCertificateAuthority } from './database.module.js';

const pem = rootCertificates[0]!;

describe('database TLS configuration', () => {
  it('keeps certificate verification enabled by default', () => {
    expect(
      readBoolean(
        new ConfigService({}),
        'DATABASE_SSL_REJECT_UNAUTHORIZED',
        true,
      ),
    ).toBe(true);
  });

  it('rejects an invalid boolean value', () => {
    const config = new ConfigService({
      DATABASE_SSL_REJECT_UNAUTHORIZED: 'sometimes',
    });
    expect(() =>
      readBoolean(config, 'DATABASE_SSL_REJECT_UNAUTHORIZED', true),
    ).toThrow(/true.*false/i);
  });

  it('accepts an inline PEM with escaped newlines', () => {
    const config = new ConfigService({
      DATABASE_SSL_CA: pem.replace(/\n/g, '\\n'),
    });
    expect(readCertificateAuthority(config)).toBe(pem);
  });

  it('reads a PEM file and rejects conflicting CA sources', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mma-tms-ca-'));
    const certificatePath = join(directory, 'database-ca.pem');
    writeFileSync(certificatePath, pem, 'utf8');

    try {
      expect(
        readCertificateAuthority(
          new ConfigService({ DATABASE_SSL_CA_FILE: certificatePath }),
        ),
      ).toBe(pem);
      expect(() =>
        readCertificateAuthority(
          new ConfigService({
            DATABASE_SSL_CA: pem,
            DATABASE_SSL_CA_FILE: certificatePath,
          }),
        ),
      ).toThrow(/DATABASE_SSL_CA.*DATABASE_SSL_CA_FILE/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects malformed certificate content', () => {
    expect(() =>
      readCertificateAuthority(
        new ConfigService({ DATABASE_SSL_CA: 'not-a-certificate' }),
      ),
    ).toThrow(/PEM/);
    expect(() =>
      readCertificateAuthority(
        new ConfigService({
          DATABASE_SSL_CA:
            '-----BEGIN CERTIFICATE-----\\ndGVzdA==\\n-----END CERTIFICATE-----',
        }),
      ),
    ).toThrow(/X\.509/);
  });
});
