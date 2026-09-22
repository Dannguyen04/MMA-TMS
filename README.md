# MMA-TMS

MMA-TMS is a role-based training management system for fighters, coaches, sports doctors, and platform administrators. The repository contains a Next.js application, a NestJS/PostgreSQL API, Redis/BullMQ, and a Python YOLO pose-analysis worker.

The real full-stack migration is active but not complete. Authentication and the job boundary now use authenticated APIs, while several frontend business services still use the legacy in-memory data store because their backend route families have not been implemented. The authoritative implementation status and blockers are in [`implementation_plan.md`](implementation_plan.md) and [`docs/FULLSTACK_INTEGRATION_CONTEXT.md`](docs/FULLSTACK_INTEGRATION_CONTEXT.md).

## Runtime architecture

```text
Browser
  -> Next.js :3000 (HTTP-only session cookies and same-origin upload/job routes)
  -> NestJS :3001 (PostgreSQL, authorization, jobs, OpenAPI)
  -> Redis/BullMQ -> Python worker -> private object storage
```

- Successful API responses use `{ success, message, data }`.
- API errors use `{ success: false, error: { statusCode, code, message, details? } }`.
- OpenAPI is served at `/docs`, `/api-docs`, and `/docs-json`.
- Uploaded videos and analysis results are private. The frontend never exposes a service-role key.
- `/fighter/videos/live` remains a browser-only MediaPipe workflow.

## Configuration

Copy `.env.example` to `.env` and replace every placeholder. `start_all.bat` prefers this root file and falls back to `nestjs-api/.env` when the root file is absent. Never commit values for:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `WORKER_SECRET_TOKEN`
- `DATABASE_URL` when connecting outside Compose
- `DATABASE_SSL_CA_FILE` or `DATABASE_SSL_CA` when the remote PostgreSQL provider uses a private CA
- `E2E_BASE_URL` and `E2E_PASSWORD` for real Playwright runs

Compose runs the API with `AUTH_PROVIDER=local` and `STORAGE_DRIVER=local` (local PostgreSQL credentials/sessions and a private filesystem volume), so the Supabase variables are only needed when switching to `AUTH_PROVIDER=supabase` or `STORAGE_DRIVER=supabase`. Deterministic four-role users are seeded only by the isolated E2E project (`docker-compose.e2e.yml`, requires `E2E_PASSWORD`).

## Start and stop

On Windows:

```bat
start_all.bat
stop_all.bat
```

The launcher owns the `mma-tms-local` Compose project. The stop command only stops that project; it does not kill unrelated processes on ports 3000, 3001, or 6379.

Direct Compose usage:

```bash
docker compose -p mma-tms-local up --build --wait
docker compose -p mma-tms-local down
```

## Development commands

Use the repository pnpm lockfiles; do not use the untracked, git-ignored `nestjs-api/package-lock.json`.

```bash
corepack pnpm --dir nestjs-api run build
corepack pnpm --dir nestjs-api run test
corepack pnpm --dir nextjs-frontend run typecheck
corepack pnpm --dir nextjs-frontend run test
python-worker/.venv/Scripts/python.exe -m unittest discover -s python-worker -p "test_*.py"
node scripts/check-secrets.mjs
```

`npm run test:full` runs the portable quality-gate sequence. If the Python virtual environment is absent, it builds and uses the production worker image. Set `RUN_REAL_E2E=1`, `E2E_BASE_URL`, and `E2E_PASSWORD` to include isolated Compose and real UI login through Playwright.

## Security note

Tracked Supabase JWT literals were removed from `scripts/create_buckets.mjs` and `scripts/test_upload.mjs`. Repository cleanup cannot rotate credentials. The Supabase project owner must revoke and rotate any token that was previously committed, then update deployment secrets without adding them to Git.
