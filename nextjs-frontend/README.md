# MMA-TMS Frontend

MMA Fighter Training & Health Management System — _Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ_.

One product for four roles:

| Role | Workspace |
| --- | --- |
| **Fighter** | Dashboard, schedule, training plans & history, video upload and AI analysis, performance by technique, goals, health & Medical Clearance |
| **Coach** | Roster and fighter profiles, training plans, sessions with live clearance checks, AI finding review, team performance, goals, clearance overview |
| **Sports Doctor** | Clinical overview, health profiles, medical records, examinations, injuries & treatment, recovery plans, Medical Clearance, AI movement observations |
| **Administrator** | Users, roles & permissions, videos, AI processing jobs, AI models & thresholds, audit logs, broadcasts, system settings |

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4. Outside production the app runs on demo data by default; production always uses the authenticated API and rejects demo data and the mock video pipeline.

## Run it

`npm run dev` starts the UI on demo data and the mock video pipeline, with no backend required.

API mode (`APP_DATA_MODE=api`, `NEXT_PUBLIC_VIDEO_PIPELINE=api`, `API_URL`) talks to the NestJS API. Several routes it calls are not on the backend yet: the user directory, invitations and account status, password reset, fighter doctor assignments, coach feedback, the coach/doctor directory, goals, performance, notifications, navigation badges, videos and AI jobs; `/users/me` must also return `effectiveCapabilities` and `assignmentScope`.

For frontend-only checks:

```bash
corepack pnpm install --dir . --frozen-lockfile
corepack pnpm run lint
corepack pnpm run typecheck
corepack pnpm run test
corepack pnpm run build
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm run start` | Production build (`output: "standalone"`) and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | Route type generation + `tsc --noEmit` |
| `npm test` | Vitest unit tests (domain rules, mock data integrity, charts, pose reconstruction, formatting) |
| `npm run test:e2e` | Playwright end-to-end suite against a running API-mode stack with seeded users (`E2E_BASE_URL`, `E2E_PASSWORD`) |

## Environment

Copy `.env.local.example` to `.env.local` when you need to change defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_DATA_MODE` | `demo` outside production, `api` in production | Set to `api` to use the NestJS API; production never runs demo |
| `NEXT_PUBLIC_VIDEO_PIPELINE` | `mock` outside production, `api` in production | Set to `api` together with `APP_DATA_MODE=api`; production and real E2E reject `mock` |
| `API_URL`, `NEXT_PUBLIC_API_URL` | — | Internal server URL and browser-visible API URL |
| `E2E_BASE_URL`, `E2E_PASSWORD` | — | Isolated real Playwright target and seeded-user password |
| `MOCK_LATENCY_MS` | `180` | Demo-mode service latency only |

## Architecture

See [`docs/frontend-architecture.md`](docs/frontend-architecture.md) for folder structure, the data and auth layers, the design system, form patterns, AI and medical communication rules, accessibility and responsive behaviour.

The AI and medical services still read demo data even in API mode until their backend routes exist. API mode must never fall back to demo data anywhere else.
