# Prediction Visibility And Timestamps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve match cards with native Discord timestamps and add prediction visibility commands that keep picks private before lock and reveal them publicly after lock.

**Architecture:** Keep formatting pure and tested in small modules. Discord component/card code should produce native `<t:...>` timestamps. Operator command handling should read stored predictions, format match-specific pick lists, and use an ephemeral response while predictions are still open.

**Tech Stack:** TypeScript, Vitest, discord.js 14.26.2, SQLite via `node:sqlite`.

---

### Task 1: Native Timestamp Match Cards

**Files:**
- Modify: `src/worldcup/cutoff.ts`
- Modify: `src/discord/components.test.ts`
- Modify: `src/discord/components.ts`

- [ ] Write failing tests expecting kickoff and prediction-close lines to use Discord timestamp tokens.
- [ ] Run `npm test -- src/discord/components.test.ts` and confirm the card test fails on the old literal date strings.
- [ ] Add a small timestamp formatter that emits `<t:unix:F>` and `<t:unix:R>` style tokens.
- [ ] Update match card copy to use native Discord timestamps.
- [ ] Re-run `npm test -- src/discord/components.test.ts`.

### Task 2: Prediction List Formatting

**Files:**
- Create: `src/predictions/visibility.ts`
- Create: `src/predictions/visibility.test.ts`

- [ ] Write failing tests for an open private prediction list, a closed public reveal list, and an empty prediction list.
- [ ] Run `npm test -- src/predictions/visibility.test.ts` and confirm missing module failure.
- [ ] Implement a pure formatter that accepts one match, stored predictions, current time, and display names.
- [ ] Re-run `npm test -- src/predictions/visibility.test.ts`.

### Task 3: Operator Commands

**Files:**
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`
- Modify: `src/app/bot-runtime.ts`

- [ ] Write failing tests for `/copanalhas predictions` returning ephemeral prediction details and `/copanalhas reveal` refusing public reveal before lock.
- [ ] Run `npm test -- src/discord/operator-commands.test.ts`.
- [ ] Register `predictions` and `reveal` subcommands with a required `match` string option.
- [ ] Wire command handling to stored predictions and current match cutoff status.
- [ ] Re-run `npm test -- src/discord/operator-commands.test.ts`.

### Task 4: Docs And Smoke

**Files:**
- Modify: `docs/discord-ingestion.md`
- Modify: `README.md`

- [ ] Document the private prediction audit command and public locked reveal command.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run a local command smoke where possible, then describe the Discord manual smoke path.
