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
- Validation: `class-validator` with a global `ValidationPipe`.
- Tests: Vitest and Supertest.
- Quality tools: Oxlint and Prettier.

## Completion standard

A change is complete only when the relevant validation described in
`.agents/rules/testing-quality.md` has been run, or the final response clearly
states why a check could not be run.

