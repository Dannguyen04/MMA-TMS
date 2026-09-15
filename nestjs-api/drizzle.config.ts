import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema.ts',
  // Introspection artifacts only. Numbered SQL migrations remain authoritative.
  out: './drizzle-artifacts',
  dialect: 'postgresql',
  schemaFilter: ['public'],
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },
});
