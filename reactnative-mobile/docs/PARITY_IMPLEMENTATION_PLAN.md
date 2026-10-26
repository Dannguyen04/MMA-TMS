# MMA-TMS web vs mobile parity — implementation plan

Survey date: 2026-09-21 (audit DOCX). Plan living as of 2026-09-22.

Web (`nextjs-frontend`) is a **UX/information-architecture reference**. Many web pages use mock DB / demo cookies. Mobile only calls **verified NestJS controllers**. Do not copy mock records.

Canonical product: `docs/MMA-TMS-MASTER-SPECIFICATION-v2.md` (MVP 22.0 = Fighter + Coach video-to-insight; Admin/Ghost/live/comparison later).

**Blocked API handoff (required for future Nest wiring):** [`BLOCKED_SCREENS_API_HANDOFF.md`](./BLOCKED_SCREENS_API_HANDOFF.md). Native screens exist; do not invent REST paths.

## Reverse questions (product)

1. **Wave 1 roles:** Ship Fighter + Coach + Doctor read surfaces now, or Fighter-only until staff permissions are confirmed on the live grants table?
2. **Offline:** Online-only with retry (current), or local draft queues? No offline API exists.
3. **Video:** Jobs API is `POST/GET /jobs` with **no AccessTokenGuard**; create takes a remote `videoUrl`, not device upload. Is that acceptable as a fighter library, or wait for authenticated upload + evidence DTOs?
4. **Coach dashboard tab:** Keep 4 tabs and put “today / attention” on **Võ sĩ**, or add a 5th **Tổng quan** tab (changes chrome)?
5. **Fighter health:** Keep **Cơ thể** as measurements + medical summary, or add a 6th tab (crowds the custom tab bar)?
6. **Password reset / staff register:** Forgot-password is copy-only until an auth reset endpoint exists. OK?

Until answered: Wave 1 uses existing chrome (no new tabs), health on Home + Cơ thể, roster dashboard on Coach Võ sĩ, Doctor counts on Võ sĩ list.

## UI options (only where audit is ambiguous)

| Gap | Option A (chosen) | Option B |
| --- | --- | --- |
| Coach dashboard | Cards at top of fighter roster | New tab |
| Fighter health | Section on Home + Cơ thể | New tab |
| Session filters | Chip row (status) | Calendar/agenda (no dedicated calendar API) |
| Coach session edit | Fields on existing detail | Extra stack route |
| Video | **Blocked** — no auth/upload/evidence contract | Fake library from unauthenticated `/jobs` (**rejected**) |

## Gap inventory

Legend: **Ready** = Nest controller + DTO exist and mobile can consume. **Blocked** = would invent a contract or use unauthenticated/incomplete jobs.

| Screen | Role | Web route (approx.) | Mobile (audit / now) | API | Permission | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Login / register fighter | Shared | `/login` | Có | `POST /auth/login`, `POST /auth/register` | public | Done |
| Forgot password | Shared | `/forgot` | UI only | **None** | — | **Blocked** |
| Fighter home / dashboard | Fighter | `/` dashboard | Một phần | Compose `GET /users/me`, sessions, plans, `GET /fighters/:id/medical-summary` | `users.profile.read`, `fighter.session:read`, `training.plan:get_all`, `fighter.medical:read` | Wave 1 Ready (no AI score) |
| Fighter sessions list/detail | Fighter | schedule | Có; filters/RPE thin | `GET /fighters/:id/sessions`, `GET/PATCH /training-sessions/:id`, `PATCH .../status` | session read/transition; **update may be coach/admin only** | Wave 1 Ready (surface + 403-safe) |
| Fighter plans + exercises | Fighter | training/plan | Có | `GET /training-plans`, `GET .../exercises`, `GET /exercises/:id` | plan/exercise read | Done / polish |
| Fighter body measurements | Fighter | health body | Có | measurements CRUD self | `fighter.measurements:*` | Done |
| Fighter health / clearance | Fighter | health | Chưa | `GET /fighters/:id/medical-summary` | `fighter.medical:read` | Wave 1 Ready |
| Fighter profile + care team | Fighter | profile | Có | `PATCH /fighters/:id`, `GET .../coaches` | `fighter:update`, `fighter.coaches:read` | Done |
| Videos / upload / evidence | Fighter | videos/* | Chưa | Jobs **unauthenticated**; no findings override | — | **Blocked** Wave 2+ |
| Performance / goals | Fighter | performance, goals | Chưa | **No Nest module** | — | **Blocked** |
| Notifications | All | notifications | Chưa | **No Nest module** | — | **Blocked** |
| Settings (theme) | All | settings | Một phần | local | — | Theme done; channels **Blocked** |
| Coach roster | Coach | roster | Có search | `GET /fighters` query filters | `fighter:get_all` | Wave 1 filter chips |
| Coach dashboard | Coach | coach home | Chưa | Compose fighters + `GET /training-sessions` | list permissions | Wave 1 on roster |
| Coach fighter workspace | Coach | fighter tabs | Một phần | fighter, measurements, medical-summary, sessions, plans | medical + training reads | Wave 1 Ready |
| Coach plans edit + exercises | Coach | plans | Có; sets/reps thin | plan PATCH, plan-exercise CRUD | training.plan* | Wave 1 sets/reps/RPE |
| Coach sessions create/status | Coach | sessions | Có; edit/result thin | session PATCH | `training.session:update` | Wave 1 Ready |
| Coach video review | Coach | analysis | Chưa | same as jobs/findings | — | **Blocked** MVP |
| Coach goals / performance / clearance board | Coach | those pages | Chưa | **No dedicated APIs** (clearance only inside medical-summary) | — | **Blocked** / summary only |
| Doctor fighters + medical | Doctor | doctor/* | Một phần | list fighters, medical-summary. Không gọi measurements hay `GET /training-sessions` | `fighter.medical:read` | Wave 1 counts/filters |
| Doctor clinical CRUD | Doctor | exams/injuries/recovery/clearance write | Chưa | **No Nest clinical write controllers** | — | **Blocked** |
| Admin panel | Admin | admin/* | Home only | users/authorization exist; videos/models/audit **not** as web admin | mixed | Wave 3 / out of MVP |

## Waves

### Wave 1 (this run) — ready contracts, native chrome

- Fighter dashboard: greeting, week sessions, active plans, medical/clearance/disclaimer (no fabricated scores).
- Fighter health on Cơ thể; session status chips; session result fields (RPE, actual duration, cancel reason) via PATCH if permitted.
- Coach: roster medical filter + today strip; fighter detail medical + upcoming sessions + plans; session edit; plan exercise composition fields.
- Doctor: roster counts by `currentMedicalStatus` + status filter.

### Wave 2 — blocked or product-gated (UI shipped 2026-09-22)

Native stacks/empty states are openable. See `BLOCKED_SCREENS_API_HANDOFF.md`. Still **no** authenticated video upload, goals, performance, notifications, doctor writes, or admin list clients.

- Authenticated video upload, job progress UX, evidence timeline, coach accept/correct/reject.
- Goals, performance charts, notification centre, password email reset.
- Doctor exam/injury/recovery/clearance **writes**.

### Wave 3

- Admin users/roles/jobs/models/audit/broadcast: **UI stubs** on `/quan-tri/*`; wire only after Nest contracts (users/authorization already exist but mobile does not guess admin payloads).
- Ghost / live / comparison.

## QA (Wave 1)

- Fighter: login → Home shows medical or forbidden copy; Cơ thể disclaimer; Tập filter; complete session RPE (expect 403 if grant missing).
- Coach: Võ sĩ filter + today list; fighter detail medical; schedule PATCH notes/RPE; plan exercise sets.
- Doctor: counts; open medical; no invented clearance grant button.
- Demo gates: empty lists, no mock web data.
