import pg from 'pg';
const { Client } = pg;

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Migration failed: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    await client.query(`
      DO $$ BEGIN
        CREATE TYPE attestation_status AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE attestation_decision AS ENUM ('GOLD_READY', 'NOT_GOLD_READY');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE audit_event_type AS ENUM ('requested', 'issued', 'rejected', 'revoked', 'key_rotated');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS dataset_export_candidates (
        export_id TEXT PRIMARY KEY,
        dataset_hash TEXT NOT NULL,
        manifest_digest TEXT NOT NULL,
        review_evidence_digest TEXT NOT NULL,
        quality_evidence_digest TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        source_schema_version TEXT NOT NULL,
        sample_count INTEGER NOT NULL,
        covered_action_ids_hash TEXT NOT NULL,
        candidate_status TEXT NOT NULL,
        readiness_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
        source_job_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dataset_reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        export_id TEXT NOT NULL,
        reviewer_id TEXT NOT NULL,
        reviewer_role TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'approved',
        comments TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dataset_quality_reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        export_id TEXT NOT NULL UNIQUE,
        quality_status TEXT NOT NULL,
        policy_version TEXT NOT NULL,
        metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dataset_attestations (
        attestation_id TEXT PRIMARY KEY,
        export_id TEXT NOT NULL REFERENCES dataset_export_candidates(export_id),
        issuer TEXT NOT NULL,
        audience TEXT NOT NULL,
        purpose TEXT NOT NULL,
        key_id TEXT NOT NULL,
        algorithm TEXT NOT NULL DEFAULT 'Ed25519',
        decision attestation_decision NOT NULL,
        claims JSONB NOT NULL,
        signature TEXT NOT NULL,
        status attestation_status NOT NULL DEFAULT 'ACTIVE',
        issued_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        revoked_reason TEXT,
        actor_id TEXT NOT NULL,
        audit_correlation_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS attestation_nonces (
        issuer TEXT NOT NULL,
        nonce TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        attestation_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (issuer, nonce)
      );

      CREATE TABLE IF NOT EXISTS dataset_attestation_audit (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type audit_event_type NOT NULL,
        export_id TEXT NOT NULL,
        attestation_id TEXT,
        actor_id TEXT NOT NULL,
        reason_code TEXT,
        request_digest TEXT,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS dataset_idempotency_keys (
        idempotency_key TEXT PRIMARY KEY,
        operation TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        request_digest TEXT NOT NULL,
        response_payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // Add algorithm column if missing from existing dataset_attestations table
    await client.query(`
      ALTER TABLE dataset_attestations ADD COLUMN IF NOT EXISTS algorithm TEXT NOT NULL DEFAULT 'Ed25519';
    `);

    // 1. Enforce one active attestation per export at database level
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uidx_dataset_attestations_single_active
      ON dataset_attestations (export_id)
      WHERE (status = 'ACTIVE');
    `);

    // 2. Add expires_at to dataset_idempotency_keys if missing
    await client.query(`
      ALTER TABLE dataset_idempotency_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    `);

    // 3. Enforce append-only immutable audit log via PostgreSQL trigger
    await client.query(`
      CREATE OR REPLACE FUNCTION prevent_audit_modification()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit logs are strictly append-only and cannot be updated or deleted.';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_dataset_attestation_audit_immutable ON dataset_attestation_audit;
      CREATE TRIGGER trg_dataset_attestation_audit_immutable
      BEFORE UPDATE OR DELETE ON dataset_attestation_audit
      FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
    `);

    console.log('✅ Schema migration executed successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
