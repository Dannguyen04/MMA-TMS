# MMA-TMS Frontend

MMA Fighter Training & Health Management System — _Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ_.

One product for four roles:

| Role | Workspace |
| --- | --- |
| **Fighter** | Dashboard, schedule, training plans & history, video upload and AI analysis, performance by technique, goals, health & Medical Clearance |
| **Coach** | Roster and fighter profiles, training plans, sessions with live clearance checks, AI finding review, team performance, goals, clearance overview |
| **Sports Doctor** | Clinical overview, health profiles, medical records, examinations, injuries & treatment, recovery plans, Medical Clearance, AI movement observations |
| **Administrator** | Users, roles & permissions, videos, AI processing jobs, AI models & thresholds, audit logs, broadcasts, system settings |

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4. Authenticated API mode is the default; production builds reject demo data and the mock video pipeline.

## Run it

Run the repository Compose stack from the root after creating a non-placeholder `.env` from `.env.example`. Compose runs the backend with its local-auth and filesystem-storage adapters (`AUTH_PROVIDER=local`, `STORAGE_DRIVER=local`); see `../docs/FULLSTACK_INTEGRATION_CONTEXT.md` for the remaining blockers.

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
| `npm run test:e2e` | Playwright end-to-end suite (see `playwright.config.ts`) |

## Environment

Copy `.env.local.example` to `.env.local` when you need to change defaults.

| Variable | Default | Purpose |
| --- | --- | --- |
| `APP_DATA_MODE` | `api` | Set to `demo` only for an explicit non-production UI demo |
| `NEXT_PUBLIC_VIDEO_PIPELINE` | `api` | Production and real E2E reject `mock` |
| `API_URL`, `NEXT_PUBLIC_API_URL` | — | Internal server URL and browser-visible API URL |
| `E2E_BASE_URL`, `E2E_PASSWORD` | — | Isolated real Playwright target and seeded-user password |
| `MOCK_LATENCY_MS` | `180` | Explicit demo-mode service latency only |

## Architecture

See [`docs/frontend-architecture.md`](docs/frontend-architecture.md) for folder structure, the data and auth layers, the design system, form patterns, AI and medical communication rules, accessibility and responsive behaviour.

The remaining AI, medical, and video service adapters are tracked in `../implementation_plan.md`. Real mode must never fall back to their demo data.
