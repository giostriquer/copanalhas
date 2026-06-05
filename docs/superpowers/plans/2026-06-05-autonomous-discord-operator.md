# Autonomous Discord Operator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the manually started bot into a Discord-first operator surface that auto-posts match cards while running, enforces prediction cutoffs, accepts operator slash commands, and optionally syncs final results from football-data.org.

**Architecture:** Keep game rules and orchestration in project-owned modules with fakeable ports. Discord.js remains an edge adapter for components, slash commands, and channel posting. SQLite owns durable state for matches, posted cards, predictions, result provenance, and scoring runs.

**Tech Stack:** Node v25, TypeScript 5.9, Vitest 4, discord.js 14.26, node:sqlite, optional football-data.org v4 HTTP API.

---

## Source References

- Design spec: `docs/superpowers/specs/2026-06-05-autonomous-discord-operator-design.md`
- Discord.js docs checked with Context7:
  - `SlashCommandBuilder`
  - `CommandInteractionOptionResolver.getSubcommand`
  - `CommandInteractionOptionResolver.getString`
  - `InteractionCreate` / `interaction.isChatInputCommand()`
  - guild command registration through command managers or REST routes
- football-data.org docs checked from official pages:
  - free tier coverage includes Worldcup
  - free registered clients are limited to 10 requests/minute
  - match resources include `utcDate`, `status`, `score.fullTime`
  - score fields can be `null` until known
  - `FINISHED` plus `score.fullTime` indicates final score

## File Structure

- `src/discord/config.ts`: parse new runtime, scheduler, timezone, and optional provider settings.
- `src/worldcup/types.ts`: add kickoff and provider metadata to `WorldCupMatch`.
- `src/worldcup/cutoff.ts`: pure kickoff/cutoff helpers.
- `src/discord/components.ts`: display kickoff and prediction-close text in match cards.
- `src/discord/interactions.ts`: enforce cutoff and missing-time rules before saving modal predictions.
- `src/storage/database.ts`: add posted card records and result provenance.
- `src/app/match-card-posting.ts`: reusable idempotent match-card posting orchestration.
- `src/app/scheduler.ts`: small fakeable interval/tick scheduler.
- `src/app/auto-posting.ts`: decides whether due matches should be posted on each scheduler tick.
- `src/discord/commands.ts`: slash command definition and registration helpers.
- `src/discord/operator-commands.ts`: pure operator command handling plus Discord adapter.
- `src/results/football-data.ts`: HTTP client and response parser for football-data.org.
- `src/results/sync.ts`: map provider matches to local matches and upsert final results.
- `src/app/bot-runtime.ts`: compose startup, scheduler, commands, interactions, and result sync.
- `src/index.ts`: route `bot` through `bot-runtime` while preserving terminal commands.
- `.env.example`: document new env vars.
- `docs/discord-ingestion.md`, `docs/data-sources.md`, `README.md`: document the new operator flow.

---

## Task 1: Runtime Config

**Files:**
- Modify: `src/discord/config.ts`
- Modify: `src/discord/config.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing config tests**

Add tests that expect defaults and optional provider settings:

```ts
test("uses autonomous runtime defaults", () => {
  expect(
    parseCopanalhasConfig({
      DISCORD_BOT_TOKEN: "token-value",
      DISCORD_GUILD_ID: "guild-1",
      DISCORD_CHANNEL_ID: "channel-1"
    })
  ).toEqual({
    ok: true,
    config: {
      discordToken: "token-value",
      guildId: "guild-1",
      channelId: "channel-1",
      databasePath: "./data/copanalhas.sqlite",
      autoPostEnabled: true,
      autoPostTime: "09:00",
      timezone: "America/Sao_Paulo",
      footballDataToken: null,
      resultSyncEnabled: false
    }
  });
});

test("accepts explicit autonomous runtime settings", () => {
  expect(
    parseCopanalhasConfig({
      DISCORD_BOT_TOKEN: "token-value",
      DISCORD_GUILD_ID: "guild-1",
      DISCORD_CHANNEL_ID: "channel-1",
      COPANALHAS_AUTO_POST_ENABLED: "false",
      COPANALHAS_AUTO_POST_TIME: "10:30",
      COPANALHAS_TIMEZONE: "UTC",
      FOOTBALL_DATA_TOKEN: "football-data-token",
      COPANALHAS_RESULT_SYNC_ENABLED: "true"
    })
  ).toEqual({
    ok: true,
    config: expect.objectContaining({
      autoPostEnabled: false,
      autoPostTime: "10:30",
      timezone: "UTC",
      footballDataToken: "football-data-token",
      resultSyncEnabled: true
    })
  });
});

test("rejects invalid autonomous runtime settings", () => {
  expect(
    parseCopanalhasConfig({
      DISCORD_BOT_TOKEN: "token-value",
      DISCORD_GUILD_ID: "guild-1",
      DISCORD_CHANNEL_ID: "channel-1",
      COPANALHAS_AUTO_POST_TIME: "25:99"
    })
  ).toEqual({
    ok: false,
    errors: ["COPANALHAS_AUTO_POST_TIME must use HH:mm"]
  });
});
```

- [ ] **Step 2: Run config tests and verify RED**

Run: `npm test -- src/discord/config.test.ts`

Expected: FAIL because the config object does not include the new runtime fields.

- [ ] **Step 3: Extend `CopanalhasConfig` and parser**

Add fields:

```ts
autoPostEnabled: boolean;
autoPostTime: string;
timezone: string;
footballDataToken: string | null;
resultSyncEnabled: boolean;
```

Parsing rules:

- `COPANALHAS_AUTO_POST_ENABLED` defaults to `true`; only `false` disables it.
- `COPANALHAS_AUTO_POST_TIME` defaults to `09:00`; valid format is `00:00` through `23:59`.
- `COPANALHAS_TIMEZONE` defaults to `America/Sao_Paulo`; accept non-empty strings.
- `FOOTBALL_DATA_TOKEN` defaults to `null`.
- `COPANALHAS_RESULT_SYNC_ENABLED` defaults to `true` only when `FOOTBALL_DATA_TOKEN` is set; explicit `false` disables it.

- [ ] **Step 4: Update `.env.example`**

Add:

```text
COPANALHAS_AUTO_POST_ENABLED=true
COPANALHAS_AUTO_POST_TIME=09:00
COPANALHAS_TIMEZONE=America/Sao_Paulo
FOOTBALL_DATA_TOKEN=
COPANALHAS_RESULT_SYNC_ENABLED=
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/discord/config.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/discord/config.ts src/discord/config.test.ts .env.example
git commit -m "feat: parse autonomous bot config"
```

---

## Task 2: Match Timing And Cutoff Helpers

**Files:**
- Modify: `src/worldcup/types.ts`
- Modify: `src/worldcup/seed.ts`
- Create: `src/worldcup/cutoff.ts`
- Create: `src/worldcup/cutoff.test.ts`
- Modify: `src/worldcup/validate.ts`
- Modify: `src/worldcup/validate.test.ts`

- [ ] **Step 1: Write failing cutoff tests**

Create `src/worldcup/cutoff.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  getPredictionWindow,
  canSubmitPredictionAt,
  formatPredictionWindow
} from "./cutoff.js";
import type { WorldCupMatch } from "./types.js";

describe("prediction cutoff", () => {
  test("closes predictions 30 minutes before kickoff", () => {
    const match = timedMatch("2026-06-11T19:00:00.000Z");

    expect(getPredictionWindow(match)).toEqual({
      kickoffAtUtc: "2026-06-11T19:00:00.000Z",
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T18:29:59.000Z"))).toEqual({
      ok: true,
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T18:30:00.000Z"))).toEqual({
      ok: false,
      reason: "closed",
      closesAtUtc: "2026-06-11T18:30:00.000Z"
    });
  });

  test("rejects predictions when kickoff time is not verified", () => {
    const match = timedMatch(null);

    expect(getPredictionWindow(match)).toEqual({
      kickoffAtUtc: null,
      closesAtUtc: null
    });
    expect(canSubmitPredictionAt(match, new Date("2026-06-11T12:00:00.000Z"))).toEqual({
      ok: false,
      reason: "missing-kickoff"
    });
  });

  test("formats kickoff and close time for match cards", () => {
    expect(formatPredictionWindow(timedMatch("2026-06-11T19:00:00.000Z"), "UTC")).toEqual({
      kickoffText: "Kickoff: 2026-06-11 19:00 UTC",
      closesText: "Predictions close: 2026-06-11 18:30 UTC"
    });
  });
});

function timedMatch(kickoffAtUtc: string | null): WorldCupMatch {
  return {
    id: "wc2026-001",
    matchNumber: 1,
    phase: "group",
    group: "A",
    homeTeam: { code: "MEX", name: "Mexico" },
    awayTeam: { code: "RSA", name: "South Africa" },
    localDate: "2026-06-11",
    kickoffTimeLocal: null,
    kickoffAtUtc,
    venue: "Mexico City Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
```

- [ ] **Step 2: Run cutoff tests and verify RED**

Run: `npm test -- src/worldcup/cutoff.test.ts`

Expected: FAIL because `src/worldcup/cutoff.ts` does not exist.

- [ ] **Step 3: Extend `WorldCupMatch`**

Add:

```ts
kickoffAtUtc: string | null;
externalIds: {
  footballData?: number;
};
```

- [ ] **Step 4: Update seed construction**

Change `groupMatch` to accept `kickoffAtUtc: string | null` and `externalIds = {}`.

Current seed matches can keep `kickoffAtUtc: null` until reviewed FIFA kickoff
times are added. This is safe because Task 4 rejects predictions for missing
kickoff data and Task 8 status reports missing kickoff times.

- [ ] **Step 5: Implement `src/worldcup/cutoff.ts`**

Implement:

```ts
export function getPredictionWindow(match: WorldCupMatch): PredictionWindow
export function canSubmitPredictionAt(match: WorldCupMatch, now: Date): PredictionSubmissionWindow
export function formatPredictionWindow(match: WorldCupMatch, timeZone: string): FormattedPredictionWindow
```

Use `Intl.DateTimeFormat` with `hour12: false`, `timeZoneName: "short"`, and UTC ISO math for the close time.

- [ ] **Step 6: Update validation tests**

Add validation expectations:

- `kickoffAtUtc` must be `null` or a valid ISO timestamp ending in `Z`.
- `externalIds.footballData`, when present, must be a positive integer.

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- src/worldcup/cutoff.test.ts src/worldcup/validate.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/worldcup/types.ts src/worldcup/seed.ts src/worldcup/cutoff.ts src/worldcup/cutoff.test.ts src/worldcup/validate.ts src/worldcup/validate.test.ts
git commit -m "feat: model match prediction cutoff"
```

---

## Task 3: Match Cards And Modal Cutoff Enforcement

**Files:**
- Modify: `src/discord/components.ts`
- Modify: `src/discord/components.test.ts`
- Modify: `src/discord/interactions.ts`
- Modify: `src/discord/interactions.test.ts`

- [ ] **Step 1: Write failing match card test**

Update the match-card view expectation to include cutoff text:

```ts
expect(buildMatchCardView(firstSeedMatch(), { timeZone: "UTC" })).toEqual({
  matchId: "wc2026-001",
  predictButtonCustomId: "copanalhas:predict:wc2026-001",
  content: [
    "MATCH OF THE DAY",
    "Match #1 - Group A",
    "Mexico vs South Africa",
    "Kickoff: not verified",
    "Predictions close: not available",
    "Click Predict and enter a score like 2x1."
  ].join("\n")
});
```

- [ ] **Step 2: Write failing modal cutoff tests**

Add tests to `src/discord/interactions.test.ts`:

```ts
test("rejects modal predictions when kickoff time is missing", async () => {
  const interaction = modalInteraction({
    customId: buildScoreModalCustomId("wc2026-001"),
    scoreText: "2x1"
  });
  const upsertPrediction = vi.fn();

  const result = await handlePredictionInteraction(
    interaction,
    options({
      matches: [matchWithKickoff(null)],
      now: () => new Date("2026-06-11T12:00:00.000Z"),
      upsertPrediction
    })
  );

  expect(result).toEqual({
    action: "rejected",
    reason: "missing-kickoff",
    matchId: "wc2026-001",
    userId: "user-1"
  });
  expect(upsertPrediction).not.toHaveBeenCalled();
  expect(interaction.reply).toHaveBeenCalledWith({
    content: "Predictions for Mexico vs South Africa are not open because kickoff time is not verified yet.",
    ephemeral: true
  });
});

test("rejects modal predictions after the cutoff", async () => {
  const interaction = modalInteraction({
    customId: buildScoreModalCustomId("wc2026-001"),
    scoreText: "2x1"
  });
  const upsertPrediction = vi.fn();

  const result = await handlePredictionInteraction(
    interaction,
    options({
      matches: [matchWithKickoff("2026-06-11T19:00:00.000Z")],
      now: () => new Date("2026-06-11T18:30:00.000Z"),
      upsertPrediction
    })
  );

  expect(result).toEqual({
    action: "rejected",
    reason: "closed",
    matchId: "wc2026-001",
    userId: "user-1",
    closesAtUtc: "2026-06-11T18:30:00.000Z"
  });
  expect(upsertPrediction).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/discord/components.test.ts src/discord/interactions.test.ts`

Expected: FAIL because `buildMatchCardView` lacks options and interaction options lack `now`.

- [ ] **Step 4: Update component APIs**

Change:

```ts
export function buildMatchCardView(
  match: WorldCupMatch,
  options: { timeZone: string } = { timeZone: "America/Sao_Paulo" }
): MatchCardView
```

Change `createMatchCardMessage` to accept the same optional `timeZone`.

- [ ] **Step 5: Update interaction options**

Extend `PredictionInteractionOptions`:

```ts
now?: () => Date;
timeZone?: string;
```

Use `options.now?.() ?? new Date()` when validating modal submissions.

Extend rejected reasons:

```ts
"missing-kickoff" | "closed"
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/discord/components.test.ts src/discord/interactions.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/discord/components.ts src/discord/components.test.ts src/discord/interactions.ts src/discord/interactions.test.ts
git commit -m "feat: enforce prediction cutoff"
```

---

## Task 4: Posted Card Storage And Idempotent Posting

**Files:**
- Modify: `src/storage/database.ts`
- Modify: `src/storage/database.test.ts`
- Create: `src/app/match-card-posting.ts`
- Create: `src/app/match-card-posting.test.ts`
- Modify: `src/discord/posting.ts`
- Modify: `src/discord/posting.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add database tests for posted cards:

```ts
store.recordPostedMatchCard({
  matchId: "wc2026-001",
  channelId: "channel-1",
  messageId: "discord-message-1",
  postedForDate: "2026-06-11",
  postedAt: "2026-06-11T12:00:00.000Z",
  postSource: "command"
});

expect(store.listPostedMatchCards()).toEqual([
  {
    matchId: "wc2026-001",
    channelId: "channel-1",
    messageId: "discord-message-1",
    postedForDate: "2026-06-11",
    postedAt: "2026-06-11T12:00:00.000Z",
    postSource: "command"
  }
]);
```

- [ ] **Step 2: Write failing orchestration tests**

Create `src/app/match-card-posting.test.ts`:

```ts
test("posts only cards not already recorded for the channel", async () => {
  const sent: Array<{ matchId: string; content: string }> = [];
  const recorded: string[] = ["wc2026-001"];

  const result = await postDueMatchCards({
    matches: [
      match("wc2026-001", "2026-06-11"),
      match("wc2026-002", "2026-06-11")
    ],
    channelId: "channel-1",
    date: "2026-06-11",
    postSource: "auto",
    timeZone: "UTC",
    now: () => new Date("2026-06-11T12:00:00.000Z"),
    listPostedMatchCards: () =>
      recorded.map((matchId) => ({
        matchId,
        channelId: "channel-1",
        messageId: `message-${matchId}`,
        postedForDate: "2026-06-11",
        postedAt: "2026-06-11T09:00:00.000Z",
        postSource: "auto"
      })),
    sendMatchCard: async (matchId, message) => {
      sent.push({ matchId, content: message.content });
      return `message-${matchId}`;
    },
    recordPostedMatchCard: (card) => {
      recorded.push(card.matchId);
    }
  });

  expect(result).toEqual({
    posted: ["wc2026-002"],
    skipped: ["wc2026-001"]
  });
  expect(sent).toHaveLength(1);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/storage/database.test.ts src/app/match-card-posting.test.ts`

Expected: FAIL because the posted-card APIs and module do not exist.

- [ ] **Step 4: Extend database schema**

Add table:

```sql
CREATE TABLE IF NOT EXISTS posted_match_cards (
  match_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  posted_for_date TEXT NOT NULL,
  posted_at TEXT NOT NULL,
  post_source TEXT NOT NULL,
  PRIMARY KEY (match_id, channel_id)
) STRICT;
```

Add interfaces:

```ts
export type PostedMatchCardSource = "auto" | "command";

export interface StoredPostedMatchCard {
  matchId: string;
  channelId: string;
  messageId: string;
  postedForDate: string;
  postedAt: string;
  postSource: PostedMatchCardSource;
}
```

Add methods:

```ts
recordPostedMatchCard(card: StoredPostedMatchCard): void
listPostedMatchCards(): StoredPostedMatchCard[]
```

- [ ] **Step 5: Update Discord posting return value**

Change poster send port to return message IDs:

```ts
send(message: MatchCardMessage): Promise<{ id: string }>
```

Update tests so fake `send` returns `{ id: "discord-message-1" }`.

- [ ] **Step 6: Implement `postDueMatchCards`**

Inputs:

- matches
- channelId
- date
- postSource
- timeZone
- now
- listPostedMatchCards
- sendMatchCard
- recordPostedMatchCard

Return:

```ts
{ posted: string[]; skipped: string[] }
```

- [ ] **Step 7: Verify and commit**

Run:

```powershell
npm test -- src/storage/database.test.ts src/app/match-card-posting.test.ts src/discord/posting.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/storage/database.ts src/storage/database.test.ts src/app/match-card-posting.ts src/app/match-card-posting.test.ts src/discord/posting.ts src/discord/posting.test.ts
git commit -m "feat: store posted match cards"
```

---

## Task 5: Auto-Posting Scheduler

**Files:**
- Create: `src/app/scheduler.ts`
- Create: `src/app/scheduler.test.ts`
- Create: `src/app/auto-posting.ts`
- Create: `src/app/auto-posting.test.ts`

- [ ] **Step 1: Write failing scheduler tests**

Test pure due-time decisions:

```ts
expect(
  shouldRunDailyJob({
    enabled: true,
    localDate: "2026-06-11",
    localTime: "09:00",
    targetTime: "09:00",
    lastRunDate: null
  })
).toEqual({ shouldRun: true, runDate: "2026-06-11" });

expect(
  shouldRunDailyJob({
    enabled: true,
    localDate: "2026-06-11",
    localTime: "08:59",
    targetTime: "09:00",
    lastRunDate: null
  })
).toEqual({ shouldRun: false });

expect(
  shouldRunDailyJob({
    enabled: true,
    localDate: "2026-06-11",
    localTime: "10:00",
    targetTime: "09:00",
    lastRunDate: "2026-06-11"
  })
).toEqual({ shouldRun: false });
```

- [ ] **Step 2: Write failing auto-posting orchestration tests**

Test that `runAutoPostTick` calls `postDueMatchCards` only when due and returns a status summary.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/app/scheduler.test.ts src/app/auto-posting.test.ts`

Expected: FAIL because both modules do not exist.

- [ ] **Step 4: Implement scheduler helpers**

Implement:

```ts
export function getLocalDateTimeParts(now: Date, timeZone: string): {
  localDate: string;
  localTime: string;
}

export function shouldRunDailyJob(input: DailyJobInput): DailyJobDecision
```

Use `Intl.DateTimeFormat` with `formatToParts`.

- [ ] **Step 5: Implement auto-posting tick**

Implement:

```ts
export async function runAutoPostTick(options: AutoPostTickOptions): Promise<AutoPostTickResult>
```

Result shape:

```ts
type AutoPostTickResult =
  | { action: "disabled" }
  | { action: "not-due"; localDate: string; localTime: string }
  | { action: "posted"; localDate: string; posted: string[]; skipped: string[] };
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/app/scheduler.test.ts src/app/auto-posting.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/app/scheduler.ts src/app/scheduler.test.ts src/app/auto-posting.ts src/app/auto-posting.test.ts
git commit -m "feat: schedule daily match posting"
```

---

## Task 6: Slash Command Definitions And Registration

**Files:**
- Create: `src/discord/commands.ts`
- Create: `src/discord/commands.test.ts`
- Modify: `src/discord/ingestion.ts`
- Modify: `src/discord/ingestion.test.ts`

- [ ] **Step 1: Write failing command definition tests**

Create `src/discord/commands.test.ts`:

```ts
import { describe, expect, test, vi } from "vitest";

import { copanalhasCommandName, createCopanalhasCommand, registerCopanalhasCommands } from "./commands.js";

describe("Copanalhas slash command definition", () => {
  test("defines operator subcommands", () => {
    expect(createCopanalhasCommand().toJSON()).toMatchObject({
      name: "copanalhas",
      description: "Operate the Copanalhas World Cup game",
      options: expect.arrayContaining([
        expect.objectContaining({ name: "post-today" }),
        expect.objectContaining({ name: "post-date" }),
        expect.objectContaining({ name: "status" }),
        expect.objectContaining({ name: "leaderboard" }),
        expect.objectContaining({ name: "result" })
      ])
    });
    expect(copanalhasCommandName).toBe("copanalhas");
  });

  test("registers commands on the configured guild", async () => {
    const set = vi.fn(async () => undefined);
    await registerCopanalhasCommands({
      guildId: "guild-1",
      fetchGuild: async (guildId) => ({ id: guildId, commands: { set } })
    });
    expect(set).toHaveBeenCalledWith([createCopanalhasCommand().toJSON()]);
  });
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/discord/commands.test.ts`

Expected: FAIL because `src/discord/commands.ts` does not exist.

- [ ] **Step 3: Implement command definition**

Use `SlashCommandBuilder`.

Subcommands:

- `post-today`
- `post-date` with required string option `date`
- `status`
- `leaderboard`
- `result` with required string options `match` and `score`

- [ ] **Step 4: Wire registration in Discord client**

Change `createDiscordClient` to accept an optional `onReady` or `registerCommands` dependency. On `Events.ClientReady`, register guild commands by fetching configured guild and calling `guild.commands.set`.

Keep `console.log("Logged in...")` behavior.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/discord/commands.test.ts src/discord/ingestion.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/discord/commands.ts src/discord/commands.test.ts src/discord/ingestion.ts src/discord/ingestion.test.ts
git commit -m "feat: register operator slash commands"
```

---

## Task 7: Operator Command Handler

**Files:**
- Create: `src/discord/operator-commands.ts`
- Create: `src/discord/operator-commands.test.ts`
- Modify: `src/discord/ingestion.ts`
- Modify: `src/discord/ingestion.test.ts`

- [ ] **Step 1: Write failing pure handler tests**

Create tests for:

- `post-today` calls `postDueMatchCards` for the current local date.
- `post-date` calls it for the provided date.
- `status` returns missing kickoff and sync state text.
- `leaderboard` returns formatted leaderboard.
- `result` parses score and calls `upsertResult` with `resultSource: "manual"`.

Example result test:

```ts
const result = await handleOperatorCommand(command("result", { match: "wc2026-001", score: "2-1" }), options);

expect(result).toEqual({
  action: "replied",
  content: "Recorded result wc2026-001 2-1.",
  ephemeral: true
});
expect(options.upsertResult).toHaveBeenCalledWith({
  matchId: "wc2026-001",
  homeScore: 2,
  awayScore: 1,
  recordedAt: "2026-06-11T23:00:00.000Z",
  resultSource: "manual",
  externalMatchId: null,
  fetchedAt: null
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/discord/operator-commands.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement project-owned command port**

Define:

```ts
export type OperatorSubcommand = "post-today" | "post-date" | "status" | "leaderboard" | "result";

export interface OperatorCommandInput {
  guildId: string | null;
  channelId: string | null;
  userId: string;
  subcommand: OperatorSubcommand;
  options: Record<string, string>;
}
```

The pure handler returns:

```ts
{ action: "ignored"; reason: "wrong-guild" | "wrong-channel" | "unknown-command" }
| { action: "replied"; content: string; ephemeral: true }
```

- [ ] **Step 4: Implement Discord adapter**

In `handleDiscordOperatorCommand`, use:

- `interaction.isChatInputCommand()`
- `interaction.commandName === "copanalhas"`
- `interaction.options.getSubcommand(true)`
- `interaction.options.getString("date", true)`
- `interaction.options.getString("match", true)`
- `interaction.options.getString("score", true)`

Reply with `MessageFlags.Ephemeral`.

- [ ] **Step 5: Wire into `Events.InteractionCreate`**

In `createDiscordClient`, route chat input commands to operator handler before button/modal prediction handling.

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/discord/operator-commands.test.ts src/discord/ingestion.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/discord/operator-commands.ts src/discord/operator-commands.test.ts src/discord/ingestion.ts src/discord/ingestion.test.ts
git commit -m "feat: handle operator slash commands"
```

---

## Task 8: Result Provenance And Manual Overrides

**Files:**
- Modify: `src/storage/database.ts`
- Modify: `src/storage/database.test.ts`
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write failing result provenance storage tests**

Update result storage expectations:

```ts
store.upsertResult({
  matchId: "wc2026-001",
  homeScore: 2,
  awayScore: 1,
  recordedAt: "2026-06-11T23:00:00.000Z",
  resultSource: "football-data",
  externalMatchId: "12345",
  fetchedAt: "2026-06-11T23:01:00.000Z"
});

expect(store.listResults()).toEqual([
  {
    matchId: "wc2026-001",
    homeScore: 2,
    awayScore: 1,
    recordedAt: "2026-06-11T23:00:00.000Z",
    resultSource: "football-data",
    externalMatchId: "12345",
    fetchedAt: "2026-06-11T23:01:00.000Z"
  }
]);
```

- [ ] **Step 2: Write failing manual override test**

Test that a manual result overwrites an automatic result and stores source `"manual"`.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/storage/database.test.ts src/index.test.ts`

Expected: FAIL because result source fields do not exist.

- [ ] **Step 4: Extend result types and schema**

Update `StoredResult`:

```ts
resultSource: "manual" | "football-data";
externalMatchId: string | null;
fetchedAt: string | null;
```

Update `results` table with these columns. Because current SQLite migration uses `CREATE TABLE IF NOT EXISTS`, add defensive `ALTER TABLE` statements guarded by a helper that checks existing columns through `PRAGMA table_info(results)`.

- [ ] **Step 5: Update terminal `record-result`**

Store manual provenance:

```ts
resultSource: "manual",
externalMatchId: null,
fetchedAt: null
```

- [ ] **Step 6: Verify and commit**

Run:

```powershell
npm test -- src/storage/database.test.ts src/index.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/storage/database.ts src/storage/database.test.ts src/index.ts src/index.test.ts
git commit -m "feat: store result provenance"
```

---

## Task 9: football-data.org Client

**Files:**
- Create: `src/results/football-data.ts`
- Create: `src/results/football-data.test.ts`

- [ ] **Step 1: Write failing parser tests**

Create tests for parsing match responses:

```ts
test("parses finished full-time scores", () => {
  expect(
    parseFootballDataMatch({
      id: 12345,
      utcDate: "2026-06-11T19:00:00Z",
      status: "FINISHED",
      score: {
        fullTime: {
          homeTeam: 2,
          awayTeam: 1
        }
      }
    })
  ).toEqual({
    externalMatchId: "12345",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    status: "FINISHED",
    fullTime: {
      homeScore: 2,
      awayScore: 1
    }
  });
});

test("keeps unfinished scores empty", () => {
  expect(
    parseFootballDataMatch({
      id: 12345,
      utcDate: "2026-06-11T19:00:00Z",
      status: "SCHEDULED",
      score: {
        fullTime: {
          homeTeam: null,
          awayTeam: null
        }
      }
    }).fullTime
  ).toBeNull();
});
```

- [ ] **Step 2: Write failing client tests**

Inject a fake `fetch` and assert:

- URL contains `https://api.football-data.org/v4/competitions/WC/matches`
- query includes `dateFrom` and `dateTo`
- header includes `X-Auth-Token`
- HTTP 429 returns `{ ok: false, reason: "rate-limited" }`

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/results/football-data.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement parser and client**

Define:

```ts
export interface FootballDataMatch {
  externalMatchId: string;
  kickoffAtUtc: string;
  status: string;
  fullTime: { homeScore: number; awayScore: number } | null;
}

export async function fetchFootballDataMatches(options: FetchFootballDataMatchesOptions): Promise<FootballDataFetchResult>
```

Use a conservative date window passed by caller. Do not poll without `FOOTBALL_DATA_TOKEN`.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/results/football-data.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/results/football-data.ts src/results/football-data.test.ts
git commit -m "feat: add football-data result client"
```

---

## Task 10: Result Sync Orchestration

**Files:**
- Create: `src/results/sync.ts`
- Create: `src/results/sync.test.ts`
- Modify: `src/leaderboard/format.ts`
- Modify: `src/leaderboard/format.test.ts`

- [ ] **Step 1: Write failing sync tests**

Test that finished provider scores are stored only for matches with matching external IDs:

```ts
const result = await syncFinishedResults({
  matches: [
    {
      ...match("wc2026-001"),
      externalIds: { footballData: 12345 }
    }
  ],
  now: () => new Date("2026-06-11T23:01:00.000Z"),
  fetchMatches: async () => ({
    ok: true,
    matches: [
      {
        externalMatchId: "12345",
        kickoffAtUtc: "2026-06-11T19:00:00.000Z",
        status: "FINISHED",
        fullTime: { homeScore: 2, awayScore: 1 }
      }
    ]
  }),
  upsertResult,
  listPredictions: () => [],
  insertScoringRun
});

expect(result).toEqual({
  action: "synced",
  storedResults: ["wc2026-001"],
  skipped: []
});
```

- [ ] **Step 2: Write failing provider failure test**

When fetch returns rate-limited/unavailable, expect:

```ts
{ action: "failed"; reason: "rate-limited" }
```

and no stored results.

- [ ] **Step 3: Run focused tests and verify RED**

Run: `npm test -- src/results/sync.test.ts`

Expected: FAIL because the sync module does not exist.

- [ ] **Step 4: Implement result sync**

Rules:

- Skip if result sync disabled or token missing.
- Fetch nearby dates only.
- Store only `status === "FINISHED"` and non-null full-time score.
- Use `resultSource: "football-data"`.
- Do not overwrite existing manual results unless a later explicit manual command does it.
- Insert a scoring run after storing at least one result.

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/results/sync.test.ts src/leaderboard/format.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/results/sync.ts src/results/sync.test.ts src/leaderboard/format.ts src/leaderboard/format.test.ts
git commit -m "feat: sync finished match results"
```

---

## Task 11: Bot Runtime Composition

**Files:**
- Create: `src/app/bot-runtime.ts`
- Create: `src/app/bot-runtime.test.ts`
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`
- Modify: `src/discord/ingestion.ts`
- Modify: `src/discord/ingestion.test.ts`

- [ ] **Step 1: Write failing runtime tests**

Test startup composition:

```ts
await startCopanalhasBotRuntime({
  config,
  store,
  matches,
  startDiscord,
  startInterval,
  postMatchCard,
  now: () => new Date("2026-06-11T12:00:00.000Z"),
  writeLine
});

expect(store.migrate).toHaveBeenCalled();
expect(store.upsertMatches).toHaveBeenCalledWith(matches);
expect(startDiscord).toHaveBeenCalledWith(
  config,
  expect.any(Function),
  expect.objectContaining({
    matches,
    upsertPrediction: expect.any(Function),
    now: expect.any(Function),
    timeZone: config.timezone
  }),
  expect.objectContaining({
    handleOperatorCommand: expect.any(Function),
    registerCommands: expect.any(Function)
  })
);
expect(startInterval).toHaveBeenCalled();
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/app/bot-runtime.test.ts src/index.test.ts`

Expected: FAIL because `bot-runtime.ts` does not exist and `index.ts` still wires bot startup inline.

- [ ] **Step 3: Implement runtime module**

`startCopanalhasBotRuntime` composes:

- storage migration
- match seed upsert
- prediction interaction options
- operator command options
- scheduler tick
- optional result sync tick

Keep timer handle returned so tests and future shutdown can stop it:

```ts
export interface StartedBotRuntime {
  stop(): void | Promise<void>;
}
```

- [ ] **Step 4: Update `index.ts`**

Move `startBot` internals into `startCopanalhasBotRuntime`.

`runCli(["bot"])` should still print:

```text
Starting Discord collector for configured channel.
```

Add one line after successful runtime composition:

```text
Autonomous operator enabled. Auto-post: on at 09:00 America/Sao_Paulo.
```

- [ ] **Step 5: Verify and commit**

Run:

```powershell
npm test -- src/app/bot-runtime.test.ts src/index.test.ts src/discord/ingestion.test.ts
npm test
npm run build
```

Expected: all commands exit 0.

Commit:

```powershell
git add src/app/bot-runtime.ts src/app/bot-runtime.test.ts src/index.ts src/index.test.ts src/discord/ingestion.ts src/discord/ingestion.test.ts
git commit -m "feat: compose autonomous bot runtime"
```

---

## Task 12: Documentation And Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/discord-ingestion.md`
- Modify: `docs/data-sources.md`
- Modify: `docs/security-privacy.md`
- Modify: `.env.example` if new env names changed during implementation

- [ ] **Step 1: Update README commands**

Document:

```text
npm run dev -- bot
npm run dev -- post-matches-today 2026-06-11
npm run dev -- leaderboard
npm run dev -- record-result wc2026-001 2 1
```

Explain that Discord slash commands are preferred while `bot` is running.

- [ ] **Step 2: Update Discord docs**

Document:

- auto-posting runs only while the bot process is running
- prediction cutoff is 30 minutes before `kickoffAtUtc`
- missing kickoff time closes predictions
- `/copanalhas` operator command list
- posted-card dedupe behavior

- [ ] **Step 3: Update data source docs**

Document:

- FIFA-reviewed fixture/group/kickoff data remains the source of truth
- football-data.org is optional for result sync
- provider token handling
- rate-limit-aware polling
- manual result override

- [ ] **Step 4: Update security docs**

Document:

- `FOOTBALL_DATA_TOKEN` is a secret
- provider data is stored only as result provenance
- no raw Discord content storage is added

- [ ] **Step 5: Full verification**

Run:

```powershell
npm test
npm run build
git status --short --branch
```

Expected:

- Vitest reports all test files passed.
- TypeScript build exits 0.
- Git status shows only the documentation files staged or modified before commit.

- [ ] **Step 6: Commit and push**

Commit:

```powershell
git add README.md docs/discord-ingestion.md docs/data-sources.md docs/security-privacy.md .env.example
git commit -m "docs: document autonomous operator flow"
git push origin main
```

---

## Self-Review

- Spec coverage: Tasks cover autonomous bot startup, scheduler, posted-card dedupe, slash commands, cutoff enforcement, FIFA-reviewed fixture timing, optional football-data result sync, manual override, status reporting, docs, and tests.
- Scope check: This remains one connected implementation plan because scheduler, commands, cutoff, posting, storage, and result sync all compose into the same bot runtime. The plan keeps each subsystem separately testable.
- Red-flag scan: Plan uses concrete paths, command names, expected test behavior, env names, table names, type names, and commit messages.
- Type consistency: `WorldCupMatch.kickoffAtUtc`, `WorldCupMatch.externalIds`, `StoredResult.resultSource`, `StoredPostedMatchCard`, `PredictionInteractionOptions.now`, and `CopanalhasConfig` fields are introduced before later tasks use them.
