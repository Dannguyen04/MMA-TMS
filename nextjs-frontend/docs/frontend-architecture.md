# MMA-TMS Frontend Architecture

MMA fighter training, AI-assisted video analysis, performance and sports-medicine platform
(_Hệ thống Quản lý Huấn luyện và Theo dõi Sức khỏe Võ sĩ_). Next.js 16 App Router, React 19,
TypeScript (strict), Tailwind CSS v4. UI copy is English.

## Stack decisions

| Concern | Decision |
| --- | --- |
| Rendering | Server Components by default. `"use client"` only for interaction (forms, charts with hover, video player, filters). |
| Data | `src/lib/services/*` — async, `server-only`. API mode uses the authenticated client with Zod response validation and `no-store`. Retained demo implementations are dynamically imported only when demo mode is explicit. |
| Mutations | Server Actions in `src/lib/actions/*` returning `ActionState` (`src/lib/actions/state.ts`), consumed through the shared form hooks (see [Forms and mutations](#forms-and-mutations)). Validate with `zod`, re-authorize with `authorizeAction()` (clinical actions: `authorizeClinicalAction()` + `canAccessFighterClinically()`), call a service, `recordAudit()`, `revalidatePath()`. |
| Auth | Backend login/refresh/logout with secure HTTP-only SameSite=Lax access and refresh cookies. `src/proxy.ts` performs optimistic redirects and proactive refresh; `/users/me` and backend guards remain authoritative. Record access fails closed without backend capabilities and assignment scope. |
| Audit | API-mode audit reads rely on backend redaction and authorization. The demo adapter retains `toAuditView()` for explicit demo mode. Never expose clearance levels, health status, or restriction text in admin audit responses. |
| Caching | No React `cache()` around entity reads in services (they would go stale inside Server Action re-renders). Detail pages share one page-local `const loadX = cache(getX)` between `generateMetadata` and the page; staff lists (`listCoaches`, `listDoctors`, `listPermissionCatalog`) are cached. The exception is the medical service (`services/medical.api.ts`): every clinical read writes an audit row, so each fighter's dossier, history, examinations and review requests are read once per render. Server Actions run outside the render, so a write never reads a cached value. Start independent reads in one `Promise.all` — no request waterfalls. |
| Polling | Client polling uses `useVisibleInterval` (`components/ui/use-visible-interval.ts`: pauses while hidden, backs off when nothing changes) against route handlers (`routes.api.*`, `fetch` with `no-store`) — never Server Actions. |
| Lists | URL-driven: `searchParams` → service filter → `paginate()`/`sortItems()` (`src/lib/query.ts`) → `<Table>` + `<Pagination>`; filters via `<FilterBar>`. |
| Styling | Semantic design tokens only (`src/app/globals.css`). Light, dark and system themes via `data-theme` on `<html>` (cookie `mma_theme`). |
| Icons | `lucide-react`. Decorative icons get `aria-hidden`. |
| Charts | Hand-built SVG components in `src/components/charts` (no chart library). |
| Video pipeline | `mock` is the default outside production and `api` in production (`NEXT_PUBLIC_VIDEO_PIPELINE` overrides). Production and real E2E reject `mock`; uploads use same-origin Route Handlers and authenticated NestJS jobs. |

## Folder structure

```
src/
  app/
    (auth)/login, forgot-password         public screens
    (app)/layout.tsx                      requireUser + AppShell
    (app)/notifications, profile, settings shared account pages
    (app)/fighter|coach|doctor|admin/…    role areas; each has layout.tsx → requireRole()
  components/
    ui/          design-system primitives (no domain knowledge)
    charts/      SVG data visualisation
    domain/      domain-aware building blocks (status badges, cards, AI finding, clearance…)
    video/       video player, pose overlay, analysis timeline, upload wizard
    layout/      app shell, navigation
    brand/       logo
  lib/
    domain/      types.ts (entity contract), labels.ts (all enum labels), rules.ts (business rules),
                 clearance-rules.ts (restriction severity), training-plan.ts (timeline, adherence),
                 vitals.ts (reference ranges), ai-review.ts (review vocabulary and counts)
    services/    data access per domain (server-only)
    actions/     Server Actions per domain
    auth/        session, access, permissions (doctor-only clinical permissions), constants
    video/       job progress, job error codes (job-errors.ts), analysis navigation
    mocks/       seed data + in-memory db (only services import from here)
    api/         real backend adapters (NestJS jobs, Supabase storage)
    format.ts    dates (Asia/Ho_Chi_Minh), academy wall-clock <-> ISO, date keys, relative time,
                 numbers, confidence, durations; the only home for date helpers (no local copies)
    query.ts     URL list helpers
    routes.ts    every route path — never hardcode paths in components
```

Route-local components that are used by a single page live next to the page (e.g.
`app/(app)/coach/sessions/new/session-form.tsx`). Promote to `components/domain` only when a second
area needs it.

## Page template

```tsx
// app/(app)/coach/fighters/page.tsx
export const metadata: Metadata = { title: "Fighters" };

export default async function Page({ searchParams }: PageProps<"/coach/fighters">) {
    const user = await requireRole("coach");
    const params = await searchParams;
    const fighters = await listFightersForUser(user, { search: param(params.q) });
    return (
        <>
            <PageHeader title="Fighters" description="…" actions={<ButtonLink href={routes.coach.newPlan}>…</ButtonLink>} />
            <FilterBar filters={[…]} />
            <Card>…<Table>…</Table><Pagination … /></Card>
        </>
    );
}
```

- `params`/`searchParams` are Promises (Next 16). Use the global `PageProps<"/route">` / `LayoutProps` helpers.
- Every significant route gets a `loading.tsx`. Use `QueueSkeleton` (coach Today, doctor Triage), `TodaySkeleton`
  (fighter Today), `DashboardSkeleton`, `TableSkeleton` or `DetailSkeleton` when they match the page; otherwise compose the page's real shape from the blocks in `components/ui/skeleton.tsx`
  (`LoadingRegion`, `PageHeaderSkeleton`, `KpiRowSkeleton`, `FilterRowSkeleton`, `CardGridSkeleton`, `TableCardSkeleton`,
  `WeekAgendaSkeleton`) so content doesn't jump when it streams in. One `LoadingRegion` per loading state.
- Missing or inaccessible records → `notFound()` (never reveal records a user isn't assigned to).
- Empty collections → `<EmptyState>` explaining what is empty and offering the next action.

## Design system rules

- **"Fight Night" identity.** A cool light theme is the default (`--bg #EEF1F5`, navy ink `--fg #0E1A2B`, primary blue
  `#1846C4`); dark mode is the navy "Arena night" (`#0D1626`). Brand accents are tokens too:
  - `corner-red` is a brand accent only: the active tab underline, the active nav slash and `CornerTag`. Never use it
    for a status; danger has its own tone.
  - `corner-blue` equals `primary`.
  - `belt-gold` is for `BeltProgress`; text on it is ink (`warning-solid-fg`).
  - `rail-*` colour the light sidebar.
  - `nav-*` is the fixed navy "stage" (landing, auth screens, the video stage): the same value in every theme.
  - `hero-bg` is the ground of the fighter Today hero.
  - Utilities in `globals.css`: `octagon`, `chamfer` / `chamfer-tl` / `chamfer-br` (cut corners; put them on an
    `aria-hidden` backing layer so focus rings and shadows aren't clipped) and `cage-hatch` (faint cage mesh).
- **Fonts.** `font-display` is Barlow Condensed. It is used for the page h1 (italic), card titles, stat numbers, tabs,
  nav labels and eyebrows. Body text is Be Vietnam Pro (`font-sans`), mono is Geist Mono. Fonts come from `next/font`
  in `app/layout.tsx`; only the latin subset is preloaded.
- **Tokens only.** Use `bg-surface`, `text-fg-muted`, `border-border`, `bg-primary`, tone tokens
  (`success|warning|danger|info|ai|neutral` × `soft|fg|solid|border`) and `chart-1…8`. Never raw hex or
  Tailwind palette colours (`bg-blue-500`), never `dark:` overrides for colours.
- **Typography.** One h1 per page, always from `PageHeader`: display font, italic, sentence case. It is never
  uppercased, so screen readers read words, not letters. Card titles via `CardHeader` (h2). Body 14px, secondary text
  `text-fg-muted`, tertiary `text-fg-subtle`. `tabular-nums` only in tables/axes.
- **Surfaces.** Page on `bg-bg`; content in `Card` (`rounded-xl border bg-surface shadow-card`). Nested
  areas use `bg-surface-muted`. Radius: cards `rounded-xl`, controls `rounded-lg`, badges `rounded-md`.
- **Spacing.** Page sections `gap-6`; card padding `px-5 py-4`; grids `gap-4`/`gap-6`.
- **Grids.** Always declare the base track (`grid grid-cols-1 lg:grid-cols-3`) and give grid/flex children
  that contain truncating text `min-w-0`, otherwise long text widens the track and overflows on mobile.
  Use `items-start` for card grids whose cards have different natural heights.
- **Status never by colour alone.** Always use the badges in `components/domain/status-badges.tsx`
  (label + icon + tone). Don't create new status → colour maps elsewhere.
- **Fighters are octagons.** `<Avatar shape="octagon">` for fighters, circles for staff.
- **Buttons.** One primary action per view region. Destructive actions use `ConfirmDialog` and explain
  the consequence.
- **Labels.** Sentence case for every label, heading, nav item and enum label ("Training plans", "Not cleared",
  "Head movement"). Exceptions: the product term "Medical Clearance" and proper nouns. Enum labels come from
  `lib/domain/labels.ts` only.
- **Page eyebrows.** `PageHeader`'s `eyebrow` names the kind of record on detail, edit and create pages
  ("Examination", "Injury record", "Edit training plan"); role dashboards may show the date or organisation. List and
  index pages have no eyebrow — the navigation already names the section.
- **Navigation hubs.** The sidebar lists each role's hubs, not every page (`components/layout/navigation.ts`):
  - Fighter: Today · Training · Film · Progress · Health.
  - Coach: Today · Roster · Training · Film room · Clearance.
  - Doctor: Triage · Patients · Clinical · Observations.
  - Admin: Today · People · Admissions · Training · AI platform · System.

  A hub's sub-pages are tabs (`tabs` on the nav item, rendered by `HubTabs`; `hubForPath` and `hubTabsFor` decide the
  active hub and tab). Add a page to an existing hub's tabs before adding a sidebar item. Account links live in the
  avatar menu and the notification bell, not the sidebar.
- **Today pages answer one question.** No KPI rows on role Today pages; figures live in their hub.
  - Fighter Today: what do I do now (fight hero, readiness, this week).
  - Coach Today: a corner queue and today's schedule.
  - Doctor Triage: who needs me first, with recent examinations beside it.
  - Admin Today: who is stuck between roles (needs an assessor, awaiting a decision, needs a care team), with system
    status below the queue.

  A fighter who can't train yet sees the journey (`components/domain/fighter-journey.tsx`, built by
  `lib/domain/journey.ts` and read by `services/fighter-journey.ts`): account → sports doctor → baseline exam → Medical
  Clearance → training plan → first AI analysis, each step naming who moves it. The fighter's Today hero, the coach's
  fighter overview and the admin user page show it until every step is done.

  A queue is an `AttentionList` whose items carry a `group` (and an `at` due time). It is filtered by `?queue=` through
  `SegmentedLinks`, which hides empty groups, and the unfiltered view shows the most urgent eight. The doctor's order
  comes from `sortTriage` (`components/medical/triage-sort.ts`): danger, warning, AI, info, then the earliest due.
- **In-page tabs.** `Tabs` with `urlParam="tab"` records the open tab in the query string (`history.replaceState`, no
  navigation); the page reads `?tab=` back into `defaultTab`, so reloads and shared links open the same tab. Long pages
  (fighter Health, the doctor's fighter profile) split into tabs rather than stacking every card.
- **Notices.** `Callout` (tone, icon, title, text, optional action) for page- or card-level notices;
  `InlineNote` for a one-sentence note inside a card, form or dialog. Don't hand-roll tinted boxes. See the
  [inventory](#shared-ui-inventory) for their current paths.
- **Card-header links.** `CardLink` for navigation ("All jobs", "Audit logs"; add `srContext` when the label is
  generic). `ButtonLink` only for actions that start something ("Invite user", "Retry").
- **Segmented filters.** URL-driven status filters use `SegmentedLinks` (`components/ui/segmented-links.tsx`): links
  with counts, `aria-current` on the active one.
- **Chart colours.** `chart-1…8` are reserved for technique identity on screens that show techniques
  (`TECHNIQUE_COLOR`). Other categories (roles, statuses, generic series) use a single hue or neutral, and status is
  still carried by labels, never by colour.
- **Toasts and dialogs.** Toasts are hidden while a modal dialog is open, so errors from an action started in a
  dialog render inline in the dialog (`FormMessage` or `ConfirmDialog` `error`), never as a toast, and success toasts
  fire only after the dialog has closed (`ActionDialog` and `useConfirmAction` `onSuccess` do this for you). After a
  redirect, use `FlashToast` with `?notice=`.
- **Forms.** Mutations use the shared form hooks — see [Forms and mutations](#forms-and-mutations).
- **AI review wording.** Counts and labels for unreviewed / low-confidence findings and detections come from
  `lib/domain/ai-review.ts` (`reviewCounts`, `formatReviewCounts`), so every screen reports the same numbers.
- **Restrictions.** Severity comes from `restrictionSeverity()` (`lib/domain/clearance-rules.ts`): blocked training
  types and RPE limits block; techniques and protected regions are warnings the coach must acknowledge, matching
  `checkTrainingAgainstClearance`. Expiry checks always use `clearanceExpiresSoon()`.
- **Motion.** Subtle transitions only; `prefers-reduced-motion` is respected globally.

## Shared UI inventory

Reach for these before building anything new. Primitives in `components/ui` have no domain knowledge.

| Need | Use |
| --- | --- |
| Buttons and button-styled links | `Button` (`loading` keeps it focusable and blocks clicks), `ButtonLink`, `SubmitButton` (`ui/button.tsx`, `ui/submit-button.tsx`) |
| Form fields | `Field` + `Input` / `Select` / `Textarea` / `Checkbox`, `FormMessage` (`ui/form.tsx`) |
| Radio cards and choice lists | `ChoiceGroup` (`ui/choice-group.tsx`; `variant="card"` or `"compact"`, native radios in a fieldset) |
| On/off setting | `Switch` / `SwitchInput` (`ui/switch.tsx`) |
| Numeric scale (RPE, pain) | `ScaleSlider` (`ui/scale-slider.tsx`; anchors, hint, warning, error) |
| Coach rating stars | `CoachRating` (display) and `CoachRatingInput` (`domain/coach-rating.tsx`) |
| Local view switch (zoom, speed) | `SegmentedControl` (`ui/segmented-control.tsx`, `aria-pressed` buttons) |
| URL-driven status filter | `SegmentedLinks` (`ui/segmented-links.tsx`, links with counts and `aria-current`) |
| List filters | `FilterBar` (`ui/filter-bar.tsx`) |
| Dialogs | `Dialog`, `ConfirmDialog` (`ui/dialog.tsx`), `ActionDialog` (`ui/action-dialog.tsx`) |
| Popover and tooltip | `Popover` (`ui/popover.tsx`), `Tooltip` (`ui/tooltip.tsx`; describes one focusable child) |
| KPI tile | `StatCard` (`ui/stat-card.tsx`; the delta is read as "better" or "worse") |
| Loading states | blocks in `ui/skeleton.tsx` (see Page template) |
| Page or card notice | `Callout` (`components/training/callout.tsx`) |
| One-sentence note in a card, form or dialog | `InlineNote` (`components/dashboard/inline-note.tsx`) |
| Card header link | `CardLink` (`components/dashboard/card-link.tsx`) |
| Toast after a redirect | `FlashToast` (`components/medical/flash-toast.tsx`) |
| Status badges | `StatusBadge`, the per-enum badges and `FighterStatusBadges` (health + clearance) in `domain/status-badges.tsx` |
| Brand label, belt progress | `CornerTag` (`ui/corner-tag.tsx`; decoration only) and `BeltProgress` (`ui/belt-progress.tsx`; `role="img"`, status still needs a badge) |
| In-page and route tabs | `Tabs` (`ui/tabs.tsx`; `urlParam` for `?tab=`), `TabNav` for sub-routes, `HubTabs` (`layout/hub-tabs.tsx`) for hub pages |
| Prioritised to-do list | `AttentionList` (`medical/attention-list.tsx`; `group`, `at`, `empty`), built by `buildCoachAttention` / `buildTriageQueue` |
| Feature the backend doesn't offer yet | `FeatureUnavailable` (`ui/states.tsx`), gated by `medicalFeatureAvailable()` or `adminFeatureAvailable()` |
| Clearance validity ("Expires in 5 days") | `ClearanceValidity`, `ClearanceCell` (`domain/clearance-validity.tsx`) |
| Check-in trends | `CheckInCharts`, `CheckInTrendTile` (`domain/check-in-charts.tsx`; colours from `CHECK_IN_COLORS`) |
| Charts | `components/charts/*`; `BarChart` `details` adds breakdown rows to a single-series tooltip |
| Polling while visible | `useVisibleInterval` (`ui/use-visible-interval.ts`) |

## Forms and mutations

Every mutation goes through one of three hooks in `components/ui`:

- **`useActionForm(action, options)`** for a page or card form. Spread `form.formProps` on the `<form>` and never
  pass your own `action`. `form.control(name, { required, hint })` returns the id, name, `required` and aria wiring;
  `form.error(name)` feeds `Field`, `form.message` feeds `FormMessage`, `form.pending` feeds `SubmitButton`.
  - Values stay in the DOM after an error (no automatic form reset), errors clear as each field is edited, and focus
    moves to the first invalid control.
  - `prepare(fd)` runs client checks first; `onSuccess` / `onError` run after the result; `markEdited()` is for row
    builders and custom widgets; `submit(fields)` submits programmatically.
  - `formProps.action` is the useActionState dispatch, so a form never degrades to a GET that puts values (passwords)
    in the URL. Without `prepare`, `onSuccess` and `onError` the Server Action backs the state directly, so the form
    also works before hydration and without JavaScript (the sign-in form relies on this).
- **`ActionDialog`** for a form in a dialog: standard Cancel + submit footer, a fresh form on every opening, Escape
  and Cancel disabled while saving, errors inside the dialog, `onSuccess` after it has closed.
- **`useConfirmAction(run, { onSuccess })`** for one-click actions behind `ConfirmDialog`: spread `dialogProps` and
  call `request(payload)` to open. A failure keeps the dialog open with the error; `onSuccess` runs after it closes.

```tsx
const form = useActionForm(updateProfileAction);
const name = form.control("name", { required: true });
return (
    <form {...form.formProps}>
        <FormMessage {...form.message} />
        <Field label="Name" htmlFor={name.id} required error={form.error("name")}>
            <Input {...name} defaultValue={user.name} />
        </Field>
        <SubmitButton pending={form.pending}>Save</SubmitButton>
    </form>
);
```

`Field` passes `aria-describedby`, `aria-invalid` and `aria-required` to the `Input` / `Select` / `Textarea` inside
it (explicit props win), so `fieldDescribedBy` is only needed for controls outside a `Field` (row builders, checkbox
groups). Required fields set `required` on both the `Field` (visible star) and the control.

### Long forms, terms and quick fill

- **Steps, one submission.** A form longer than one screen is split with `FormSteps` / `FormStep`
  (`components/ui/form-steps.tsx`). Every step stays mounted (inactive ones are `hidden`), so values survive moving
  between steps and one Server Action receives every field. "Next" only checks that the step's required controls are
  filled (`validateStep` adds custom checks); the server stays the authority, and an error result opens the step that
  holds the first invalid control. `useFormSteps()` gives `goTo(id)` for "Edit" links on a review step.
- **Terms.** Jargon gets a tooltip from the glossary (`lib/domain/glossary/{admissions,medical,training}.ts`):
  `<TermHint term="spo2" />` in a `Field`'s, `Checkbox`'s or `FormSection`'s `info` slot (never inside a `<label>`),
  or `<Term term="rpe">RPE</Term>` inside text. Definitions are plain English, at most 220 characters.
- **Pick, don't type.** `SuggestionChips` fill or extend a field (`appendSuggestion`), templates prefill whole forms,
  and only facts the app already knows are prefilled silently (dates of today, the fighter in context, the exam just
  recorded). Clinical answers are never defaulted: a quick fill such as "Mark the remaining areas Normal" is a button
  the doctor presses, and it never overwrites an answered item.

## AI and medical communication

- AI output is **assistive**. Label it with `AIGeneratedBadge` / `ReviewStateBadge`, show confidence
  (`ConfidenceBadge`), and phrase titles as observations: "Possible hook detected", "Guard appears to
  drop after the lead hook". Never "Hook", "Injury detected", "Diagnosis".
- Low confidence (< `LOW_CONFIDENCE_THRESHOLD`, 60%) → "Needs review" styling and a prompt for human review. No
  confidence at all counts as low: it reads "Unavailable — requires review", never a made-up number.
- Human decisions are visually distinct from AI output: `UserCheck` / `PenLine` icons, reviewer name and time.
- Doctor-facing AI alerts are **"AI movement observations"** and always show the notice:
  _"AI observations are supporting information only. They are not a medical diagnosis and do not replace
  clinical examination or professional judgement."_
- Medical concepts stay separate: Medical Record ≠ Examination ≠ Injury ≠ Treatment ≠ Recovery Plan ≠
  Medical Clearance ≠ AI Observation. Each has its own card/section and wording.
- Medical Clearance is readable at a glance: `ClearanceBadge` + restrictions list + validity date.
  Coaches see clearance and restrictions (`medical:read_summary`) but never clinical notes.
- Warnings are calm and specific (what, why, what to do) — no alarmist language.

### Medical service (API mode)

- The NestJS medical service has its own vocabulary: examination decisions per scope, clearances issued from an
  examination, allow-list restrictions, 13 joints, flat recovery milestones and review requests.
  - `lib/domain/medical-contract.ts` holds its types and labels.
  - `medical-mappings.ts` translates them to the frontend domain.
  - `medical-bodies.ts` builds request bodies (pure, tested).
- The clearance state comes from the service's `eligibility` verdict (`clearanceStateFromEligibility`). The frontend
  never picks a governing clearance itself. A pending review request pauses training even while the clearance stands;
  `ClearanceCard pausedForReview` says so.
- Every fighter needs a `BASELINE` examination before training (`EXAMINATION_REQUIRED`): vitals, at least one assessed
  area and a SCAT6. The doctor's fighter page, review requests and Triage offer it while it's missing
  (`FighterHealthSummary.needsBaseline`).
  - Examination details (type, vitals, assessments, recommendations, follow-up date) share their fields with the demo
    form (`components/medical/examination-details-fields.tsx`) and their validation (`lib/actions/examination-fields.ts`).
  - The SCAT6 is entered by item position, never the official wording (`components/medical/scat6-fields.tsx`); its
    working state and the record it becomes are in `scat6-draft.ts`, the record's rules in `lib/domain/scat6.ts`
    (mirrors the service). The service computes the scores; demo mode scores the same way (`scat6-scoring.ts`).
- `usesMedicalServiceForms()` picks the doctor's forms: the service's forms in API mode, the richer demo forms in demo
  mode. Features the service doesn't offer (medical record, AI observation review, check-ins, treatment status, health
  status overrides) are demo-only: `medicalFeatureAvailable()` hides them in API mode and shows `FeatureUnavailable`,
  never mock data.
- Writes are never retried: a create that timed out may already be saved. Map failures with `medicalWriteFailure()`
  (`services/medical-errors.ts`):
  - 422 lands on the form field.
  - 403 means the doctor is no longer assigned.
  - 404 and 409 get a message per code.
  - 5xx, network errors and timeouts are unconfirmed: the clinical actions re-read the dossier first
    (`lib/actions/medical-contract.ts`). An examination that turns out saved moves on to the clearance step, an
    existing clearance (or a 409) is shown instead of a second one, and otherwise the draft stays on screen with
    "Try again", which re-reads again before resending. A clearance retry never touches the examination.
- The baseline examination is one stepped form (Vitals → Physical exam → three SCAT6 steps → Decision → Review) that
  sends one POST; issuing the clearance is step 2 on its own page, with the examination read back. Nothing clinical is
  pre-answered (`scat6-draft.ts` starts every answer blank); quick-fill buttons ("No symptoms", "Mark the N unmarked
  areas Normal", "Stamp now") are the doctor's own action and never overwrite an answer.
- Review requests: fighters ask for themselves, coaches and doctors for assigned fighters. A coach never sees what a
  fighter wrote to the doctor, only that a review was requested.

### Features the backend doesn't offer yet

Each service area has a gate built on `demoOnlyFeatureGate` (`services/feature-gate.ts`): `platformFeatureAvailable()`
(goals, performance, coach feedback, navigation badges, audit logs, broadcasts, system settings, AI models, AI job
retry/cancel and insights, self profile edits, body metrics), `adminFeatureAvailable()` and
`medicalFeatureAvailable()`. In API mode a gated read comes back empty or as the static baseline, the page shows
`FeatureUnavailable`, and the server action refuses with "not available yet"; the service function itself throws
`unsupportedOperation()` (501) as a backstop. Remove a feature from its gate's list once the backend serves it.

Where the backend models something differently, a `uses…ServiceForms()` helper picks the form: the service's own terms
in API mode, the richer demo forms in demo mode (`usesTrainingServiceForms`, `usesMedicalServiceForms`,
`usesUserServiceForms`).

### Training and video analysis (API mode)

- `lib/domain/training-contract.ts` maps session types and builds plan, plan exercise and session bodies. Every plan has
  a phase. Plans are created as drafts and then activated; a result is recorded on the session before it is completed.
  Starting a session can be refused by medical eligibility; `trainingEligibilityReasons()` lists why.
- The service has no templates or copy endpoints, so they live in the client: `lib/domain/training-templates.ts` holds
  the plan templates, session presets and a starter exercise library, with exercises named rather than referenced by id.
  A new plan is POSTed as a draft, its exercises are added in order, and it is activated only when every exercise went
  in, so the fighter's "plan active" notification arrives for a complete plan. "Duplicate" and "Schedule again" copy an
  existing plan or session through the ordinary reads. The objective is optional, as in the service.
- The exercise catalog (`/exercises`) is shared and only administrators may write to it. Template exercises missing from
  it are shown as "Not in library" and skipped; an administrator fills it from Training › Exercise library, whose
  "Import starter library" creates the missing starter exercises.
- Jobs and videos come from `/videos` and `/jobs`. A job's `score` is not a confidence; without one the UI shows
  "Unavailable — requires review" (`null`). Doctor-facing AI observations are the jobs' health alerts
  (`/jobs/impairments`); reviewing them is demo-only. Pages that aren't about video (the fighter dashboard, the
  doctor's fighter page) still load when the video service doesn't answer.
- Coaches review a pipeline analysis (`an-<job id>`) through the coaching service (`services/ai-coaching.api.ts`): it
  keeps the decisions on the worker's actions and findings and the overall summary, and `getVideoDetail` lays them over
  the worker result. The rules for a decision and a summary are shared with the demo (`domain/ai-review.ts`).

### Notifications (API mode)

- `services/notifications.ts` reads the inbox a page at a time (`page`, `limit`, `unreadOnly`) with the unread count,
  maps each event's `type` to a category and severity, and links its target record into the reader's own area.
  Applicants get a bell too (their assessment and decision). The service has no category filter or "mark all read",
  so those stay demo-only (`canMarkAllNotificationsRead()`).
- Live updates: `/api/notifications/stream` relays the service's event stream with the session's token (EventSource
  can't send headers, and the token never reaches the browser). While the service is down it answers with a retry hint,
  so EventSource tries again later instead of giving up.
- `useNotificationUpdates` refreshes on events and after every reconnect (the stream doesn't replay what it missed).
  While the stream is down, or in demo mode, it polls `/api/notifications/unread-count`, a Route Handler rather than a
  Server Action so a poll never queues ahead of a form submit.

### User accounts (API mode)

- `GET /users` pages by number (`{ items, total, page, limit }`); `drainNumberedPages` reads it like the other
  numbered lists. Self-registered applicants (`GUEST`) belong to fighter admissions and are left out of the list.
- Status comes from the account: active unless `isActive` is false or `deletedAt` is set, which shows as
  suspended. The status filter sends `ACTIVE` / `INACTIVE`; the service has no invitations.
- The service keeps no phone, job title, last sign-in, coach certifications or experience. `adaptBackendUser` leaves
  them null or empty (a job title falls back to the profile's specialisation) and the pages leave them out.
- `GET /users/:id` reads active accounts only, so suspended rows aren't linked. A coach's or doctor's linked profile
  comes from the account itself (`getApiUserWithProfile`), with the fighters they hold from current assignments.
- Administrators create an account with its first password and full role profile (`POST /users`), edit a profile
  (`PATCH /users/:id`, same role) and delete other accounts (`DELETE /users/:id`); `lib/domain/account-contract.ts`
  builds the bodies and `accountWriteFailure()` puts refusals on the form fields. Inviting, name/title/role edits,
  suspending and reactivating stay demo-only.
- A fighter's care team (coaches through `/fighters/:id/coaches`, sports doctors through `/fighters/:id/doctors`) is
  assigned and ended with a reason from the fighter's account page (`services/care-team.ts`).

### Fighter admissions

- A signed-in account is either an academy member or an applicant: `getSessionAccount()` returns
  `{ kind: "user" }` or `{ kind: "applicant" }` (`GUEST` in the API). `getCurrentUser()` is null for applicants,
  `requireUser()` sends them to `/apply` and `requireApplicant()` sends members to their dashboard.
- Applicants sign up, and come back to their application, at `/register` with a code sent to their email
  (`POST /auth/admission/email-code`, then `/verify-email`): no password until they're approved. They apply and follow
  their application at `/apply`, set their first password from the activation email and activate their fighter
  account. `/auth/reset-password` words itself for the context it can see (an approved applicant's first password, or a
  member's reset) and never calls the first password "forgot password", because Supabase sends both from one template. A new fighter then waits for a sports doctor and
  a baseline examination before training.
- Administrators assign the assessing coach and approve or reject passed applicants at `/admin/admissions`; coaches
  record the entrance assessment under Roster › Applicants (`/coach/admissions`). `lib/domain/admissions.ts` holds
  the types, labels and request bodies; `services/admissions.ts` reads and writes `/fighter-admissions/*`.
- The demo seeds applications at every stage and an "Applicant" demo account. It has no email step: the sign-up form
  shows the code, an approved application is ready to activate, and activating turns the applicant into a fighter with
  a new profile. It sends the same admission notifications as the service.

## Accessibility checklist

- Semantic landmarks and one `h1` per page; logical heading order.
- Every input has a `<Field>` label; `Field` wires hints and errors (`aria-describedby`), `aria-invalid` and
  `aria-required` onto its control. Required fields are marked visibly and programmatically.
- Loading buttons stay focusable. Controls that become disabled or disappear after use (Confirm, Mark all read,
  Clear filters) move focus to a stable element first.
- Interactive elements are native `button`/`a`; visible focus (global `:focus-visible` ring).
- Dialogs use `Dialog`/`ConfirmDialog` (native `<dialog>`: focus trap, Escape).
- Charts expose a table view and `aria-label`; tooltips never gate information. `Tooltip` describes its single
  focusable child (`aria-describedby`), opens on hover and focus, can be hovered and closes with Escape.
- Popovers close on Escape, outside click and when focus leaves them.
- Radio-like choices (theme, preview cards) are native radios in a `fieldset` with a legend: one tab stop, arrow keys.
- Nav and filter badges put their meaning in words for screen readers ("3 failed"), never only a number or colour.
- Live results (`aria-live`) for async status: uploads, processing, form results, toasts.
- Touch targets ≥ 36px (≥ 44px for primary mobile actions).

## Responsive behaviour

- `lg` and up: fixed 256px sidebar. Below `lg`: top bar with drawer; below `md`: bottom tab bar.
- Tables scroll horizontally inside their card. On mobile, prefer stacked card lists for primary
  fighter-facing lists.
- Complex workflows (analysis workspace, forms) use a two-column layout on `lg+` that stacks on mobile.

## Mock data

Demo-only seeds live in `src/lib/mocks/*` and follow the fighter storylines documented at the top of
`src/lib/mocks/people.ts`. Dates are relative to today (`src/lib/mocks/time.ts`); randomness is seeded
(`src/lib/mocks/random.ts`). The timeline is anchored once to server start (`MOCK_ANCHOR_MS`, shared through
`globalThis`): seed past events on today with `pastToday(hour, minute)` or `clampPastToday(iso)`, and derive later
events from an already-mapped time with `shiftPastToday(iso, minutes)`, so nothing seeded as past lands in the future. `db()` returns a mutable in-memory copy shared by the server process —
restart the dev server to reset. `MOCK_LATENCY_MS` (default 180) simulates network latency.

Demo is the default outside production until the backend exposes every endpoint the UI calls; set `APP_DATA_MODE=api` to use the NestJS API. Production never runs demo. API mode must not import, seed, or fall back to this state.
