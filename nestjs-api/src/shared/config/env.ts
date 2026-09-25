/**
 * Single source of truth for process.env access outside the NestJS
 * ConfigService (which already covers DI-injected config, e.g. Supabase,
 * database, Redis, dataset-export). This file exists for the handful of
 * values read outside DI — bootstrap, guards, and plain utility functions —
 * so they are validated and typed once instead of re-parsed ad hoc.
 */

const NODE_ENVS = ['development', 'test', 'production'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

class EnvValidationError extends Error {
  constructor(key: string, reason: string) {
    super(`Invalid environment configuration for "${key}": ${reason}`);
    this.name = 'EnvValidationError';
  }
}

type EnvSource = Record<string, string | undefined>;

function getRequiredString(source: EnvSource, key: string): string {
  const value = source[key];
  if (!value || value.trim() === '') {
    throw new EnvValidationError(key, 'required but missing');
  }
  return value;
}

function getString(source: EnvSource, key: string, fallback: string): string {
  const value = source[key];
  return value && value.trim() !== '' ? value : fallback;
}

function getNumber(source: EnvSource, key: string, fallback: number): number {
  const value = source[key];
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new EnvValidationError(key, `"${value}" is not a valid number`);
  }
  return parsed;
}

function getUrl(source: EnvSource, key: string, fallback: string): string {
  const value = getString(source, key, fallback);
  try {
    new URL(value);
  } catch {
    throw new EnvValidationError(key, `"${value}" is not a valid URL`);
  }
  return value;
}

function getEnum<T extends readonly string[]>(
  source: EnvSource,
  key: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const value = getString(source, key, fallback);
  if (!allowed.includes(value)) {
    throw new EnvValidationError(
      key,
      `"${value}" is not one of [${allowed.join(', ')}]`,
    );
  }
  return value;
}

export function loadEnv(source: EnvSource) {
  return Object.freeze({
    NODE_ENV: getEnum<typeof NODE_ENVS>(
      source,
      'NODE_ENV',
      NODE_ENVS,
      'development',
    ) as NodeEnv,
    PORT: getNumber(source, 'PORT', 3001),
    FRONTEND_URL: getUrl(source, 'FRONTEND_URL', 'http://localhost:3000'),
    MOBILE_APP_URL: getUrl(source, 'MOBILE_APP_URL', 'http://localhost:8081'),
    APP_HEADER_LANGUAGE: getString(source, 'APP_HEADER_LANGUAGE', 'x-custom-lang'),
    WORKER_SECRET_TOKEN: getRequiredString(source, 'WORKER_SECRET_TOKEN'),
  });
}

export type Env = ReturnType<typeof loadEnv>;

export const env: Env = loadEnv(process.env);
