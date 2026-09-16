console.error(
  'SQL migrations own this database, including RLS, triggers and grants. drizzle-kit push/generate is disabled. Create and review a numbered SQL migration; see migrations/README.md.',
);
process.exitCode = 1;
