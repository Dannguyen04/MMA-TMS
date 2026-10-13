# Procedural 3D Landing Page Design

## Goal

Replace the root-route redirect with a public MMA-TMS landing page that feels focused, premium, and interactive without relying on paid 3D assets. The page must remain entirely frontend-owned: no backend, database, authentication contract, or API changes.

The landing page should communicate the product in seconds, keep copy deliberately sparse, and use an original procedural fighter as the visual centerpiece. Signed-in visitors still see the landing page; their primary CTA opens the dashboard for their role. Signed-out visitors are sent to the existing login route.

## Visual direction

The hero uses the existing MMA-TMS brand palette: cage black, graphite surfaces, red and blue corner accents, and restrained white type. The procedural fighter is a stylized training hologram assembled from lightweight Three.js geometry. It should read clearly as an MMA athlete in guard without pretending to be photorealistic.

The viewport is split into two overlapping layers:

- Semantic HTML content on the left: logo, compact eyebrow, slogan, one supporting sentence, and primary/secondary CTAs.
- A WebGL scene on the right and behind the copy: fighter, octagonal floor rings, rim lighting, particles, strike trails, and impact flashes.

Below the hero, one compact proof rail communicates the three product pillars: AI analysis, training performance, and medical clearance. A final concise CTA closes the page. The design avoids feature grids, long paragraphs, dashboards, or marketing statistics that are not backed by real data.

## Route and session behavior

- `/` becomes a public route in `src/proxy.ts`.
- `src/app/page.tsx` no longer redirects.
- The page reads the existing optional session on the server.
- Signed-out CTA: `Enter the arena` links to `/login`.
- Signed-in CTA: `Open dashboard` links to `dashboardPath(user.role)`.
- The landing page never mutates session state and introduces no API calls.
- Existing protected-route behavior stays unchanged.

## Component architecture

The page remains a Server Component and passes only serializable CTA data to the landing view. WebGL code is isolated behind a small client boundary.

```text
src/components/landing/
  landing-page.tsx          semantic page composition
  landing-header.tsx        brand and session-aware CTA
  fighter-experience.tsx    client interaction boundary and fallback selection
  fighter-scene.tsx         React Three Fiber canvas and scene setup
  procedural-fighter.tsx    articulated geometry and pose application
  fighter-motion.ts         pure pose/animation math
  impact-effects.tsx        trails, flash, particles, floor pulse
```

The fighter is built from nested `THREE.Group` joints rather than a skinned mesh. Torso, head, gloves, limbs, shorts, and feet are composed from reusable geometry primitives. Pose calculations are pure data so animation behavior can be unit-tested independently of WebGL.

## Motion and interaction

The experience uses a small state machine with `idle`, `uppercut`, `hook-left`, `hook-right`, and `jab-cross` actions. Actions have a short anticipation, strike, recovery, and cooldown; every action blends back into guard.

- Initial state: breathing and subtle stance shifting.
- Wheel upward or upward touch swipe: uppercut.
- Horizontal pointer/touch swipe: hook in that direction.
- Click/tap on the scene: jab-cross.
- Pointer position: subtle head and torso tracking while idle.
- Page scroll: camera and floor-ring parallax only; normal scrolling is never prevented.

Motion trails and impact effects are generated in the scene rather than represented as baked assets. Repeated events inside the cooldown are ignored to prevent jitter.

## Progressive enhancement and performance

- HTML copy and CTAs render without waiting for WebGL.
- The canvas is loaded only in the client boundary.
- A CSS-rendered octagon/fighter silhouette remains visible while the scene loads or if WebGL fails.
- DPR is capped, antialiasing is conservative, shadows are avoided, geometry is reused, and the scene has no external textures or model downloads.
- The canvas is decorative and excluded from the accessibility tree.
- `prefers-reduced-motion` disables gesture attacks, particles, camera movement, and continuous idle animation while preserving the static composition.
- Coarse-pointer and small-screen layouts keep a touch-friendly CTA and reduce scene complexity.

## Accessibility

- Page structure uses landmarks, one `h1`, meaningful link text, and visible focus states.
- All core information and navigation exist as HTML, never inside the canvas.
- Instructions are short and nonessential; keyboard users do not need to trigger fighter animations to access content.
- Contrast follows the existing semantic tokens.
- Motion is never required to understand or operate the page.

## Dependencies

Add only:

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `@types/three` as a development dependency if the installed Three.js package does not provide sufficient declarations for project settings.

No animation library is required. The scene uses React Three Fiber's frame loop and small deterministic easing helpers.

## Validation

- Unit-test pose interpolation, direction mapping, cooldown behavior, and reduced-motion behavior.
- Update proxy tests to prove `/` is public while role routes remain protected.
- Add Playwright coverage for the signed-out and signed-in root-page CTAs.
- Run lint, typecheck, unit tests, production build, and the relevant Playwright spec.
- Inspect the final page at desktop and mobile sizes, including a reduced-motion emulation.
- Review changed files for duplicated geometry, easing, route, and CTA logic before completion.

## Non-goals

- Photorealistic human rendering.
- Importing or generating a GLB/FBX asset.
- Changing the authenticated application dashboards in this iteration.
- Backend, database, API, or authentication-flow changes.
- Scroll hijacking or a long marketing site.
