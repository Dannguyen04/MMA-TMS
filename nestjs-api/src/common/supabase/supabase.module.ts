import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_AUTH_CLIENT = Symbol('SUPABASE_AUTH_CLIENT');
export const SUPABASE_ADMIN_CLIENT = Symbol('SUPABASE_ADMIN_CLIENT');
export const SUPABASE_REQUEST_CLIENT_FACTORY = Symbol(
  'SUPABASE_REQUEST_CLIENT_FACTORY',
);

/**
 * Creates a throwaway anon client for one request. Flows that establish a user
 * session, such as redeeming a password recovery token, must never set that
 * session on a shared singleton client, because concurrent requests would then
 * observe each other's identity.
 */
export type SupabaseRequestClientFactory = () => SupabaseClient;

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
    {
      provide: SUPABASE_REQUEST_CLIENT_FACTORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SupabaseRequestClientFactory => {
        const url = config.getOrThrow<string>('SUPABASE_URL');
        const anonKey = config.getOrThrow<string>('SUPABASE_ANON_KEY');
        return () => createClient(url, anonKey, serverAuthOptions);
      },
    },
  ],
  exports: [
    SUPABASE_AUTH_CLIENT,
    SUPABASE_ADMIN_CLIENT,
    SUPABASE_REQUEST_CLIENT_FACTORY,
  ],
})
export class SupabaseModule {}
