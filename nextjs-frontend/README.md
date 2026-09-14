# MMA-TMS Frontend

MMA Fighter Training & Health Management System — _Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ_.

One product for four roles:

| Role | Workspace |
| --- | --- |
| **Fighter** | Dashboard, schedule, training plans & history, video upload and AI analysis, performance by technique, goals, health & Medical Clearance |
| **Coach** | Roster and fighter profiles, training plans, sessions with live clearance checks, AI finding review, team performance, goals, clearance overview |
| **Sports Doctor** | Clinical overview, health profiles, medical records, examinations, injuries & treatment, recovery plans, Medical Clearance, AI movement observations |
| **Administrator** | Users, roles & permissions, videos, AI processing jobs, AI models & thresholds, audit logs, broadcasts, system settings |

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4. The backend is still in development, so the app runs on an in-memory mock data layer by default.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use a **demo account** on the sign-in screen (Minh Trần — fighter, Rafael Costa — coach, Dr. Thu Lê — sports doctor, Nora Whitfield — administrator). Any demo email also works with the password `mma-demo`.

Mock data resets when the dev server restarts. `MOCK_LATENCY_MS` (default 180) simulates network latency so loading states are visible; set it to `0` to disable.

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
| `NEXT_PUBLIC_VIDEO_PIPELINE` | `mock` | `api` uploads footage to Supabase Storage and analyses it with the NestJS job API and the Python worker |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL` | — | Required only in `api` mode |
| `MOCK_LATENCY_MS` | `180` | Simulated service latency in ms |
| `ALLOW_DEMO_AUTH` | unset | Production builds disable the mock sign-in unless this is `true`. It exposes every demo account, including medical data — use only for private demos |

## Architecture

See [`docs/frontend-architecture.md`](docs/frontend-architecture.md) for folder structure, the data and auth layers, the design system, form patterns, AI and medical communication rules, accessibility and responsive behaviour.

Replacing the mocks: keep the function signatures in `src/lib/services/*` and swap their bodies for API calls; swap `src/lib/auth/session.ts` for real token verification.
