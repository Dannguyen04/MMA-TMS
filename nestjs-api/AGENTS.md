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

## Agent roles

- Codex may design and implement production application code, migrations,
  infrastructure, and tests for this service.
- Delegation is optional and should be used only when it improves delivery or
  review quality; no specific external implementation agent is required.
- The implementing agent owns proportional unit, integration, contract, and
  security verification for each change.
- Preserve the mandatory handoff standard: summarize changes, expected
  behavior, edge cases, and verification results.



## Completion standard

A task is complete when the explicitly requested work is finished. Run only the
validation authorized by the user under `.agents/rules/testing-quality.md`; when
validation was not requested, state that it was not run.

## User Communication & Planning Preference

- Whenever the user asks for a plan, steps, phases, or uses terms like "phase" or "step", the agent MUST create/update an `implementation_plan.md` artifact file using the artifact writing tool so the user can easily review it in the UI.
