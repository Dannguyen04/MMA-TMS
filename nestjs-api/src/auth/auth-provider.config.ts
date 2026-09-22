import type { ConfigService } from '@nestjs/config';

export type AuthProviderName = 'local' | 'supabase';

export function readAuthProvider(config: ConfigService): AuthProviderName {
  const fallback =
    config.get<string>('NODE_ENV') === 'production' ? 'supabase' : 'local';
  const provider = config
    .get<string>('AUTH_PROVIDER', fallback)
    .trim()
    .toLowerCase();

  if (provider !== 'local' && provider !== 'supabase') {
    throw new Error('AUTH_PROVIDER chỉ chấp nhận local hoặc supabase.');
  }
  return provider;
}
