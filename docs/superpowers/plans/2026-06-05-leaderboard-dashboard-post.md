# Leaderboard Dashboard Post Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a third persistent Discord dashboard post for the public Copanalhas player leaderboard, edited in place after match results change.

**Architecture:** Mirror the standings dashboard pattern: pure leaderboard message formatting, SQLite storage for the Discord message ID, an app-level updater, and a Discord adapter that edits existing messages or posts replacements. Runtime composition updates the leaderboard on startup, after automatic result sync stores finals, after manual result entry, and after test-date reset.

**Tech Stack:** TypeScript, Vitest, discord.js 14, SQLite.

---

## Task 1: Leaderboard Message Formatting

**Files:**
- Modify: `src/leaderboard/format.ts`
- Modify: `src/leaderboard/format.test.ts`

- [x] Write failing tests for `createLeaderboardDashboardMessage`, including the empty state and ranked rows.
- [x] Implement a public dashboard message with content-only output and `embeds: []`.
- [x] Keep existing private `formatLeaderboard` behavior intact.
- [x] Verify with `npm test -- src/leaderboard/format.test.ts`.

## Task 2: Leaderboard Post Storage

**Files:**
- Modify: `src/storage/database.ts`
- Modify: `src/storage/database.test.ts`

- [x] Write failing tests for `recordLeaderboardPost` and `listLeaderboardPosts`.
- [x] Add a `leaderboard_posts` table scoped by guild and channel.
- [x] Implement list/upsert methods and store created/updated timestamps.
- [x] Verify with `npm test -- src/storage/database.test.ts`.

## Task 3: App And Discord Updaters

**Files:**
- Create: `src/app/leaderboard-posting.ts`
- Create: `src/app/leaderboard-posting.test.ts`
- Create: `src/discord/leaderboard-posting.ts`
- Create: `src/discord/leaderboard-posting.test.ts`

- [x] Write failing app-level updater tests for posting, editing, and replacement recording.
- [x] Write failing Discord adapter tests for edit existing, send replacement, and send new.
- [x] Implement `updateLeaderboardDashboard` using stored predictions/results and the pure formatter.
- [x] Implement `upsertDiscordLeaderboardMessage` by mirroring the standings adapter.
- [x] Verify focused app/Discord updater tests.

## Task 4: Runtime And Commands

**Files:**
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [x] Add runtime store and dependency ports for leaderboard posts.
- [x] Update leaderboard on startup.
- [x] Update leaderboard after automatic result sync stores results.
- [x] Update leaderboard after `/copanalhas result`.
- [x] Update leaderboard after `/copanalhas reset-test-date`.
- [x] Include leaderboard post health in `/copanalhas status`.
- [x] Wire the default Discord leaderboard adapter in `index.ts`.
- [x] Verify focused runtime/operator/index tests.

## Task 5: Docs And Full Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/discord-ingestion.md`

- [x] Document the third persistent dashboard post and update triggers.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Run a built smoke preview for the leaderboard dashboard formatter.
- [x] Commit and push `main`.

---

## Self-Review

- Scope: This plan adds the third persistent dashboard post only; no reminders, deployment, or extra Discord channels.
- Boundaries: Formatting, storage, app orchestration, Discord adapter, and runtime composition stay separated.
- Update triggers: Startup, automatic result sync, manual result entry, and test-date reset are covered.
