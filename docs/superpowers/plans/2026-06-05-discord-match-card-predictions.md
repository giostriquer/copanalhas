# Discord Match Card Predictions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Discord-native prediction flow where the bot posts daily match cards and users submit scores through a button-triggered modal.

**Architecture:** Component custom IDs carry match IDs, so users do not type match numbers. Core score parsing and card view models are pure modules with tests; Discord.js builders and interaction handlers stay at the edge and persist only parsed prediction records.

**Tech Stack:** Node v25, TypeScript 5.9, Vitest 4, discord.js 14.26.

---

## File Structure

- `src/predictions/score-parser.ts`: strict score-only parsing for modal input.
- `src/predictions/score-parser.test.ts`: score parser tests.
- `src/discord/components.ts`: component custom IDs, match-card view models, and Discord builders.
- `src/discord/components.test.ts`: component ID and card model tests.
- `src/discord/interactions.ts`: button/modal interaction orchestration against project-owned ports.
- `src/discord/interactions.test.ts`: modal storage/reply tests with fakes.
- `src/discord/ingestion.ts`: wire `InteractionCreate` into the new interaction handler.
- `src/index.ts`: add `post-matches-today` command with injectable poster.
- `src/index.test.ts`: CLI test for match-card posting.
- `docs/discord-ingestion.md`: document the new primary interaction flow.

## Tasks

### Task 1: Score Parser

**Files:**
- Create: `src/predictions/score-parser.test.ts`
- Create: `src/predictions/score-parser.ts`

- [ ] Write tests for `2x1`, `2 x 1`, `2-1`, whitespace, and invalid values.
- [ ] Run `npm test -- src/predictions/score-parser.test.ts`; expect missing module failure.
- [ ] Implement `parseScoreInput`.
- [ ] Run targeted tests and full suite.
- [ ] Commit `feat: parse modal score input`.

### Task 2: Components And Match Cards

**Files:**
- Create: `src/discord/components.test.ts`
- Create: `src/discord/components.ts`

- [ ] Write tests for predict button IDs, score modal IDs, and match card view text.
- [ ] Run targeted tests; expect missing module failure.
- [ ] Implement ID helpers and match card builder helpers.
- [ ] Run targeted tests, full suite, and build.
- [ ] Commit `feat: build match prediction components`.

### Task 3: Interaction Handler

**Files:**
- Create: `src/discord/interactions.test.ts`
- Create: `src/discord/interactions.ts`
- Modify: `src/discord/ingestion.ts`

- [ ] Write tests for button -> modal, modal -> stored prediction, invalid score -> private error.
- [ ] Run targeted tests; expect missing module failure.
- [ ] Implement project-owned interaction handler ports.
- [ ] Wire `Events.InteractionCreate` in `createDiscordClient`.
- [ ] Run targeted tests, full suite, and build.
- [ ] Commit `feat: handle prediction interactions`.

### Task 4: Post Matches Command

**Files:**
- Modify: `src/index.test.ts`
- Modify: `src/index.ts`
- Modify: `docs/discord-ingestion.md`

- [ ] Write test for `post-matches-today` posting one card per match date through an injected poster.
- [ ] Run targeted tests; expect command missing failure.
- [ ] Implement command and document the new primary flow.
- [ ] Run full verification.
- [ ] Commit `feat: post daily match cards`.

## Self-Review

- Spec coverage: the plan covers button/modal UX, score-only parsing, component IDs, interaction persistence, and daily card posting.
- Placeholder scan: all modules and commands have exact paths and expected behavior.
- Type consistency: match IDs remain `WorldCupMatch.id`; modal score parsing returns numeric home/away scores for existing storage records.
