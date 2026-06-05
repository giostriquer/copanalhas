# Autopilot V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a manually started Copanalhas bot catch up missing same-day work and expose enough status to trust the automation while it is running.

**Architecture:** Keep automation decisions in pure app modules and expose runtime state through a small status snapshot. The Discord command handler formats that snapshot without owning scheduler state. Existing SQLite dedupe and result provenance remain the durable source for posted cards, predictions, results, and standings posts.

**Tech Stack:** TypeScript, Vitest, discord.js 14, SQLite, existing football-data result sync port.

---

## Task 1: Startup Auto-Post Catch-Up

**Files:**
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`

- [x] Write a failing runtime test that starts the bot at `2026-06-11T12:00:00.000Z` with auto-post enabled at `09:00` and expects `sendMatchCard` to be called once before waiting for the one-minute scheduler interval.
- [x] Run `npm test -- src/app/bot-runtime.test.ts` and verify the new test fails because startup only registers intervals.
- [x] Implement startup catch-up by invoking the same auto-post tick once after Discord startup and standings refresh.
- [x] Keep interval auto-post behavior unchanged and update `lastAutoPostDate` when startup catch-up posts or skips the date.
- [x] Run `npm test -- src/app/bot-runtime.test.ts` and verify it passes.

## Task 2: Startup Result Catch-Up

**Files:**
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`

- [x] Write a failing runtime test with result sync enabled that expects `syncFinishedResults` to run once during startup.
- [x] Assert startup result sync uses a lookback window ending on the current local date so bot-off periods can catch late results.
- [x] Run `npm test -- src/app/bot-runtime.test.ts` and verify the test fails because result sync currently only runs on the interval callback.
- [x] Extract a reusable runtime result-sync helper and call it once at startup plus on the existing fifteen-minute interval.
- [x] Refresh standings only when the sync stores at least one new result.
- [x] Run `npm test -- src/app/bot-runtime.test.ts` and verify it passes.

## Task 3: Rich Runtime Status

**Files:**
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`

- [x] Write a failing operator-command test expecting `/copanalhas status` to include today, auto-post state, posted/unposted today, open/closed prediction windows, last auto-post action, and last result-sync action.
- [x] Run `npm test -- src/discord/operator-commands.test.ts` and verify it fails because status only reports match count, missing kickoff times, result sync, and standings posts.
- [x] Add a `getRuntimeStatus()` port to `OperatorCommandOptions`.
- [x] Store the latest auto-post and result-sync outcomes in `startCopanalhasBotRuntime`.
- [x] Format status compactly in `handleOperatorCommand("status")` using the runtime snapshot plus existing standings post data.
- [x] Run `npm test -- src/app/bot-runtime.test.ts src/discord/operator-commands.test.ts` and verify it passes.

## Task 4: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/discord-ingestion.md`

- [x] Document startup catch-up, result sync catch-up, and the richer status command.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run a built smoke preview for the status formatter without posting to Discord.
- [x] Commit and push `main`.

---

## Self-Review

- Scope: This plan covers only the first three self-driving behaviors approved by the user.
- Boundaries: It does not add reminders, deployment, external schedulers, or new provider choices.
- Testability: Startup catch-up, result catch-up, and status output are covered through fakeable runtime ports and pure command tests.
