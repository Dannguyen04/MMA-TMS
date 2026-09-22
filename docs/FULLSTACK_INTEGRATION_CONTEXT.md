# Full-stack integration context

Last updated: 2026-09-21 (Asia/Saigon)

## Purpose and current state

This document is the handoff record for replacing the MMA-TMS prototype data layer with authenticated, persisted services. It intentionally distinguishes verified work from planned work.

Current verified foundation:

- NestJS production TypeScript build passes.
- Job creation and reads require bearer authentication; ownership comes from the authenticated actor.
- Worker callbacks require an explicitly configured `x-worker-secret`.
- The response interceptor always emits `{ success, message, data }`, including `data: null` for undefined mutation results.
- Exact-origin CORS includes `PUT`; TLS verification defaults to enabled.
- Next.js login uses the API and stores access/refresh tokens in secure HTTP-only SameSite=Lax cookies.
- A server-only frontend client validates success/error envelopes, propagates backend error codes, applies a timeout, and uses `no-store`.
- Mutable Server Actions/Route Handlers rotate cookies and retry once after a 401; Server Components remain read-only and rely on proactive Proxy refresh.
- Bounded cursor-page draining rejects repeated cursors and item/page safety-limit overflow visibly.
- Fighter and clinical record access uses backend capabilities and assignment scope and fails closed when either is absent.
- `/users/me` now derives UI capabilities from effective role/user grants and returns active fighter assignment IDs for fighter, coach, and doctor sessions.
- Migrations 009–017 install the role baseline, restrict clinical RLS, scope fighter access by active assignment, add private local credentials/sessions, password-reset and invitation outboxes, account directory/status fields, and doctor-assignment permissions; 018–023 add the video storage contract, fighter UI fields, coach feedback, staff directory, performance permissions, and goals. They follow origin/main's 007 (ADMIN API grants) and 008 (FIGHTER training reads) and were renumbered from 007–021 when merging.
- Fresh local/E2E PostgreSQL volumes run a guarded local-only compatibility bootstrap for `auth.users`, `auth.uid()`, `anon`, and `authenticated` before migrations 001–023. It contains no users or credentials and refuses non-Compose database names.
- Local authentication uses scrypt password hashes and random opaque access/refresh tokens stored only as SHA-256 hashes. Access expires after 15 minutes; refresh sessions expire after seven days, rotate, and revoke atomically.
- The account API now provides cursor-paginated `GET /users`, local/Supabase-aware user creation, invitations/resend, account status transitions, and authenticated `PATCH /users/me` display-name/phone updates. Suspending a local account revokes active sessions and blocks login/access/refresh.
- Account/admin, people, training, goals, performance, notifications, audit reads, and navigation-badge services use authenticated API adapters in real mode. Their retained demo behavior is reached only through explicit dynamic imports.
- Training mappings preserve `missed`/`SKIPPED`, `archived`/`CANCELLED`, `TECHNICAL_DRILLING`, `RECOVERY_MOBILITY`, and granular exercise categories. Reads reject backend DTOs that omit UI-required fields instead of inventing values.
- Browser uploads and job creation use same-origin Route Handlers; the Supabase service key is server-only.
- The Python worker uses the official BullMQ Worker rather than manipulating Redis keys directly.
- The health monitor is connected to the video pipeline and emits joint state and confirmed alert data.
- API, frontend, and worker production Docker images build successfully with frozen dependency installation.
- The real 608-frame heavy-bag fixture completes inference and produces a schema-valid result.
- The ignored `nestjs-api/.env` passes structural validation; Redis and the Supabase Auth settings endpoint are reachable. Direct remote PostgreSQL currently fails strict TLS validation with `SELF_SIGNED_CERT_IN_CHAIN`, while Compose intentionally uses local PostgreSQL.

Not complete:

- Backend route families for goals/performance, clinical workflows, videos/analyses, dashboards, broadcasts, settings, notification preferences, and the complete admin surface.
- Remaining domain integration-state migrations beyond 023.
- Transactional video/job/analysis/outbox creation.
- Persisted progress, attempts, safe worker errors, normalized results, and reviews.
- Replacement of the three remaining statically mock-backed frontend services: AI, medical, and videos.
- Full conversion of the staged Playwright scenarios to persisted domain data; deterministic four-role local users and active coach/doctor assignments now exist.

## Safety baseline

- Pre-existing staged Playwright work is preserved.
- `nestjs-api/package-lock.json` remains an unrelated unresolved `DU` conflict and is untouched. Backend builds use `pnpm-lock.yaml`.
- `nestjs-api/.agents/BEHAVIOR.md`, `nestjs-api/.agents/rules/*`, and `scripts/run-git-bash.sh` are absent. Backend validation uses the installed Git Bash directly.
- On 2026-09-21 the user explicitly authorized Codex to implement production backend code. `nestjs-api/AGENTS.md` no longer requires an Antigravity implementation agent; missing vertical slices are implementation work rather than an agent-policy blocker.

## Authentication and authorization

Frontend cookies:

- `mma_access`: short-lived access token.
- `mma_refresh`: rotating refresh token, maximum seven days.
- `mma_access_expires`: server-only expiry hint used by Next Proxy for proactive refresh.

Next Proxy performs only an optimistic presence check and proactive refresh. NestJS guards and `/users/me` are authoritative. Cookies are HTTP-only, SameSite=Lax, path `/`, and secure in production.

When an access token is already expired, Proxy refreshes it and replays the same page or API request with a 307 redirect so the downstream Route Handler does not observe the stale token. Mutable API calls also have one guarded refresh/retry for unexpected early invalidation.

`/users/me` returns the user/profile contract, effective UI capabilities derived from persisted permission grants, and active assignment fighter IDs. Explicit per-user denies override role grants. Admin receives an empty fighter-ID array because the current frontend represents platform scope from the authenticated admin role plus capability; endpoint guards remain authoritative.

Target role policy:

| Role | Required scope |
| --- | --- |
| Fighter | Own profile, training, goals, videos, performance, and own clinical records |
| Coach | Actively assigned fighters; training and video review; only safety restrictions from clinical data |
| Doctor | Actively assigned fighter clinical records and alert review |
| Admin | Platform operations; no raw clinical details |

## API and UI matrix

| Domain | Backend/UI integration status |
| --- | --- |
| Login, refresh, logout | API routes exist; login/logout are integrated; proactive refresh is implemented in Next Proxy |
| Password reset request | Backend persists an enumeration-safe hashed request and private outbox event; known and unknown emails return the same response |
| Current user | API integrated; backend supplies derived capabilities and active assignment scope, and self-service display-name/phone updates persist through `PATCH /users/me` |
| Fighters and training | Authenticated frontend adapters use Zod validation and bounded pagination. Doctor assignment list/create/end routes are persisted and scoped, and `doctorsForFighter` reads active assignments; remaining fighter profile, coach directory, plan, exercise, result, and clearance fields still fail visibly |
| Performance | Authenticated frontend reads and explicit response schemas are implemented; the backend `/performance` route family is missing |
| Navigation badges | End-to-end API integration is complete. The backend returns unread notifications plus only the caller role's scoped operational count: coach review queue, doctor pending alerts, or admin failed jobs |
| Notifications | End-to-end API integration is complete for owned cursor-paginated reads, summary, mark-one, and transactional mark-all. Notification preferences remain pending |
| Goals and audit | Authenticated frontend adapters, cursor draining, mutations, and enum conversion are implemented; their backend route families are missing |
| Admin/platform | User list/filter, direct create, invite/resend, status changes, `/users/me`, and existing authorization routes are mounted. Settings, broadcasts, dashboards, and extended role-management routes remain incomplete |
| Video upload | Same-origin route streams to NestJS `POST /videos/upload`, which stores the object privately (local filesystem or Supabase driver) and persists video metadata |
| Analysis jobs | Authenticated/scoped API, worker callback, and same-origin creation exist; persistence model is incomplete |
| Worker processing | Official BullMQ worker and health monitor integration implemented; direct real-video inference is verified, service-to-service E2E is not |
| Clinical, goals, notifications, admin/platform | Schemas or UI may exist, but complete API integration is missing |

## AI contracts and data flow

Versioned schemas are under `contracts/`:

- `video-analysis-queue.v1.schema.json`
- `worker-job-status.v1.schema.json`
- `analysis-result.v1.schema.json`

Current flow:

```text
authenticated browser -> Next upload route -> NestJS POST /videos/upload -> private object (STORAGE_DRIVER local|supabase) + videos row
-> Next job route -> authenticated NestJS POST /jobs -> PostgreSQL + BullMQ { jobId, videoId, schemaVersion }
-> Python bullmq.Worker -> GET /jobs/:id/input (x-worker-secret) -> YOLO/action/health pipeline
-> POST /jobs/:id/result (x-worker-secret) -> private result object + DONE job/video state (DB transaction; object deleted if it fails)
```

The queue payload no longer carries a video URL; the worker streams input only through the worker-authenticated backend endpoint. Status callbacks (`PATCH /jobs/:id/status`) report `PROCESSING` and, after the final BullMQ attempt, `FAILED`.

Worker stages are `DOWNLOADING`, `INFERENCE`, `UPLOADING`, and `PERSISTING`. NestJS currently persists only coarse `PENDING`, `PROCESSING`, `DONE`, and `FAILED` status, so stage/progress/attempt details require the planned migration and API work.

## Infrastructure

- Dockerfiles use frozen pnpm installs.
- Backend and frontend images copy their pnpm build-policy files before install; required native dependency scripts are explicitly allowlisted.
- Compose starts PostgreSQL and Redis with health checks, mounts SQL migrations for a fresh database, waits for API health, and avoids source bind mounts.
- The local PostgreSQL bootstrap is mounted separately from the production migration manifest. Existing volumes do not rerun initialization; only fresh local/E2E volumes receive it automatically.
- `docker-compose.e2e.yml` overrides host ports for an isolated Compose project.
- The Python image copies the complete pipeline and pre-downloads `yolov8n-pose.pt`. No repository-local model artifact currently exists to copy.
- `start_all.bat`/`stop_all.bat` own only the `mma-tms-local` Compose project. The launcher prefers the root `.env`, falls back to `nestjs-api/.env`, and passes the selected file explicitly to Compose.
- Remote PostgreSQL keeps certificate verification enabled. A provider CA can be supplied with `DATABASE_SSL_CA_FILE` or `DATABASE_SSL_CA`; configuring both, malformed PEM, or a missing file fails fast.
- The root test runner invokes pnpm through Corepack and uses the production worker Docker image when a repository-local Python virtual environment is absent.

## Test data strategy

The E2E Compose project seeds deterministic fighter, coach, doctor, and admin credentials plus active assignments, and refuses any database name except `martial_arts_tracker_e2e`. The staged suite logs in through the real UI using `E2E_PASSWORD`, targets `E2E_BASE_URL` or the isolated frontend port, and no longer injects an auth cookie or starts a mock dev server. Remaining mock-backed scenario records still need persisted domain seeding.

Backend suites that mutate PostgreSQL require an explicit isolated `TEST_DATABASE_URL`. They skip instead of falling back to `DATABASE_URL`, preventing tests from writing to a developer or production database accidentally.

The direct pipeline fixture is `python-worker/validation_videos/vid_01_cross_heavybag.mp4`. The host checkout has no ready Python virtual environment, so worker validation runs in the production image. Full inference processed all 608 frames and emitted schema version `1.0.0`, five punches, 15 findings, zero confirmed health alerts, and eight persisted joint-health states.

## Verification log

2026-09-21:

- Frontend ESLint, type generation/TypeScript, and the 59-route production build: passed. The latest full Vitest run passed 264 tests across 25 files.
- NestJS Oxlint: passed with seven pre-existing dataset-export warnings.
- NestJS production build and 179 unit tests: passed.
- Live OpenAPI parity suite: 12 passed, including the `/users/me` capability/scope model, navigation badges, and notification DTOs.
- Migration checksums 001–015 and 26 isolated PostgreSQL migration/RLS checks: passed.
- A fresh isolated Compose PostgreSQL E2E volume applied bootstrap + migrations 001–008, exposed the expected auth compatibility objects, installed 75 baseline role grants, and passed its health check; the temporary project and volume were removed afterward.
- Backend Supertest suite: 64 passed; 17 database-mutating dataset governance tests skipped because no explicit isolated `TEST_DATABASE_URL` was supplied. They do not fall back to the developer `DATABASE_URL`.
- Focused Prettier check for every backend TypeScript file changed in the latest account slice: passed. Repository-wide `format:check` remains red on 67 legacy files.
- Python production image: built; full discovery suite passed 541 tests.
- Direct YOLO inference: processed all 608 fixture frames and validated the result against `analysis-result.v1.schema.json`.
- Direct inference exposed and now regression-tests a 60 FPS phase-timestamp rounding defect.
- API, frontend, and worker Docker image builds: passed. The API image was rebuilt again after migration 015 and now serves the doctor-assignment routes in both local stacks.
- Isolated Compose configuration with required placeholder variables: passed.
- Playwright discovery: 42 tests across six staged specifications; login fixtures now use the UI and require `E2E_PASSWORD`.
- Tracked-file secret scan: passed, with the explicit cryptographic test fixture allowlisted.
- Live local HTTP/DB verification passed for registration/login/refresh/logout, hashed credential/session storage, password-reset outbox behavior, four-role `/users/me`, fighter assignment scoping, admin local user creation, user list/filter pagination, and suspend/reactivate session enforcement.
- The drive-E exhaustion incident was recovered without pruning unrelated Docker data: a full WSL shutdown/start remounted the Docker data VHD, the zero-byte cached NestJS build was rebuilt without cache, and both Compose stacks returned healthy.
- Live invite/resend verification passed against the isolated Compose API and PostgreSQL: invite and resend remained `INVITED`, directory search returned the display name, invited login returned 401, and admin login persisted `lastActiveAt`. The database held two invitation requests with the prior request consumed, 64-character token hashes only, two pending outbox events without token/password material, and zero local credentials for the invited account.
- Live `PATCH /users/me` verification passed through the isolated API, appeared in `/docs-json`, persisted display name and phone, and restored the deterministic seed account afterward.
- Migration 015 was applied to both local Compose databases. A temporary host API connected to the E2E PostgreSQL/Redis services and verified scoped doctor-assignment data plus all three OpenAPI operations; the temporary process was then stopped.
- User-authorized selective cleanup removed the reproducible 5.88 GB `nextjs-frontend/.next` build artifact, a 654 MB obsolete Docker Desktop installer, and three unused MMA-TMS verification images. It did not run a global prune and did not alter any Medilab container, image, or volume. Drive E recovered from about 4.7 MB to about 6.56 GB free.
- The rebuilt NestJS image is healthy on the main and isolated E2E stacks. Live E2E login, `/docs-json` route discovery, and `GET /fighters/:id/doctors` passed against the container API with the seeded active doctor assignment.
- `GET /navigation/badges` passed through the rebuilt isolated container API. A four-role live probe returned only the allowed role-specific keys, and unauthenticated access returned 401.
- Notification live verification inserted two temporary records into the isolated database, proved newest-first cursor pagination and API mapping, returned 404 for a cross-user mutation, persisted mark-one/mark-all with the expected counts, then removed only those temporary rows. The rebuilt container exposes the same list and summary contracts; focused frontend adapter tests pass.

## Security owner action

Live-looking Supabase JWT literals were removed from:

- `scripts/create_buckets.mjs`
- `scripts/test_upload.mjs`

The repository cannot revoke them. A Supabase account owner must rotate/revoke the previously exposed credentials and update secret stores. Do not paste their old or new values into issues, documentation, logs, or commits.
