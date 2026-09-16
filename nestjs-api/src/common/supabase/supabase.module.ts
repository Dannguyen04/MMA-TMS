import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_AUTH_CLIENT = Symbol('SUPABASE_AUTH_CLIENT');
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');

const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
} as const;

@Module({
  providers: [
    {
      provide: SUPABASE_AUTH_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_ANON_KEY'),
          serverAuthOptions,
        ),
    },
    {
      provide: SUPABASE_ADMIN_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createClient(
          config.getOrThrow<string>('SUPABASE_URL'),
          config.getOrThrow<string>('SUPABASE_SERVICE_KEY'),
          serverAuthOptions,
        ),
    },
  ],
  exports: [SUPABASE_AUTH_CLIENT, SUPABASE_ADMIN_CLIENT],
})
export class SupabaseModule {}
