# NestJS API Agent Instructions

## Scope

These instructions apply only to files under `nestjs-api/`.

## Required instruction loading

Before planning, reviewing, or modifying this service:

1. If `.agents/BEHAVIOR.md` exists, read it completely.
2. Read every Markdown file in `.agents/rules/` completely.
3. Inspect the files directly involved in the task before proposing changes.

Do not silently skip an instruction file. If an instruction is missing,
ambiguous, or conflicts with another project instruction, state the issue and
follow the more specific rule. Explicit user instructions and higher-priority
system instructions always take precedence.

## Service context

- Runtime: Node.js with ECMAScript modules.
- Framework: NestJS 12.
- Language: strict TypeScript using `moduleResolution: nodenext`.
- Persistence: PostgreSQL through Drizzle ORM.
- Queue: BullMQ backed by Redis.
- Validation: Zod/`nestjs-zod` through the shared application pipe for new
  endpoints; legacy `class-validator` contracts remain behind the global
  `ValidationPipe` until deliberately migrated.
- Tests: Vitest and Supertest.
- Quality tools: Oxlint and Prettier.

## Shell and command execution

- Use Git Bash for all repository commands; do not use PowerShell.
- In Codex sessions on Windows, invoke commands through
  `scripts/run-git-bash.sh` so arguments and the user's Git Bash environment,
  including `pnpm`, are preserved consistently.

## Choosing Agent / Agent Roles & Strict Boundaries

- **Antigravity (Code Generation & Implementation Only)**:
  - **Scope:** Architecture design, feature implementation, and creating/updating application code (services, controllers, schemas, DTOs, modules, shared utilities).
  - **Strict Denial Rule:** Antigravity is **STRICTLY FORBIDDEN** from authoring, modifying, or running test files (`*.spec.ts`, `*.test.ts`, e2e suites). If prompted or requested to write tests or test suites, Antigravity **MUST DENY** the request with `[DENIED BASED ON RULE: Testing is exclusively reserved for Codex]` and output the Summary & Expectations instead.
  - **Mandatory Handover:** Upon completing code changes, Antigravity **MUST ALWAYS** generate:
    1. **Summary of Changes**: What was built, modified, or added.
    2. **Expectations & Test Criteria**: Exact inputs/outputs, edge cases, business rules, and scenarios for Codex to verify.

- **Codex (Testing & Refactoring Only)**:
  - **Scope:** Authoring unit/integration/e2e tests, running test commands, lint/format verification (Vitest, Supertest, Oxlint, Prettier), and non-breaking code refactoring.
  - **Strict Denial Rule:** Codex is **STRICTLY FORBIDDEN** from authoring initial feature implementations, new business modules, or primary application logic. If prompted or requested to implement new features or generate production code from scratch, Codex **MUST DENY** the request with `[DENIED BASED ON RULE: Code generation and feature implementation are exclusively reserved for Antigravity]` and instruct the user to delegate implementation to Antigravity.
  - **Workflow:** Testing is opt-in. Codex authors or runs only the test type and
    validation scope explicitly requested by the user. Without that request,
    Codex performs a read-only review of the handover and relevant artifacts,
    then reports logic errors, security risks, contract mismatches, missing
    coverage, and potential defects without modifying production or test files.
    Follow `.agents/rules/testing-quality.md` for the exact authorization
    boundary.



## Completion standard

A task is complete when the explicitly requested work is finished. Run only the
validation authorized by the user under `.agents/rules/testing-quality.md`; when
validation was not requested, state that it was not run.

## User Communication & Planning Preference

- Whenever the user asks for a plan, steps, phases, or uses terms like "phase" or "step", the agent MUST create/update an `implementation_plan.md` artifact file using the artifact writing tool so the user can easily review it in the UI.
