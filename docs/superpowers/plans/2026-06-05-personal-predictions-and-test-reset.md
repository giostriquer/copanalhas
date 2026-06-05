# Personal Predictions And Test Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add day-scoped personal prediction views, match autocomplete, condensed save summaries, and a test reset command that clears prediction/result residue for one date.

**Architecture:** Keep member-facing views private and date-scoped. Add formatting helpers for user predictions and match autocomplete choices, then wire them through slash commands, interaction replies, runtime store methods, and Discord ingestion routing. Test reset clears posted cards, predictions, and results for matches on one date, then refreshes standings.

**Tech Stack:** TypeScript, Vitest, discord.js 14.26.2, SQLite.

---

### Task 1: Personal Prediction Formatting

**Files:**
- Create: `src/predictions/personal-summary.ts`
- Create: `src/predictions/personal-summary.test.ts`

- [x] Write failing tests for a day-scoped `formatUserPredictionSummary` that lists only matches on the requested date for one user.
- [x] Implement the summary so missing picks show `sem palpite`, saved picks show `2x1`, and the output stays compact.
- [x] Verify with `npm test -- src/predictions/personal-summary.test.ts`.

### Task 2: Condensed Save Reply

**Files:**
- Modify: `src/discord/interactions.ts`
- Modify: `src/discord/interactions.test.ts`

- [x] Write a failing modal-submit test expecting the private reply to include the full day summary after saving.
- [x] Update modal handling to build the summary from all predictions plus the newly accepted prediction.
- [x] Verify with `npm test -- src/discord/interactions.test.ts src/predictions/personal-summary.test.ts`.

### Task 3: Operator Commands And Autocomplete

**Files:**
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/commands.test.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`
- Modify: `src/discord/ingestion.ts`
- Modify: `src/discord/ingestion.test.ts`

- [x] Write failing tests for `/copanalhas meus-palpites` using today's configured local date by default and an optional date for testing.
- [x] Write failing tests for match autocomplete choices on `predictions`, `reveal`, and `result`.
- [x] Implement `meus-palpites` and autocomplete routing with at most 25 choices.
- [x] Verify focused Discord command tests.

### Task 4: Test Date Reset

**Files:**
- Modify: `src/storage/database.ts`
- Modify: `src/storage/database.test.ts`
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/commands.test.ts`

- [x] Write failing storage tests for clearing predictions and results by match IDs.
- [x] Write failing operator tests for `/copanalhas reset-test-date date:2026-06-11`.
- [x] Implement reset using match IDs for the requested date, clear posted card rows, predictions, and results, then refresh standings.
- [x] Verify focused storage/operator/runtime tests.

### Task 5: Docs And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/discord-ingestion.md`

- [x] Document `meus-palpites`, match autocomplete, and `reset-test-date`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Smoke preview the summary and autocomplete output from built files without posting to Discord.
- [x] Commit and push `main`.
