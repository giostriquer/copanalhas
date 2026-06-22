# Painel do Caos Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a permanent generated PNG Discord dashboard called `Painel do Caos` with people and match chaos stats, weekly movement, operator refresh, status, tests, and runtime hooks.

**Architecture:** Add a pure `src/chaos-dashboard` feature module that builds a presentation model from predictions, results, scoring output, leaderboard rows, display names, and weekly snapshots. Add storage for one dashboard post and week-start leaderboard snapshots, then wire an app updater, Discord adapter, command, logs, health, startup, prediction, and result-sync refreshes around that pure core.

**Tech Stack:** TypeScript, Vitest, Node SQLite `DatabaseSync`, Discord.js message payloads, deterministic SVG-to-PNG rendering through `sharp`.

---

## File Structure

- Create `src/chaos-dashboard/types.ts` for presentation types shared by stats, formatting, SVG, app, and Discord adapters.
- Create `src/chaos-dashboard/stats.ts` for pure stat calculations and week-baseline helpers.
- Create `src/chaos-dashboard/stats.test.ts` for people stats, match stats, weekly movement, empty states, and thresholds.
- Create `src/chaos-dashboard/format.ts` for Discord fallback content and attachment shape.
- Create `src/chaos-dashboard/format.test.ts` for fallback text and attachment behavior.
- Create `src/chaos-dashboard/svg.ts` for deterministic SVG rendering.
- Create `src/chaos-dashboard/svg.test.ts` for visible title, labels, awards, match stats, footer, and empty states.
- Create `src/chaos-dashboard/png.ts` for SVG-to-PNG rendering with `sharp`.
- Create `src/chaos-dashboard/png.test.ts` for a non-empty PNG smoke test.
- Create `src/app/chaos-dashboard-posting.ts` for data loading, model building, rendering, fallback handling, weekly snapshot persistence, and message upsert.
- Create `src/app/chaos-dashboard-posting.test.ts` for post/edit/replace/fallback and snapshot behavior.
- Create `src/discord/chaos-dashboard-posting.ts` for Discord post/edit/replace with attachments.
- Create `src/discord/chaos-dashboard-posting.test.ts` for payload mapping and replacement behavior.
- Modify `src/storage/database.ts` to add `chaos_dashboard_posts` and `chaos_weekly_snapshots`.
- Modify `src/storage/database.test.ts` for post and weekly snapshot persistence.
- Modify `src/app/dev-log.ts` and `src/app/dev-log.test.ts` for `[dashboard] chaos ...` logs.
- Modify `src/app/operator-health.ts` and `src/app/operator-health.test.ts` for chaos dashboard status.
- Modify `src/discord/commands.ts` and `src/discord/commands.test.ts` for `/copanalhas copanalhas-recap-painel`.
- Modify `src/discord/operator-commands.ts` and `src/discord/operator-commands.test.ts` for command routing, status, reset/manual-result/result-sync dashboard refreshes.
- Modify `src/app/bot-runtime.ts` and `src/app/bot-runtime.test.ts` for startup, prediction, and result-sync refresh hooks with render failure isolation.
- Modify `src/index.ts` so the production bot passes the Discord chaos updater and PNG renderer.

---

### Task 1: Pure Chaos Stats Model

**Files:**
- Create: `src/chaos-dashboard/types.ts`
- Create: `src/chaos-dashboard/stats.ts`
- Test: `src/chaos-dashboard/stats.test.ts`

- [ ] **Step 1: Write failing stats tests**

Use tests with a tiny fixture: three matches, three users, two final results, and one unfinished match. Cover:

```ts
import { describe, expect, test } from "vitest";
import { buildChaosDashboardModel, weekStartKey } from "./stats.js";

test("builds people awards, match chaos, and top rows from scored results", () => {
  const model = buildChaosDashboardModel({
    matches: fixtureMatches,
    predictions: fixturePredictions,
    results: fixtureResults,
    displayNames: new Map([
      ["user-a", "Guibexa"],
      ["user-b", "SEVERAO DO HEXA"],
      ["user-c", "Anghexa"]
    ]),
    previousWeekRows: [],
    now: new Date("2026-06-24T15:30:00.000Z"),
    timeZone: "America/Sao_Paulo"
  });

  expect(model.title).toBe("Painel do Caos");
  expect(model.week.label).toBe("2026-06-22..2026-06-28");
  expect(model.totals.scoredMatches).toBe(2);
  expect(model.totals.predictions).toBe(8);
  expect(model.leaderboardTop[0]).toMatchObject({
    userId: "user-a",
    displayName: "Guibexa",
    points: 5,
    soloCount: 1
  });
  expect(model.peopleAwards.map((award) => award.key)).toContain("profeta-isolado");
  expect(model.matchAwards.map((award) => award.key)).toContain("consenso-burro");
});

test("uses a Monday calendar week in the configured local timezone", () => {
  expect(weekStartKey(new Date("2026-06-22T03:00:00.000Z"), "America/Sao_Paulo")).toBe(
    "2026-06-22"
  );
  expect(weekStartKey(new Date("2026-06-22T02:59:59.000Z"), "America/Sao_Paulo")).toBe(
    "2026-06-15"
  );
});

test("renders no-history weekly movement when no baseline exists", () => {
  const model = buildChaosDashboardModel({
    matches: fixtureMatches,
    predictions: fixturePredictions,
    results: fixtureResults,
    displayNames: new Map(),
    previousWeekRows: [],
    now: new Date("2026-06-24T15:30:00.000Z"),
    timeZone: "UTC"
  });

  expect(model.weeklyMovement.status).toBe("no-history");
});

test("computes weekly climbers and fallers from a baseline", () => {
  const model = buildChaosDashboardModel({
    matches: fixtureMatches,
    predictions: fixturePredictions,
    results: fixtureResults,
    displayNames: new Map(),
    previousWeekRows: [
      { userId: "user-a", rank: 3, points: 0, soloCount: 0, exactCount: 0, outcomeCount: 0, closestCount: 0 },
      { userId: "user-b", rank: 1, points: 3, soloCount: 0, exactCount: 1, outcomeCount: 0, closestCount: 0 },
      { userId: "user-c", rank: 2, points: 2, soloCount: 0, exactCount: 0, outcomeCount: 1, closestCount: 0 }
    ],
    now: new Date("2026-06-24T15:30:00.000Z"),
    timeZone: "UTC"
  });

  expect(model.weeklyMovement.status).toBe("ready");
  expect(model.weeklyMovement.climbers[0]).toMatchObject({ userId: "user-a", movement: 2 });
  expect(model.weeklyMovement.fallers[0]).toMatchObject({ userId: "user-b", movement: -1 });
});
```

- [ ] **Step 2: Run failing stats tests**

Run:

```bash
npm test -- src/chaos-dashboard/stats.test.ts
```

Expected: fail because `src/chaos-dashboard/stats.ts` does not exist yet.

- [ ] **Step 3: Implement types and stats**

Implement `types.ts` with:

```ts
export interface ChaosDashboardModel { ... }
export interface ChaosLeaderboardRow { ... }
export interface ChaosWeeklySnapshotRow { ... }
export interface ChaosPeopleAward { key: string; title: string; subject: string; value: string; subtitle: string; }
export interface ChaosMatchAward { key: string; title: string; matchLabel: string; value: string; subtitle: string; }
```

Implement `stats.ts` by reusing `scoreMatch` and `buildLeaderboard` from `src/scoring/scoring.ts`. Do not duplicate official point logic. Include:

```ts
export function buildChaosDashboardModel(options: BuildChaosDashboardModelOptions): ChaosDashboardModel;
export function weekStartKey(date: Date, timeZone: string): string;
export function createWeeklySnapshotRows(rows: readonly LeaderboardRow[]): ChaosWeeklySnapshotRow[];
```

Use deterministic sorting. Negative awards must require at least five finished predictions. Empty states must return a valid model.

- [ ] **Step 4: Run stats tests until they pass**

Run:

```bash
npm test -- src/chaos-dashboard/stats.test.ts
```

Expected: all tests pass.

---

### Task 2: Chaos Dashboard Formatting And Rendering

**Files:**
- Create: `src/chaos-dashboard/format.ts`
- Create: `src/chaos-dashboard/format.test.ts`
- Create: `src/chaos-dashboard/svg.ts`
- Create: `src/chaos-dashboard/svg.test.ts`
- Create: `src/chaos-dashboard/png.ts`
- Create: `src/chaos-dashboard/png.test.ts`

- [ ] **Step 1: Write failing formatting and rendering tests**

Cover:

```ts
expect(createChaosDashboardMessage(model, Buffer.from("png")).files).toEqual([
  { attachment: Buffer.from("png"), name: "copanalhas-painel-do-caos.png" }
]);
expect(createChaosDashboardMessage(model, null).content).toContain("Painel do Caos");
expect(createChaosDashboardMessage(model, null).content).toContain("Zoeira estatistica");
expect(renderChaosDashboardSvg(model)).toContain("Painel do Caos");
expect(renderChaosDashboardSvg(model)).toContain("Premios da Zoacao");
expect(renderChaosDashboardSvg(model)).toContain("Caos dos Jogos");
expect(await renderChaosDashboardPng(renderChaosDashboardSvg(model))).toSatisfy(
  (buffer: Buffer) => buffer.length > 100
);
```

- [ ] **Step 2: Run failing render tests**

Run:

```bash
npm test -- src/chaos-dashboard/format.test.ts src/chaos-dashboard/svg.test.ts src/chaos-dashboard/png.test.ts
```

Expected: fail because formatter and renderer files do not exist.

- [ ] **Step 3: Implement formatter and SVG renderer**

Implement:

```ts
export const CHAOS_DASHBOARD_TITLE = "Painel do Caos";
export const CHAOS_ATTACHMENT_NAME = "copanalhas-painel-do-caos.png";
export interface ChaosDashboardMessage { content: string; embeds: []; files: Array<{ attachment: Buffer; name: string }>; }
export function createChaosDashboardMessage(model: ChaosDashboardModel, png: Buffer | null): ChaosDashboardMessage;
export function renderChaosDashboardSvg(model: ChaosDashboardModel): string;
export async function renderChaosDashboardPng(svg: string): Promise<Buffer>;
```

Use an SVG layout with header, left scoreboard/movement column, center people awards, right match awards, and footer. Escape all text and truncate long display names.

- [ ] **Step 4: Run render tests until they pass**

Run:

```bash
npm test -- src/chaos-dashboard/format.test.ts src/chaos-dashboard/svg.test.ts src/chaos-dashboard/png.test.ts
```

Expected: all tests pass.

---

### Task 3: Storage For Dashboard Post And Weekly Snapshots

**Files:**
- Modify: `src/storage/database.ts`
- Test: `src/storage/database.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add tests matching existing leaderboard/bracket post tests:

```ts
store.recordChaosDashboardPost({ guildId: "guild-1", channelId: "channel-1", messageId: "chaos-1", createdAt: "2026-06-22T12:00:00.000Z", updatedAt: "2026-06-22T12:00:00.000Z" });
store.recordChaosDashboardPost({ guildId: "guild-1", channelId: "channel-1", messageId: "chaos-2", createdAt: "2026-06-22T12:00:00.000Z", updatedAt: "2026-06-22T13:00:00.000Z" });
expect(store.listChaosDashboardPosts()).toEqual([{ guildId: "guild-1", channelId: "channel-1", messageId: "chaos-2", createdAt: "2026-06-22T12:00:00.000Z", updatedAt: "2026-06-22T13:00:00.000Z" }]);

store.recordChaosWeeklySnapshotRows("2026-06-22", "guild-1", "channel-1", rows, "2026-06-22T12:00:00.000Z");
expect(store.listChaosWeeklySnapshotRows("2026-06-22", "guild-1", "channel-1")).toHaveLength(rows.length);
```

- [ ] **Step 2: Run failing storage tests**

Run:

```bash
npm test -- src/storage/database.test.ts
```

Expected: fail because new methods and tables do not exist.

- [ ] **Step 3: Implement storage**

Add interfaces:

```ts
export interface StoredChaosDashboardPost { guildId: string; channelId: string; messageId: string; createdAt: string; updatedAt: string; }
export interface StoredChaosWeeklySnapshotRow { weekStart: string; guildId: string; channelId: string; userId: string; rank: number; points: number; soloCount: number; exactCount: number; outcomeCount: number; closestCount: number; createdAt: string; }
```

Add tables in `migrate()`:

```sql
CREATE TABLE IF NOT EXISTS chaos_dashboard_posts (... PRIMARY KEY (guild_id, channel_id)) STRICT;
CREATE TABLE IF NOT EXISTS chaos_weekly_snapshots (... PRIMARY KEY (week_start, guild_id, channel_id, user_id)) STRICT;
```

Add methods:

```ts
recordChaosDashboardPost(post: StoredChaosDashboardPost): void;
listChaosDashboardPosts(): StoredChaosDashboardPost[];
recordChaosWeeklySnapshotRows(weekStart: string, guildId: string, channelId: string, rows: readonly ChaosWeeklySnapshotRow[], createdAt: string): void;
listChaosWeeklySnapshotRows(weekStart: string, guildId: string, channelId: string): StoredChaosWeeklySnapshotRow[];
```

- [ ] **Step 4: Run storage tests until they pass**

Run:

```bash
npm test -- src/storage/database.test.ts
```

Expected: all tests pass.

---

### Task 4: App Updater And Discord Adapter

**Files:**
- Create: `src/app/chaos-dashboard-posting.ts`
- Create: `src/app/chaos-dashboard-posting.test.ts`
- Create: `src/discord/chaos-dashboard-posting.ts`
- Create: `src/discord/chaos-dashboard-posting.test.ts`

- [ ] **Step 1: Write failing app and Discord adapter tests**

Cover post, edit, replace, render fallback, weekly baseline creation, and payload attachments:

```ts
const result = await updateChaosDashboard({ ...options, listChaosDashboardPosts: () => [], upsertChaosDashboardMessage: vi.fn(async () => "chaos-message-1") });
expect(result.post.action).toBe("posted");
expect(recordChaosDashboardPost).toHaveBeenCalledWith(expect.objectContaining({ messageId: "chaos-message-1" }));
expect(recordChaosWeeklySnapshotRows).toHaveBeenCalled();

renderPng.mockRejectedValueOnce(new Error("sharp exploded"));
expect((await updateChaosDashboard(options)).renderState).toBe("text-fallback");
```

Discord adapter tests should mirror bracket adapter tests and assert `files` survives both edit and replacement paths.

- [ ] **Step 2: Run failing app/Discord tests**

Run:

```bash
npm test -- src/app/chaos-dashboard-posting.test.ts src/discord/chaos-dashboard-posting.test.ts
```

Expected: fail because modules do not exist.

- [ ] **Step 3: Implement updater and adapter**

Implement app updater:

```ts
export interface UpdateChaosDashboardOptions { ... }
export interface UpdateChaosDashboardResult { action: "updated"; post: UpdatedChaosDashboardPost; weekStart: string; renderState: "image" | "text-fallback"; renderError?: string; }
export async function updateChaosDashboard(options: UpdateChaosDashboardOptions): Promise<UpdateChaosDashboardResult>;
```

Implementation flow: score predictions, build leaderboard, load/create weekly baseline, build model, render SVG/PNG, fallback to text on render errors, upsert message, record post.

Implement Discord adapter:

```ts
export async function upsertDiscordChaosDashboardMessage(config: CopanalhasConfig, message: ChaosDashboardMessage, existingMessageId: string | null): Promise<string>;
export async function upsertDiscordChaosDashboardMessageWithClient(...): Promise<string>;
```

- [ ] **Step 4: Run app/Discord tests until they pass**

Run:

```bash
npm test -- src/app/chaos-dashboard-posting.test.ts src/discord/chaos-dashboard-posting.test.ts
```

Expected: all tests pass.

---

### Task 5: Runtime, Commands, Status, Logs, And CLI Wiring

**Files:**
- Modify: `src/app/dev-log.ts`
- Test: `src/app/dev-log.test.ts`
- Modify: `src/app/operator-health.ts`
- Test: `src/app/operator-health.test.ts`
- Modify: `src/discord/commands.ts`
- Test: `src/discord/commands.test.ts`
- Modify: `src/discord/operator-commands.ts`
- Test: `src/discord/operator-commands.test.ts`
- Modify: `src/app/bot-runtime.ts`
- Test: `src/app/bot-runtime.test.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing integration tests**

Add expectations:

```ts
expect(formatChaosDashboardLog({ action: "updated", post: { action: "posted", messageId: "chaos-1" }, weekStart: "2026-06-22", renderState: "image" })).toBe("[dashboard] chaos action=posted message=chaos-1 week=2026-06-22 render=image");
expect(createCopanalhasCommand().toJSON()).toContainSubcommand("copanalhas-recap-painel");
expect(await handleOperatorCommand(command("copanalhas-recap-painel"), options)).toMatchObject({ action: "replied", content: "Updated chaos dashboard: edited (image)." });
expect(statusReply.content).toContain("Chaos dashboard: present");
expect(upsertChaosDashboardMessage).toHaveBeenCalledAfterResultSync();
```

- [ ] **Step 2: Run failing integration tests**

Run:

```bash
npm test -- src/app/dev-log.test.ts src/app/operator-health.test.ts src/discord/commands.test.ts src/discord/operator-commands.test.ts src/app/bot-runtime.test.ts
```

Expected: fail because runtime and command wiring is missing.

- [ ] **Step 3: Wire the feature**

Add:

- `formatChaosDashboardLog()` in `src/app/dev-log.ts`.
- `chaosDashboardPost` status in `OperatorHealthSnapshot`, report lines, and log lines.
- `copanalhas-recap-painel` subcommand in `src/discord/commands.ts`.
- `copanalhas-recap-painel` in `OperatorSubcommand`, parsing, handling, status fallback, manual result refresh, reset refresh, and sync-results refresh in `src/discord/operator-commands.ts`.
- `listChaosDashboardPosts`, `recordChaosDashboardPost`, `listChaosWeeklySnapshotRows`, and `recordChaosWeeklySnapshotRows` to `BotRuntimeStore`.
- `upsertChaosDashboardMessage` and `renderChaosDashboardPng` optional dependencies in `StartCopanalhasBotRuntimeOptions`.
- startup refresh, prediction refresh, and result-sync refresh in `src/app/bot-runtime.ts`.
- isolated runtime failure logging with scope `chaos-dashboard`.
- production wiring in `src/index.ts`.

- [ ] **Step 4: Run integration tests until they pass**

Run:

```bash
npm test -- src/app/dev-log.test.ts src/app/operator-health.test.ts src/discord/commands.test.ts src/discord/operator-commands.test.ts src/app/bot-runtime.test.ts
```

Expected: all tests pass.

---

### Task 6: Full Verification And Release Commit

**Files:**
- All files touched above.

- [ ] **Step 1: Run targeted feature tests**

Run:

```bash
npm test -- src/chaos-dashboard src/app/chaos-dashboard-posting.test.ts src/discord/chaos-dashboard-posting.test.ts src/storage/database.test.ts src/app/bot-runtime.test.ts src/discord/operator-commands.test.ts
```

Expected: all targeted tests pass.

- [ ] **Step 2: Run full test suite**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: TypeScript build succeeds.

- [ ] **Step 4: Inspect diff**

Run:

```bash
git status --short
git diff --stat
```

Expected: only chaos dashboard implementation, plan/spec docs, and required wiring files are changed.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add -- docs/superpowers/plans/2026-06-22-chaos-dashboard.md src
git commit -m "feat: add chaos dashboard"
git push origin main
```

Expected: `origin/main` receives the design, plan, and working implementation.
