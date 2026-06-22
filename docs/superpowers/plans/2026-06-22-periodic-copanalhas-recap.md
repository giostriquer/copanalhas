# Periodic Copanalhas Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `Copanalhas Recap` from a single live dashboard into durable generated recap posts for completed tournament periods.

**Architecture:** Add a pure recap-period module that defines group-stage periods and filters matches/results/predictions by period. Change storage from one chaos dashboard post per channel to one recap post per `(guild, channel, period_key)`. Reuse the existing image/message rendering path, but call it once per completed due period from startup, result sync, manual result entry, reset, and the operator command.

**Tech Stack:** TypeScript, Vitest, node:sqlite, discord.js edge adapter, sharp PNG rendering.

---

### Task 1: Period Model

**Files:**
- Create: `src/chaos-dashboard/periods.ts`
- Test: `src/chaos-dashboard/periods.test.ts`

- [ ] Write tests for `group-week-1`, `group-week-2`, and `group-week-3` match ranges.
- [ ] Write tests that a period is complete only when every period match has a result.
- [ ] Implement pure helpers: `listRecapPeriods`, `completedRecapPeriods`, `matchesForRecapPeriod`, and `filterRowsForRecapPeriod`.

### Task 2: Period-Scoped Dashboard Posting

**Files:**
- Modify: `src/app/chaos-dashboard-posting.ts`
- Test: `src/app/chaos-dashboard-posting.test.ts`
- Modify: `src/chaos-dashboard/stats.ts`
- Test: `src/chaos-dashboard/stats.test.ts`

- [ ] Write failing tests that only completed periods are posted.
- [ ] Write failing tests that period stats include only period matches.
- [ ] Replace single-dashboard update flow with `updateChaosRecaps`, returning posted/edited/skipped period details.
- [ ] Keep rendering fallback behavior for each period independently.

### Task 3: Storage

**Files:**
- Modify: `src/storage/database.ts`
- Test: `src/storage/database.test.ts`

- [ ] Write failing tests for one stored recap post per period key.
- [ ] Add `period_key` to the stored recap post model and persistence queries.
- [ ] Preserve existing databases by migrating `chaos_dashboard_posts` with a default legacy period key if needed.

### Task 4: Runtime And Commands

**Files:**
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/dev-log.ts`
- Modify: `src/app/operator-health.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/commands.ts`
- Tests: existing matching `*.test.ts` files

- [ ] Write failing tests for startup backfill and result-sync completion posting.
- [ ] Wire startup, result sync, manual result entry, reset, and `/copanalhas copanalhas-recap-painel` to update completed recap periods.
- [ ] Update logs and health to report period recap counts.

### Task 5: Docs And Verification

**Files:**
- Modify: `docs/discord-ingestion.md`
- Modify: `docs/superpowers/specs/2026-06-22-chaos-dashboard-design.md`
- Modify: `docs/superpowers/plans/2026-06-22-chaos-dashboard.md`

- [ ] Replace live-dashboard wording with durable recap-period wording.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Commit and push to `origin/main`.
