<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Password recovery configuration (required by Fighter Admissions)

`POST /auth/reset-password` redeems a recovery link server side with
`supabase.auth.verifyOtp({ token_hash, type: 'recovery' })`, so the frontend must
receive a **`token_hash`**. The default Supabase "Reset Password" template sends
`{{ .ConfirmationURL }}`, which routes through `/auth/v1/verify` and returns the
user with a **session in the URL fragment** — that flow yields no `token_hash`
and does not satisfy this contract. Setting `redirectTo` alone does not change
it: the template itself decides which variable is sent.

### 1. Email template (Supabase Dashboard → Authentication → Email Templates → Reset Password)

Replace the confirmation URL with an explicit `token_hash` link:

```html
<a href="{{ .SiteURL }}/auth/reset-password?token_hash={{ .TokenHash }}&type=recovery">
  Reset password
</a>
```

- `{{ .TokenHash }}` is the hashed one-time token this backend verifies.
- `{{ .RedirectTo }}` may replace `{{ .SiteURL }}` when the link target should
  follow the `redirectTo` passed by the backend.
- Recovery links are **single use**. Mail scanners and clients that prefetch
  links can consume a link before the user clicks it, which then surfaces as
  `RESET_TOKEN_INVALID`; the landing page should require an explicit user action
  and must not verify automatically on load.

### 2. Redirect URL allowlist (Authentication → URL Configuration)

Add the exact value of `PASSWORD_RESET_REDIRECT_URL` to the allowlist. The
backend passes it as `redirectTo` to `resetPasswordForEmail`, and Supabase
rejects values that are not allowlisted. This is deliberately a single exact URL
and is **not** derived from the CORS origin list, which accepts wildcard and
substring matches.

### 3. Email provider

Password recovery requires a working email sender for the project (the built-in
sender is rate limited; configure SMTP for anything beyond local testing).
Without it, `POST /auth/forgot-password` still answers with its uniform message,
and an approved admission records the send attempt with `accepted = false`.

### 4. Environment variables

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Recovery mail request and the request-scoped client that verifies the token and updates the password |
| `SUPABASE_SERVICE_KEY` | Existing admin operations; **not** used to change a user password |
| `PASSWORD_RESET_REDIRECT_URL` | Exact recovery redirect target, allowlisted in Supabase |

### 5. Frontend contract

1. Read `token_hash` and `type=recovery` from the recovery link.
2. `POST /auth/reset-password` with `{ tokenHash, newPassword }`.
3. Sign in with the new password (this endpoint returns no tokens), then call
   `POST /fighter-admissions/activation` with that bearer token.
4. `RESET_PASSWORD_SAME_AS_CURRENT` means the account already uses that
   password: prompt for a different one rather than resubmitting the same value.

Tokens and passwords are never logged by the backend.

## Notifications

Module `src/notifications` (spec §05.12, FR-NOTIF-001…006). Status: code on
branch `User_Feature`; not built or tested, migration 014 not applied, not
deployed.

- **Flow:** business service commits → injects `NOTIFICATION_PUBLISHER`
  (`src/shared/contracts/notification.contract.ts`) and calls `notify` /
  `notifyResolved` → BullMQ queue `notifications` → worker stores one row per
  recipient (dedupe on `(user_id, dedupe_key)`) → Redis Pub/Sub channel
  `mma-tms:notifications:signals` → every API instance routes the signal to its
  local SSE connections.
- **Guarantees and limits:** notifications are requested only after commit and
  never fail the business response. A crash, Redis outage or enqueue timeout
  between commit and enqueue can lose a notification (accepted; no outbox or
  reconciliation job). `queued` means only that Redis accepted the job; retry
  does not prove delivery; there is no exactly-once delivery, ordering or
  `Last-Event-ID` replay. Offline users read the inbox from PostgreSQL.
- **Producer isolation:** request-time enqueue uses `NotificationProducer`, a
  dedicated client to the same Redis endpoint with one retry per command, no
  offline queue and bounded connect/command timeouts. While Redis is not
  connected, `notify` fails fast (`ENQUEUE_FAILED`) without calling BullMQ, so
  no pending work accumulates. The worker keeps the root BullMQ connection
  (`maxRetriesPerRequest: null`) and reconnects in the background; the AI
  queue is untouched. `ENQUEUE_TIMEOUT` is an unknown outcome: Redis may still
  have stored the job.
- **Queue job identity:** `notification-v2-<sha256>` over the namespaced event
  key and the canonical recipient set (unique, actor removed, sorted). The same
  event for the same recipients maps to one job; the same event for another
  recipient set is a separate job, and the per-recipient DB dedupe keeps
  overlaps safe. Re-enqueueing an ID BullMQ still retains (completed or
  failed) is ignored and does **not** retry a failed job. v1 IDs
  (`notification-<sha256>`) left in the queue keep being processed.
- **Realtime readiness:** auto-resubscribe is disabled; every subscriber
  connection generation sends SUBSCRIBE and is live only after its
  acknowledgement. Streams open, and `resync` is sent (once per successful
  re-subscription), only then. A failed or timed-out SUBSCRIBE is retried every
  `NOTIFICATION_PUBSUB_SUBSCRIBE_RETRY_MS`.
- **Slow consumers:** a client whose unsent buffer exceeds
  `NOTIFICATION_SSE_MAX_BUFFERED_BYTES`, or whose socket errors, is destroyed
  immediately (no `closing` event). Graceful closes send `closing` and are
  force-destroyed if the flush takes longer than
  `NOTIFICATION_SSE_CLOSE_GRACE_MS`. A connection counts toward the per-user
  limit until its socket has actually closed.
- **Endpoints:** `GET /notifications`, `GET /notifications/unread-count`,
  `PATCH /notifications/:id/read`, `GET /notifications/stream` (SSE, Bearer
  header, no JSON envelope). All are self-scoped; there is no send endpoint.
  Frontend contract: `docs/archive/FE-FIGHTER-COACH-FLOWS.md` §12.
- **Adding a trigger:** import `NotificationsModule`, inject
  `NOTIFICATION_PUBLISHER`, call it after the transaction commits with a stable
  `dedupeKey` taken from the mutation (row ID or written revision), and put the
  texts in the owning module's constants file. Add new types to the contract
  and to `notification_type` through a new migration.

Optional environment variables (defaults in `notifications.constant.ts`,
positive integers, validated at startup):

| Variable | Default | Meaning |
| --- | --- | --- |
| `NOTIFICATION_ENQUEUE_TIMEOUT_MS` | 2000 | Max wait for Redis to accept a job before reporting `failed`; also the producer command timeout |
| `NOTIFICATION_PRODUCER_CONNECT_TIMEOUT_MS` | 5000 | Producer connection attempt timeout |
| `NOTIFICATION_JOB_ATTEMPTS` | 5 | Worker attempts per job |
| `NOTIFICATION_JOB_BACKOFF_MS` | 2000 | Exponential backoff base |
| `NOTIFICATION_WORKER_CONCURRENCY` | 5 | Jobs processed in parallel per instance |
| `NOTIFICATION_JOB_KEEP_COMPLETED_SEC` | 86400 | Completed job retention (also the jobId dedupe window) |
| `NOTIFICATION_JOB_KEEP_FAILED_SEC` | 604800 | Failed job retention for inspection/re-run |
| `NOTIFICATION_PUBLISH_TIMEOUT_MS` | 2000 | Pub/Sub publish command timeout |
| `NOTIFICATION_PUBSUB_SUBSCRIBE_TIMEOUT_MS` | 5000 | Wait for one SUBSCRIBE acknowledgement |
| `NOTIFICATION_PUBSUB_SUBSCRIBE_RETRY_MS` | 5000 | Delay before retrying a failed SUBSCRIBE |
| `NOTIFICATION_REDIS_SHUTDOWN_TIMEOUT_MS` | 3000 | Graceful close bound for owned Redis clients before forcing |
| `NOTIFICATION_SSE_HEARTBEAT_MS` | 25000 | Heartbeat event interval |
| `NOTIFICATION_SSE_REVALIDATE_MS` | 300000 | Token/account re-check interval for open streams |
| `NOTIFICATION_SSE_MAX_LIFETIME_MS` | 3600000 | Max stream lifetime (also capped by token `exp`) |
| `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER` | 5 | Per user, per API instance |
| `NOTIFICATION_SSE_MAX_BUFFERED_BYTES` | 65536 | Unsent bytes before a slow client is disconnected |
| `NOTIFICATION_SSE_SUBSCRIBE_TIMEOUT_MS` | 3000 | Wait for the Pub/Sub subscription before answering 503 |
| `NOTIFICATION_SSE_RETRY_MS` | 5000 | `retry:` hint sent to clients |
| `NOTIFICATION_SSE_CLOSE_GRACE_MS` | 5000 | Max flush time of a graceful close before the socket is destroyed |

Every value is validated at startup against a per-key maximum
(`NOTIFICATION_CONFIG_MAX`) and never above the 32-bit timer limit.

Redis connection settings (`REDIS_URL` or `REDIS_HOST`/`REDIS_PORT`/
`REDIS_PASSWORD`) are shared with the root BullMQ config through
`src/shared/config/redis.config.ts`.

**Proxy/hosting for SSE:** disable response buffering and compression for
`/notifications/stream` (the API sends `X-Accel-Buffering: no` and
`Cache-Control: no-cache, no-transform`), keep idle/read timeouts above the
heartbeat interval, and do not cache the route. Failed jobs stay in the
`notifications` queue for `NOTIFICATION_JOB_KEEP_FAILED_SEC` and can be
inspected or retried with BullMQ tooling; there is no admin retry API.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
