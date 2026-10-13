# Procedural 3D Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, session-aware MMA-TMS landing page with an original procedural 3D fighter and gesture-driven combat animations, entirely in the Next.js frontend.

**Architecture:** Keep `src/app/page.tsx` server-rendered for session-aware links and semantic content, with a single client boundary around the React Three Fiber experience. Express fighter motion as pure pose functions consumed by nested Three.js joint groups so animation behavior is testable without WebGL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Three.js, React Three Fiber, Drei, Vitest, Playwright

**Spec:** `docs/superpowers/specs/2026-09-24-procedural-3d-landing-design.md`

## Global Constraints

- Modify only `nextjs-frontend`; do not change backend, database, API, or authentication contracts.
- `/` is public for signed-in and signed-out visitors.
- Signed-out primary CTA links to `/login`; signed-in primary CTA links to `dashboardPath(user.role)`.
- Use no GLB, FBX, external textures, paid assets, or runtime asset-generation services.
- Preserve normal page scrolling and support `prefers-reduced-motion`.
- Keep all essential copy and navigation in semantic HTML outside the canvas.

## Review Focus

- A visitor with no cookie can open `/`, while `/coach/dashboard` still redirects to `/login?next=...`; pinned in Task 1 proxy tests.
- A signed-in visitor stays on `/` and receives the correct role-dashboard CTA; pinned in Task 4 Playwright coverage.
- Rapid or ambiguous pointer gestures do not queue endless strikes; pinned in Task 2 state-machine tests.
- Reduced-motion visitors receive a static composition with no gesture attacks; pinned in Task 2 preference tests and Task 4 browser inspection.
- WebGL initialization failure leaves readable copy and functional CTAs; pinned in Task 3 component structure and Task 4 browser inspection.

---

### Task 1: Public root-route contract

**Files:**
- Modify: `nextjs-frontend/src/proxy.ts`
- Modify: `nextjs-frontend/src/proxy.test.ts`
- Modify: `nextjs-frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser(): Promise<User | null>`, `dashboardPath(role: Role): string`, `routes.login`
- Produces: root page props `primaryHref: string`, `primaryLabel: string`, and a public proxy path contract

- [ ] **Step 1: Write failing proxy tests**

Add tests proving that a cookie-free request to `/` returns status 200 and a cookie-free request to `/coach/dashboard` still redirects with `next`.

```ts
it("keeps the landing page public without weakening protected routes", async () => {
    vi.stubEnv("APP_DATA_MODE", "demo");
    expect((await proxy(new NextRequest("http://localhost:3000/"))).status).toBe(200);
    const protectedResponse = await proxy(new NextRequest("http://localhost:3000/coach/dashboard"));
    expect(protectedResponse.headers.get("location")).toBe("http://localhost:3000/login?next=%2Fcoach%2Fdashboard");
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `corepack pnpm --dir nextjs-frontend vitest run src/proxy.test.ts`

Expected: FAIL because `/` is not in the public path set.

- [ ] **Step 3: Make `/` explicitly public**

Represent public paths as exact path checks so `/` does not accidentally make every route public.

```ts
const PUBLIC_PATHS = ["/", routes.login, routes.forgotPassword];
const isPublic = PUBLIC_PATHS.some((path) => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
```

- [ ] **Step 4: Replace the root redirect with session-aware landing data**

Render `LandingPage` and derive only the CTA fields on the server.

```tsx
const user = await getCurrentUser();
return (
    <LandingPage
        primaryHref={user ? dashboardPath(user.role) : routes.login}
        primaryLabel={user ? "Open dashboard" : "Enter the arena"}
    />
);
```

- [ ] **Step 5: Run focused tests**

Run: `corepack pnpm --dir nextjs-frontend vitest run src/proxy.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the route contract**

```bash
git add nextjs-frontend/src/proxy.ts nextjs-frontend/src/proxy.test.ts nextjs-frontend/src/app/page.tsx
git commit -m "feat(frontend): make landing route public"
```

### Task 2: Deterministic fighter motion model

**Files:**
- Create: `nextjs-frontend/src/components/landing/fighter-motion.ts`
- Create: `nextjs-frontend/src/components/landing/fighter-motion.test.ts`

**Interfaces:**
- Produces: `FighterAction`, `FighterPose`, `createFighterController()`, `poseForAction(action, progress, idleTime, pointer)`, `gestureAction(deltaX, deltaY)`
- Consumes: no React or Three.js runtime; pure numeric inputs only

- [ ] **Step 1: Write failing pose and controller tests**

Cover direction mapping, ignored small gestures, clamped animation progress, cooldown rejection, return to idle, and reduced-motion rejection.

```ts
expect(gestureAction(90, 5)).toBe("hook-right");
expect(gestureAction(-90, 5)).toBe("hook-left");
expect(gestureAction(4, -80)).toBe("uppercut");
expect(gestureAction(6, 5)).toBeNull();

const controller = createFighterController({ reducedMotion: false, cooldownMs: 500 });
expect(controller.trigger("jab-cross", 1000)).toBe(true);
expect(controller.trigger("uppercut", 1200)).toBe(false);
expect(controller.sample(2200).action).toBe("idle");
```

- [ ] **Step 2: Run the motion test and verify failure**

Run: `corepack pnpm --dir nextjs-frontend vitest run src/components/landing/fighter-motion.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the action state machine and pose functions**

Use a compact `FighterPose` with torso, head, shoulder, elbow, hip, and knee rotations. Keep easing helpers private and return new pose objects from public functions.

```ts
export type FighterAction = "idle" | "uppercut" | "hook-left" | "hook-right" | "jab-cross";

export interface FighterPose {
    rootY: number;
    rootYaw: number;
    torsoPitch: number;
    torsoYaw: number;
    headYaw: number;
    leftShoulder: [number, number, number];
    rightShoulder: [number, number, number];
    leftElbow: number;
    rightElbow: number;
    leftHip: [number, number, number];
    rightHip: [number, number, number];
    leftKnee: number;
    rightKnee: number;
    impact: number;
}
```

- [ ] **Step 4: Run the motion tests**

Run: `corepack pnpm --dir nextjs-frontend vitest run src/components/landing/fighter-motion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit motion logic**

```bash
git add nextjs-frontend/src/components/landing/fighter-motion.ts nextjs-frontend/src/components/landing/fighter-motion.test.ts
git commit -m "feat(frontend): add procedural fighter motion model"
```

### Task 3: Procedural Three.js experience and semantic landing layout

**Files:**
- Modify: `nextjs-frontend/package.json`
- Modify: `nextjs-frontend/pnpm-lock.yaml`
- Create: `nextjs-frontend/src/components/landing/landing-page.tsx`
- Create: `nextjs-frontend/src/components/landing/landing-header.tsx`
- Create: `nextjs-frontend/src/components/landing/fighter-experience.tsx`
- Create: `nextjs-frontend/src/components/landing/fighter-scene.tsx`
- Create: `nextjs-frontend/src/components/landing/procedural-fighter.tsx`
- Create: `nextjs-frontend/src/components/landing/impact-effects.tsx`
- Modify: `nextjs-frontend/src/app/globals.css`

**Interfaces:**
- Consumes: `poseForAction`, `createFighterController`, `gestureAction`, existing `Logo`, `ButtonLink`, semantic color tokens
- Produces: `LandingPage({ primaryHref, primaryLabel })` and a decorative, failure-tolerant fighter experience

- [ ] **Step 1: Install the minimal WebGL dependencies**

Run:

```bash
corepack pnpm --dir nextjs-frontend add three @react-three/fiber @react-three/drei
corepack pnpm --dir nextjs-frontend add -D @types/three
```

Expected: package and lockfile contain only those additions.

- [ ] **Step 2: Implement the semantic landing shell**

Create a server-compatible `LandingPage` containing header, one `h1`, the exact slogan `Train harder. Recover smarter. Fight cleared.`, one supporting sentence, two CTA links, a three-item product proof rail, and a compact closing CTA. Reuse `Logo` and `ButtonLink`; do not duplicate button styling.

- [ ] **Step 3: Implement the client interaction boundary**

`FighterExperience` owns pointer/touch/wheel listeners, reduced-motion detection, WebGL support detection, action controller lifetime, and fallback state. It must never call `preventDefault()` on wheel or touch events.

- [ ] **Step 4: Build the articulated procedural fighter**

Construct nested joint groups for root, torso, neck, shoulders, elbows, hips, and knees. Reuse shared `capsuleGeometry`, `sphereGeometry`, and materials rather than creating geometry per frame. Apply numeric poses inside `useFrame` and dispose no shared declarative resources manually.

- [ ] **Step 5: Add scene lighting and impact effects**

Use ambient/key/rim lights, octagonal line rings, a small fixed particle field, glove trails, and a short radial impact pulse. Cap DPR to `[1, 1.5]`, disable shadows, and use `frameloop="demand"` for reduced motion.

- [ ] **Step 6: Add scoped landing styles and fallback**

Add reusable landing CSS classes for the grid glow, vignette, noise, octagons, and fallback fighter silhouette. Guard every continuous animation with `@media (prefers-reduced-motion: reduce)` and keep the existing semantic token system intact.

- [ ] **Step 7: Run static verification**

Run:

```bash
corepack pnpm --dir nextjs-frontend lint
corepack pnpm --dir nextjs-frontend typecheck
```

Expected: both exit 0.

- [ ] **Step 8: Commit the landing experience**

```bash
git add nextjs-frontend/package.json nextjs-frontend/pnpm-lock.yaml nextjs-frontend/src/components/landing nextjs-frontend/src/app/globals.css
git commit -m "feat(frontend): add interactive procedural fighter landing"
```

### Task 4: Browser behavior, accessibility, and final hardening

**Files:**
- Create: `nextjs-frontend/e2e/landing.spec.ts`
- Modify: landing files from Task 3 only when verification exposes a defect

**Interfaces:**
- Consumes: public root route and accessible CTA names from Tasks 1 and 3
- Produces: regression coverage for route, CTA, responsive, reduced-motion, and no-WebGL behavior

- [ ] **Step 1: Add Playwright coverage**

Test that signed-out `/` shows the headline and login CTA, signed-in `/` shows `Open dashboard`, the CTA reaches the role dashboard, the page does not overflow at mobile width, and reduced motion keeps the semantic page usable.

```ts
test("the public landing page leads signed-out visitors to login", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Train harder");
    await expect(page.getByRole("link", { name: "Enter the arena" })).toHaveAttribute("href", "/login");
});
```

- [ ] **Step 2: Run unit and proxy suites**

Run: `corepack pnpm --dir nextjs-frontend test`

Expected: PASS.

- [ ] **Step 3: Run lint and typecheck**

Run:

```bash
corepack pnpm --dir nextjs-frontend lint
corepack pnpm --dir nextjs-frontend typecheck
```

Expected: PASS.

- [ ] **Step 4: Run the production build in a non-production demo-safe environment**

Run: `corepack pnpm --dir nextjs-frontend build`

Expected: Next.js production compilation succeeds with no type or route errors. Do not set forbidden production demo/mock environment values.

- [ ] **Step 5: Inspect the page in the browser**

Run the frontend locally in demo mode, then inspect `/` at 1440×900 and 412×915. Verify the CTA, normal scrolling, click attack, horizontal swipe, upward swipe, reduced motion, visible focus, no horizontal overflow, and readable fallback when WebGL is disabled.

- [ ] **Step 6: Review for duplication and cleanup**

Run `git diff --check`, inspect `git diff --stat`, search landing files for repeated geometry/material/easing constants, and consolidate only actual duplicates. Confirm no backend or database path changed.

- [ ] **Step 7: Re-run the full verification set after cleanup**

Run:

```bash
corepack pnpm --dir nextjs-frontend test
corepack pnpm --dir nextjs-frontend lint
corepack pnpm --dir nextjs-frontend typecheck
corepack pnpm --dir nextjs-frontend build
```

Expected: every command exits 0.

- [ ] **Step 8: Commit final coverage and hardening**

```bash
git add nextjs-frontend/e2e/landing.spec.ts nextjs-frontend/src
git commit -m "test(frontend): cover public 3d landing experience"
```
