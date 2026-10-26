# Blocked screens API handoff / Bàn giao API màn hình chưa nối

Living doc for a **future agent** after Nest ships real contracts.  
Mobile UI is built. **Do not invent REST paths, payloads, or fields.** Confirm against `nestjs-api` controllers/DTOs first.

Related: `docs/PARITY_IMPLEMENTATION_PLAN.md`, audit DOCX `MMA-TMS_Web_vs_Mobile_Parity_Audit_2026-09-21.docx`.  
Web IA reference: `nextjs-frontend/src/lib/routes.ts` (mocks, not Nest).

## Rules / Quy tắc

- **EN:** No `src/api/*.ts` method until the controller exists and is authenticated as product requires.
- **VI:** Không thêm client TypeScript cho endpoint chưa có. Không gọi `POST /jobs` để giả thư viện.
- Related **existing** jobs (incomplete for product): unauthenticated `POST /jobs` (`videoUrl`, optional `userId`), `GET /jobs`, `GET /jobs/:id`, `GET /jobs/impairments`, `GET /jobs/:id/health-alerts`. Worker-only `PATCH /jobs/:id/status` (`x-worker-secret`).
- Permission codes below exist in Nest catalogs (`FIGHTER_PERMISSIONS`, `TRAINING_PERMISSIONS`, `USER_PERMISSIONS`). Do not invent new codes.

Shared UI: `BlockedApiNotice` (`src/components/blocked/blocked-api-notice.tsx`).

---

## Auth

### Forgot password

| | |
| --- | --- |
| **Mobile route** | `/forgot-password` |
| **Screen file** | `src/app/(auth)/forgot-password.tsx` → `src/screens/auth/forgot-password.tsx` |
| **UI already shows** | Email field; submit shows pending copy; no request |
| **Web** | `/forgot-password` |
| **Status** | UI-only / no client method |
| **Missing on nestjs-api** | Password reset / email token. Existing auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout` |
| **Fields to bind** | Email is already collected. Token/new password: **DO NOT GUESS — confirm with nestjs-api when shipped** |
| **Permissions** | public (existing login/register) |
| **QA after wiring** | Valid email → success only after API; invalid → field error; no fake “email sent” if API fails |

---

## Fighter

### Video library

| | |
| --- | --- |
| **Mobile route** | `/video` |
| **Screen file** | `src/app/(fighter)/video/index.tsx` |
| **UI already shows** | `BlockedApiNotice`, links to upload/live/review, empty list |
| **Web** | `/fighter/videos` |
| **Status** | UI-only / no client method |
| **Missing on nestjs-api** | Authenticated fighter-owned video list. Related: unauthenticated `GET /jobs?userId=` — **do not use as library** |
| **Fields** | Web mock `Video`: id, fighterId, title, trainingType, cameraAngle, status, sourceUrl, jobId, notes. **DO NOT GUESS — confirm with nestjs-api when shipped** |
| **Permissions** | none catalogued for videos |
| **QA** | Empty until list exists; never show another user’s jobs |

### Video upload

| | |
| --- | --- |
| **Mobile route** | `/video/tai-len` |
| **Screen file** | `src/app/(fighter)/video/tai-len.tsx` |
| **UI already shows** | Disabled title/type/angle/notes + pick-video CTA |
| **Web** | `/fighter/videos/upload` |
| **Status** | UI-only / no client method |
| **Missing** | Authenticated upload + storage. Related incomplete: `POST /jobs` body `videoUrl` + optional `userId` (no guard, no multipart) |
| **Fields** | Web: title, trainingType, cameraAngle, notes, file. Bind only if Nest DTO matches. Else **DO NOT GUESS** |
| **Permissions** | none for upload |
| **QA** | Submit stays disabled until contract; no POST /jobs from this screen |

### Live form check

| | |
| --- | --- |
| **Mobile route** | `/video/truc-tiep` |
| **Screen file** | `src/app/(fighter)/video/truc-tiep.tsx` |
| **UI already shows** | Camera placeholder, no camera permission request |
| **Web** | `/fighter/videos/live` |
| **Status** | UI-only / no client method |
| **Missing** | Realtime / live pipeline — not on nestjs-api |
| **Fields** | **DO NOT GUESS** |
| **Permissions** | — |
| **QA** | Screen opens offline of camera; no invented websocket |

### Evidence / YOLO-style review

| | |
| --- | --- |
| **Mobile route** | `/video/xem` |
| **Screen file** | `src/app/(fighter)/video/xem.tsx` |
| **UI already shows** | Pipeline chips, dashed frame, observation vs decision, disabled accept/correct/reject |
| **Web** | `/fighter/videos/[videoId]` |
| **Status** | UI-only / no client method |
| **Missing** | Authenticated findings + evidence + human review. Related: `GET /jobs/:id` (status/score/resultUrl) and `GET /jobs/:id/health-alerts` without user guard — **do not bind as product review** |
| **Fields** | Web: observation vs `ReviewDecision` confirmed/corrected/rejected, confidence. Spec: hide fighter findings confidence &lt; 0.4. **DO NOT GUESS Nest field names** |
| **Permissions** | — |
| **QA** | No fake boxes/scores; coach/fighter labels stay observation vs decision |

### Goals

| | |
| --- | --- |
| **Mobile route** | `/muc-tieu` |
| **Screen file** | `src/app/(fighter)/muc-tieu.tsx` |
| **UI already shows** | Empty list + notice |
| **Web** | `/fighter/goals` |
| **Status** | UI-only / no client method |
| **Missing** | No goals module on nestjs-api |
| **Fields** | Web mock `Goal`: title, technique, metricLabel, unit, lowerIsBetter, baseline, target, current, startDate, dueDate, status, history. **DO NOT GUESS — confirm with nestjs-api when shipped** |
| **Permissions** | — |
| **QA** | List only after GET exists; no mock web DB |

### Performance + technique

| | |
| --- | --- |
| **Mobile route** | `/hieu-suat`, `/hieu-suat/[technique]` |
| **Screen file** | `src/app/(fighter)/hieu-suat/index.tsx`, `[technique].tsx` |
| **UI already shows** | Empty list |
| **Web** | `/fighter/performance`, `/fighter/performance/[technique]` |
| **Status** | UI-only / no client method |
| **Missing** | No performance module. Sessions/plans already wired elsewhere (`GET /training-sessions`, `GET /training-plans`) — not a substitute for technique scores |
| **Fields** | Web `PerformanceMetric` scores/strikeCounts/etc. **DO NOT GUESS** |
| **Permissions** | — |
| **QA** | No fabricated AI score on Home |

### Notifications

| | |
| --- | --- |
| **Mobile route** | `/thong-bao` |
| **Screen file** | `src/app/(fighter)/thong-bao.tsx` |
| **UI already shows** | Empty inbox |
| **Web** | `/notifications` |
| **Status** | UI-only / no client method |
| **Missing** | No notifications module |
| **Fields** | **DO NOT GUESS** |
| **Permissions** | — |
| **QA** | Empty until list API exists |

### Health history + injury detail

| | |
| --- | --- |
| **Mobile route** | `/suc-khoe/lich-su`, `/suc-khoe/chan-thuong/[id]` |
| **Screen file** | `src/app/(fighter)/suc-khoe/lich-su.tsx`, `chan-thuong/[id].tsx` |
| **UI already shows** | Empty |
| **Web** | `/fighter/health/history`, `/fighter/health/injuries/[injuryId]` |
| **Status** | UI-only / no client method |
| **Missing** | Clinical history/injury GET-by-id. Related read: `GET /fighters/:id/medical-summary`, measurements CRUD |
| **Fields** | Web `Injury` / examination types are **web mock**. **DO NOT GUESS** |
| **Permissions** | `fighter.medical:read` exists for summary only |
| **QA** | Summary still from medical-summary; injury page stays empty until Nest |

### Settings channels

| | |
| --- | --- |
| **Mobile route** | `/cai-dat` |
| **Screen file** | `src/app/(fighter)/cai-dat.tsx` |
| **UI already shows** | Disabled notification-channel field; theme toggle stays on Tôi |
| **Web** | `/settings` |
| **Status** | UI-only / no client method |
| **Missing** | No notification channel API. Theme is local. |
| **Fields** | **DO NOT GUESS** |
| **Permissions** | — |
| **QA** | Theme still works on Tôi; submit on this screen stays disabled |

---

## Coach

### Video analysis library / upload / review

| | |
| --- | --- |
| **Mobile route** | `/video-analysis`, `/video-analysis/upload`, `/video-analysis/review` |
| **Screen file** | `src/app/(coach)/video-analysis/*.tsx` |
| **UI already shows** | Empty library, disabled upload, evidence sketch + disabled review CTAs |
| **Web** | `/coach/video-analysis`, `/upload`, `/[videoId]` |
| **Status** | UI-only / no client method |
| **Missing** | Same as fighter video + coach override. Do not call unauthenticated jobs |
| **Fields** | **DO NOT GUESS** |
| **Permissions** | none for video review |
| **QA** | Accept/correct/reject never persist until API |

### Coach goals / performance / clearance board / notifications

| Route | File | Web | Missing |
| --- | --- | --- | --- |
| `/goals` | `(coach)/goals.tsx` | `/coach/goals` | No goals module |
| `/performance` | `(coach)/performance.tsx` | `/coach/performance` | No performance module |
| `/clearance` | `(coach)/clearance.tsx` | `/coach/medical-clearance` | No board API; read via `GET /fighters/:id/medical-summary` (`fighter.medical:read`) |
| `/thong-bao` | `(coach)/thong-bao.tsx` | `/notifications` | No notifications module |

**Status:** UI-only / no client method. **Fields:** **DO NOT GUESS**. **QA:** open from Tôi tab; no writes.

### Per-fighter videos / goals / performance

| | |
| --- | --- |
| **Mobile route** | `/fighters/[id]/videos`, `/fighters/[id]/goals`, `/fighters/[id]/performance` |
| **Screen file** | `src/app/(coach)/fighters/[id]/videos.tsx` (etc.) |
| **Web** | `/coach/fighters/[fighterId]/videos|goals|performance` |
| **Status** | UI-only / no client method |
| **Missing** | Same modules as above. Ready on same fighter: `GET /fighters/:id`, measurements, medical-summary, sessions, plans |
| **Fields** | **DO NOT GUESS** |
| **QA** | Stack from fighter detail; Wave 1 data still loads on index |

---

## Doctor

Clinical **reads** on `/medical` are `GET /fighters/:id/medical-summary` only. Doctor does not call `GET/POST /fighters/:id/measurements` or `GET /training-sessions`. Writes below are UI-disabled.

| Mobile route | File | Web | UI | Missing Nest | Bind fields |
| --- | --- | --- | --- | --- | --- |
| `/examinations` | `(doctor)/examinations/index.tsx` | `/doctor/examinations` | Empty + link new | No exam controllers | Web `MedicalExamination` — **DO NOT GUESS** |
| `/examinations/new` | `new.tsx` | `/doctor/examinations/new` | Disabled form | No POST | **DO NOT GUESS** |
| `/examinations/[examId]` | `[examId].tsx` | `/doctor/examinations/[examId]` | Empty | No GET by id | **DO NOT GUESS** |
| `/injuries` | `(doctor)/injuries/index.tsx` | `/doctor/injuries` | Empty | No injury controllers | Web `Injury` — **DO NOT GUESS** |
| `/injuries/new` | `new.tsx` | `/doctor/injuries/new` | Disabled form | No POST | **DO NOT GUESS** |
| `/injuries/[injuryId]` | `[injuryId].tsx` | `/doctor/injuries/[injuryId]` | Empty | No GET | **DO NOT GUESS** |
| `/recovery` | `(doctor)/recovery/index.tsx` | `/doctor/recovery` | Empty | No recovery module | **DO NOT GUESS** |
| `/recovery/new` | `new.tsx` | `/doctor/recovery/new` | Disabled form | No POST | **DO NOT GUESS** |
| `/recovery/[planId]` | `[planId].tsx` | `/doctor/recovery/[planId]` | Empty | No GET | **DO NOT GUESS** |
| `/clearance` | `(doctor)/clearance/index.tsx` | `/doctor/medical-clearance` | Copy + grant link | Grant POST missing; summary GET exists | Clearance type/status on summary DTO only |
| `/clearance/new` | `new.tsx` | `/doctor/medical-clearance/new` | Disabled grant form | No POST | **DO NOT GUESS** |
| `/records` | `(doctor)/records.tsx` | `/doctor/medical-records` | Empty | No records module | **DO NOT GUESS** |
| `/ai-alerts` | `(doctor)/ai-alerts/index.tsx` | `/doctor/ai-alerts` | Copy about jobs | `GET /jobs/impairments` exists **unauthenticated** — do not call | **DO NOT GUESS** product DTO |
| `/ai-alerts/xem` | `xem.tsx` | `/doctor/ai-alerts/[alertId]` | Empty | No authenticated alert GET | Related `GET /jobs/:id/health-alerts` unauthenticated |
| `/thong-bao` | `(doctor)/thong-bao.tsx` | `/notifications` | Empty | No notifications | **DO NOT GUESS** |

**Permissions (existing, related):** `fighter.medical:read`. `fighter.measurement:read` is coach/admin; `fighter.measurement:write` is admin; `training.session:get_all` is fighter/coach/admin. Doctor Y tế does not use those.

**QA:** `/medical` loads the summary only. It does not POST a checkup weight or list training sessions.

---

## Admin

Home is usable. Stubs do **not** call `GET /users` yet (admin UI contract not specified for mobile).

| Mobile route | File | Web | Missing |
| --- | --- | --- | --- |
| `/` in `(admin)` | `src/app/(admin)/index.tsx` | `/admin/dashboard` | Navigation hub (this screen is live) |
| `/quan-tri/nguoi-dung` | `quan-tri/nguoi-dung.tsx` | `/admin/users` | Users exist: `GET/POST/PATCH/DELETE /users` (`users.read` / `users.create` / `users.update` / `users.delete`). **Do not invent list filters.** |
| `/quan-tri/vai-tro` | `vai-tro.tsx` | `/admin/roles` | `PUT/DELETE /authorization/roles/:role/permissions/:permissionCode` — **no GET catalog** |
| `/quan-tri/video` | `video.tsx` | `/admin/videos` | No admin video API; jobs unauthenticated |
| `/quan-tri/job-ai` | `job-ai.tsx` | `/admin/ai-jobs` | `GET /jobs` unauthenticated — do not wire as admin |
| `/quan-tri/mo-hinh` | `mo-hinh.tsx` | `/admin/ai-models` | No models controller |
| `/quan-tri/nhat-ky` | `nhat-ky.tsx` | `/admin/audit-logs` | No audit GET |
| `/quan-tri/thong-bao` | `thong-bao.tsx` | `/admin/notifications` | No broadcast API |
| `/quan-tri/cai-dat` | `cai-dat.tsx` | `/admin/settings` | No settings API |

**Status:** UI-only / no client method (except admin home chrome). **Fields:** **DO NOT GUESS**. **QA:** open each from admin home; logout still works.

---

## Wiring checklist (all blocked screens)

1. Read the new controller + DTO in `nestjs-api`.  
2. Add `src/api/*.ts` only for those shapes.  
3. Replace `BlockedApiNotice` + disabled submit with real load/error/empty.  
4. Keep observation vs decision copy.  
5. Never SQL-insert users from mobile.
