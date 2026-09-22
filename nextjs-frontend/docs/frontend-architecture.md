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
| Caching | No React `cache()` around entity reads in services (they would go stale inside Server Action re-renders). Detail pages share one page-local `const loadX = cache(getX)` between `generateMetadata` and the page; staff lists (`listCoaches`, `listDoctors`, `listPermissionCatalog`) are cached. Start independent reads in one `Promise.all` — no request waterfalls. |
| Polling | Client polling uses `useVisibleInterval` (`components/ui/use-visible-interval.ts`: pauses while hidden, backs off when nothing changes) against route handlers (`routes.api.*`, `fetch` with `no-store`) — never Server Actions. |
| Lists | URL-driven: `searchParams` → service filter → `paginate()`/`sortItems()` (`src/lib/query.ts`) → `<Table>` + `<Pagination>`; filters via `<FilterBar>`. |
| Styling | Semantic design tokens only (`src/app/globals.css`). Light, dark and system themes via `data-theme` on `<html>` (cookie `mma_theme`). |
| Icons | `lucide-react`. Decorative icons get `aria-hidden`. |
| Charts | Hand-built SVG components in `src/components/charts` (no chart library). |
| Video pipeline | `NEXT_PUBLIC_VIDEO_PIPELINE=api` is the default. Production and real E2E reject `mock`; uploads use same-origin Route Handlers and authenticated NestJS jobs. |

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
- Every significant route gets a `loading.tsx`. Use `DashboardSkeleton`, `TableSkeleton` or `DetailSkeleton` when they
  match the page; otherwise compose the page's real shape from the blocks in `components/ui/skeleton.tsx`
  (`LoadingRegion`, `PageHeaderSkeleton`, `KpiRowSkeleton`, `FilterRowSkeleton`, `CardGridSkeleton`, `TableCardSkeleton`,
  `WeekAgendaSkeleton`) so content doesn't jump when it streams in. One `LoadingRegion` per loading state.
- Missing or inaccessible records → `notFound()` (never reveal records a user isn't assigned to).
- Empty collections → `<EmptyState>` explaining what is empty and offering the next action.

## Design system rules

- **Tokens only.** Use `bg-surface`, `text-fg-muted`, `border-border`, `bg-primary`, tone tokens
  (`success|warning|danger|info|ai|neutral` × `soft|fg|solid|border`) and `chart-1…8`. Never raw hex or
  Tailwind palette colours (`bg-blue-500`), never `dark:` overrides for colours.
- **Typography.** Page title via `PageHeader` (h1). Card titles via `CardHeader` (h2). Body 14px,
  secondary text `text-fg-muted`, tertiary `text-fg-subtle`. `tabular-nums` only in tables/axes.
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

## AI and medical communication

- AI output is **assistive**. Label it with `AIGeneratedBadge` / `ReviewStateBadge`, show confidence
  (`ConfidenceBadge`), and phrase titles as observations: "Possible hook detected", "Guard appears to
  drop after the lead hook". Never "Hook", "Injury detected", "Diagnosis".
- Low confidence (< `LOW_CONFIDENCE_THRESHOLD`, 60%) → "Needs review" styling and a prompt for human review.
- Human decisions are visually distinct from AI output: `UserCheck` / `PenLine` icons, reviewer name and time.
- Doctor-facing AI alerts are **"AI movement observations"** and always show the notice:
  _"AI observations are supporting information only. They are not a medical diagnosis and do not replace
  clinical examination or professional judgement."_
- Medical concepts stay separate: Medical Record ≠ Examination ≠ Injury ≠ Treatment ≠ Recovery Plan ≠
  Medical Clearance ≠ AI Observation. Each has its own card/section and wording.
- Medical Clearance is readable at a glance: `ClearanceBadge` + restrictions list + validity date.
  Coaches see clearance and restrictions (`medical:read_summary`) but never clinical notes.
- Warnings are calm and specific (what, why, what to do) — no alarmist language.

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

`APP_DATA_MODE=demo` is allowed only for an explicit non-production UI demo. API mode must not import, seed, or fall back to this state. The remaining adapter work is tracked in the root `implementation_plan.md`.
