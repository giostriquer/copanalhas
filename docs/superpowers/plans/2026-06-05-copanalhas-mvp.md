# Copanalhas MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local TypeScript MVP that parses Discord predictions, scores World Cup matches, stores state in SQLite, and exposes leaderboard output while stopping before live Discord credentials are required.

**Architecture:** Keep Discord SDK objects at the edge. Core modules accept project-owned records, with pure parser/scoring modules tested independently, Node `node:sqlite` persistence behind a repository layer, and Discord ingestion filtering to one configured guild/channel before parsing.

**Tech Stack:** Node v25, TypeScript 5.9, Vitest 4, discord.js 14.26, built-in `node:sqlite`.

---

## File Structure

- `package.json`: scripts and dependencies.
- `tsconfig.json`: strict ESM TypeScript config.
- `vitest.config.ts`: Node test runner config.
- `src/predictions/parser.ts`: parse message text into prediction commands.
- `src/predictions/parser.test.ts`: parser behavior tests.
- `src/scoring/scoring.ts`: pure match scoring and leaderboard functions.
- `src/scoring/scoring.test.ts`: exact/closest/tie scoring tests.
- `src/worldcup/types.ts`: tournament data types.
- `src/worldcup/seed.ts`: reviewed hardcoded seed matches with source metadata.
- `src/worldcup/validate.ts`: seed validation helpers.
- `src/storage/database.ts`: SQLite schema and repository operations.
- `src/storage/database.test.ts`: in-memory SQLite tests.
- `src/discord/config.ts`: environment parsing for Discord and storage config.
- `src/discord/ingestion.ts`: guild/channel filtering and parser handoff.
- `src/discord/ingestion.test.ts`: Discord-edge filtering tests without live Discord.
- `src/leaderboard/format.ts`: text leaderboard rendering.
- `src/leaderboard/format.test.ts`: leaderboard output tests.
- `src/index.ts`: local CLI entrypoint.

## Tasks

### Task 1: Tooling Baseline

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Create: `src/index.ts`

- [ ] Install dependencies with `npm install`.
- [ ] Run `npm run build`; expected result is TypeScript success.
- [ ] Run `npm test`; expected result is Vitest success with no tests or passing smoke tests.
- [ ] Commit with `git commit -m "chore: add typescript tooling"`.

### Task 2: Prediction Parser

**Files:**
- Create: `src/predictions/parser.test.ts`
- Create: `src/predictions/parser.ts`

- [ ] Write tests for accepted formats: `MEX 2-1 POR`, `#1 MEX 2 x 1 POR`, and whitespace/case normalization.
- [ ] Write tests for rejected ambiguous messages, non-score chatter, and negative scores.
- [ ] Run parser tests and confirm they fail because the parser is missing.
- [ ] Implement parser result types and parsing logic.
- [ ] Run parser tests and full test suite.
- [ ] Commit with `git commit -m "feat: parse match predictions"`.

### Task 3: Scoring Engine

**Files:**
- Create: `src/scoring/scoring.test.ts`
- Create: `src/scoring/scoring.ts`

- [ ] Write tests for exact scoreline giving 3 points.
- [ ] Write tests for closest non-exact giving 1 point when no exact exists.
- [ ] Write tests for exact winners plus closest non-exact also receiving points.
- [ ] Write tests for tied closest predictions all receiving 1 point.
- [ ] Run scoring tests and confirm they fail because the scorer is missing.
- [ ] Implement pure scoring and leaderboard aggregation.
- [ ] Run scoring tests and full test suite.
- [ ] Commit with `git commit -m "feat: score predictions"`.

### Task 4: World Cup Seed Data

**Files:**
- Create: `src/worldcup/types.ts`
- Create: `src/worldcup/seed.ts`
- Create: `src/worldcup/validate.ts`
- Create: `src/worldcup/validate.test.ts`
- Modify: `docs/data-sources.md`

- [ ] Write validation tests for duplicate IDs, kickoff ISO strings, source metadata, and team placeholders.
- [ ] Run validation tests and confirm they fail because seed validation is missing.
- [ ] Add tournament types, a reviewed seed subset, and validation helpers.
- [ ] Document the seed source and limits in `docs/data-sources.md`.
- [ ] Run validation tests and full test suite.
- [ ] Commit with `git commit -m "feat: add world cup seed data"`.

### Task 5: SQLite Persistence

**Files:**
- Create: `src/storage/database.test.ts`
- Create: `src/storage/database.ts`

- [ ] Write in-memory SQLite tests for schema creation, match upsert, prediction upsert, result upsert, and scoring-run insert.
- [ ] Run storage tests and confirm they fail because storage is missing.
- [ ] Implement schema and repository functions using `node:sqlite` `DatabaseSync`.
- [ ] Run storage tests and full test suite.
- [ ] Commit with `git commit -m "feat: persist predictions and scores"`.

### Task 6: Discord Ingestion Edge

**Files:**
- Create: `src/discord/config.test.ts`
- Create: `src/discord/config.ts`
- Create: `src/discord/ingestion.test.ts`
- Create: `src/discord/ingestion.ts`
- Modify: `src/index.ts`

- [ ] Write config tests for missing token/guild/channel and valid env parsing.
- [ ] Write ingestion tests proving off-guild, off-channel, bot-authored, and empty-content messages are ignored before parsing.
- [ ] Run Discord edge tests and confirm they fail because the modules are missing.
- [ ] Implement config parsing and project-owned Discord message adapter types.
- [ ] Wire `discord.js` client creation behind the config boundary.
- [ ] Run Discord edge tests and full test suite.
- [ ] Commit with `git commit -m "feat: add discord ingestion edge"`.

### Task 7: Leaderboard Output

**Files:**
- Create: `src/leaderboard/format.test.ts`
- Create: `src/leaderboard/format.ts`
- Modify: `src/index.ts`

- [ ] Write tests for ranking, tied scores, no rows, and deterministic display names.
- [ ] Run leaderboard tests and confirm they fail because formatting is missing.
- [ ] Implement text leaderboard rendering.
- [ ] Add a local CLI path that can print a leaderboard from stored scoring output.
- [ ] Run leaderboard tests and full test suite.
- [ ] Commit with `git commit -m "feat: render leaderboard"`.

## Self-Review

- Spec coverage: the plan covers scaffold, tooling, parser, scoring, seed data, SQLite, Discord filtering, and leaderboard output.
- Placeholder scan: no task relies on unspecified code names or hidden future decisions.
- Type consistency: parser, scoring, storage, Discord, worldcup, and leaderboard modules are separated by the boundaries in `docs/architecture.md`.
