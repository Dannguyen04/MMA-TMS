# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Coach and fighter are equal primary users of this app. They share one bout: a single fight with a set weigh-in time and fight time.

The coach builds and runs the camp: bout, plan, sessions, medical checklist, official weigh-in, result, and suspension. The fighter uses the same bout on the phone: daily weight, schedule, and what the suspension allows. A doctor can create a manual suspension; a full doctor portal was not reopened after 24 Oct 2026. Admin, admissions, and club members are not primary users of this app.

## Product Purpose

MMA-TMS helps a coach and a fighter take one bout from acceptance through return-to-train: on weight, medical file complete, and not training while suspended.

Success for the course is a demo of that full bout lifecycle on the real backend, with a prepared demo data set. Final review is 10 Nov 2026. There is no demo on 31 Oct 2026, no written report, and no user-testing session. Dress rehearsal is 9 Nov 2026.

## Positioning

The bout is the unit of work. Two gates are the mechanism a generic gym schedule cannot copy. Gate 1 will not enter fight week until required medical items are provided or confirmed and still valid on fight day. Gate 2 will not schedule blocked session types during an active suspension. Creating a suspension immediately holds or cancels the sessions it blocks, and a KO, TKO, or medical suspension moves the running camp into rehab. After a KO or TKO, return to training is graded by intensity tier.

## Operating Context

Portrait phone app, used around a camp rather than at a desk. The interface language is Vietnamese. The graded demo runs against the real NestJS API and the team Supabase database, with fake data only. Developers may use the shared database in API mode; they do not apply migrations or run SQL. Migrations stay with the project owner.

The installed app name is MMA Vision (`reactnative-mobile/app.json`). The product and repository name is MMA-TMS.

## Capabilities and Constraints

Confirmed in decisions and tickets from 24 Oct 2026 through 31 Oct 2026:

- One active bout per fighter. The coach records the event, ruleset, weight class in kilograms, weigh-in, fight time, and opponent.
- Daily weight and an official weigh-in. The app compares the official weight with the limit; the coach confirms made weight, catchweight, or cancellation. The app does not prescribe diet or water-cutting.
- A nutrition plan entered by the coach or a specialist, plus one tap on the weigh-in screen for "ate according to plan?" Color marks the weight chart. Ticket T-009. If part A has not merged by 5 Nov 2026, part B3 is cut.
- Opponent analysis tied to the bout, including tactics linked to sessions.
- Session templates fill a new session. A six-week camp is not auto-generated from a template.
- Manual suspension, when no session types are chosen, blocks every type except recovery and physical therapy. The coach or doctor can still choose otherwise. Suspensions created before 27 Oct 2026 keep their old rules.
- Creating a suspension applies immediately. Fixed-end suspensions (`MANDATORY_REST`, `DQ`) move blocked sessions to "reschedule" (`PENDING`) and keep the original date. Clearance suspensions (`KO`, `TKO`, and usually `MEDICAL`) cancel those sessions. The app does not rewrite them into recovery or move their dates.
- `KO`, `TKO`, and `MEDICAL` move running plans in `fight_camp` or `taper` to `rehab`. The old phase is not restored when the suspension ends; the coach picks the next phase. The API still returns the previous phase.
- Five intensity tiers. A suspension can set a maximum level instead of ticking each session type. After `KO` or `TKO`, return is one tier at a time, at least one day per tier. A tier is a scheduling ceiling, not a medical order.
- The fighter has a suspension view (T-048, ready 30 Oct 2026, after T-030 B).
- Between-round plan and stored AI tactic suggestions exist on the backend (T-037, T-038). Live video advice was measured and is not feasible (T-039, 28 Oct 2026). New model research stays closed. The punch detector was not changed after the 24 Oct recall benchmark.
- Demo data is fake. Do not enter real medical documents or real identity papers.

Open, not decided in this interview:

- Whether doctor, admin, and admissions screens already in the app stay in future design scope. Decisions after 24 Oct did not reopen them.
- Whether this app or the responsive website is the phone channel for the 10 Nov demo. This file is the product record for the React Native app only.

## Brand Commitments

The on-device name is MMA Vision. Product copy is Vietnamese. No other voice, logo, or identity rule was made binding in this interview.

## Evidence on Hand

- Scope decisions 22–25 and the 30 Oct schedule change: `docs/SCOPE-FIGHT-CAMP.md`.
- Bout flows: `docs/FIGHT-CAMP-BUSINESS-FLOWS.md`.
- Mobile logic inventory (static, 28 Sep 2026, older than the decisions above): `docs/MOBILE-LOGIC-STATUS.md`.
- App manifest and display name: `reactnative-mobile/app.json`.
- No testimonials, pricing, licensing, or production-deployment claims. Do not invent them.

## Product Principles

1. One bout is the job. Plans, weight, files, video, and suspensions hang off that bout.
2. Coach and fighter are peers on that bout. A screen that only one of them can finish is incomplete if the other role owns a step.
3. Gates act immediately. An incomplete file or a new suspension changes what can be scheduled, without an extra confirm step.
4. The app records and checks. It does not call the fight, invent a diet, or present an intensity tier as a medical order.
5. Demo truth is fake data on the real API. Future work must not fabricate athletes, clinics, or results.
