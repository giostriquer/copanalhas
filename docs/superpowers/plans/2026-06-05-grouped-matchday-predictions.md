# Grouped Matchday Predictions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Post one Discord prediction message per matchday instead of one message per match, while preserving match-specific buttons and per-match dedupe records.

**Architecture:** Add a grouped matchday message builder that renders all matches for a date in one content body and one button per match. Posting orchestration sends the grouped message once for all due matches, then records the returned Discord message id for each match so existing storage and dedupe remain match-aware.

**Tech Stack:** TypeScript, Vitest, discord.js 14.26.2.

---

### Task 1: Grouped Message Builder

**Files:**
- Modify: `src/discord/components.ts`
- Modify: `src/discord/components.test.ts`

- [x] Write failing tests for `createMatchDayMessage` with two matches and two match-specific buttons.
- [x] Implement grouped content with pt-BR team display names and native Discord timestamps.
- [x] Keep `createMatchCardMessage` as a compatibility wrapper for single-match usage.

### Task 2: Grouped Posting And Dedupe

**Files:**
- Modify: `src/app/match-card-posting.ts`
- Modify: `src/app/match-card-posting.test.ts`
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [x] Write failing tests that one due matchday sends one message and records each included match with the same message id.
- [x] Update runtime posting to send one grouped message for due unposted matches.
- [x] Update the terminal `post-matches-today` command to send one grouped message for the selected date.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/discord-ingestion.md`

- [x] Document that prediction cards are grouped per matchday.
- [x] Run focused tests, full tests, build, and a local smoke preview.
