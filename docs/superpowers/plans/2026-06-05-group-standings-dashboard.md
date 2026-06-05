# Group Standings Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved two-message Discord group standings dashboard and make it update from stored World Cup results.

**Architecture:** Keep standings computation pure and independent from Discord. Render project-owned message payloads, persist Discord message IDs in SQLite, and have the bot runtime call a fakeable app-level updater on startup, manual result changes, and automatic result sync changes.

**Tech Stack:** Node v25, TypeScript 5.9, Vitest 4, discord.js 14.26.2, node:sqlite.

---

## Source References

- Design spec: `docs/superpowers/specs/2026-06-05-group-standings-dashboard-design.md`
- Context7 checked for `discord.js` 14.26.2:
  - `SlashCommandBuilder.addSubcommand(...)`
  - message send payloads use `channel.send(options)`
  - message fetch uses `channel.messages.fetch(messageId)`
  - existing messages can be updated through message edit payloads with content and embeds

## File Structure

- Create `src/standings/standings.ts`: pure group table computation from fixtures plus stored final results.
- Create `src/standings/standings.test.ts`: empty standings, wins/draws, deterministic ordering, and ignored unplayed matches.
- Create `src/standings/format.ts`: render `groups_a_f` and `groups_g_l` dashboard payloads.
- Create `src/standings/format.test.ts`: assert content, six embeds per post, columns, and result-updated rows.
- Modify `src/storage/database.ts`: add `standings_posts` schema and methods.
- Modify `src/storage/database.test.ts`: assert standings post upsert/list behavior.
- Create `src/app/standings-posting.ts`: idempotently edit existing standings messages or post replacements.
- Create `src/app/standings-posting.test.ts`: assert edit, create, and replacement behavior.
- Create `src/discord/standings-posting.ts`: thin discord.js adapter for fetching/editing/sending standings messages.
- Create `src/discord/standings-posting.test.ts`: fake Discord client tests.
- Modify `src/discord/commands.ts`: add `/copanalhas standings`.
- Modify `src/discord/commands.test.ts`: assert the new subcommand is registered.
- Modify `src/discord/operator-commands.ts`: route `standings`, update standings after manual result, and include standings status.
- Modify `src/discord/operator-commands.test.ts`: assert command behavior and update triggers.
- Modify `src/app/bot-runtime.ts`: compose standings updater on startup and after result sync imports finals.
- Modify `src/app/bot-runtime.test.ts`: assert runtime passes and calls standings updater.
- Modify `src/index.ts`: wire the default Discord standings adapter and add a local `standings-preview` smoke command.

---

## Task 1: Pure Standings Computation

**Files:**
- Create: `src/standings/standings.ts`
- Create: `src/standings/standings.test.ts`

- [ ] **Step 1: Write failing tests**

Create tests that use small local fixtures and call:

```ts
computeGroupStandings(matches, results)
```

Required expectations:

```ts
expect(computeGroupStandings([mexicoSouthAfrica], [])).toEqual([
  {
    group: "A",
    rows: [
      expect.objectContaining({ teamCode: "MEX", played: 0, points: 0 }),
      expect.objectContaining({ teamCode: "RSA", played: 0, points: 0 })
    ]
  }
]);
```

```ts
expect(groupA.rows[0]).toMatchObject({
  teamCode: "MEX",
  played: 1,
  wins: 1,
  draws: 0,
  losses: 0,
  goalsFor: 2,
  goalsAgainst: 1,
  goalDifference: 1,
  points: 3
});
```

```ts
expect(groupA.rows.map((row) => row.teamName)).toEqual([
  "Alpha",
  "Bravo",
  "Charlie",
  "Delta"
]);
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/standings/standings.test.ts`

Expected: FAIL because `src/standings/standings.ts` does not exist.

- [ ] **Step 3: Implement standings**

Add types:

```ts
export interface GroupStandingRow {
  rank: number;
  group: string;
  teamCode: string;
  teamName: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}
```

Apply scoring:

```ts
if (homeScore > awayScore) {
  home.wins += 1;
  away.losses += 1;
  home.points += 3;
} else if (homeScore < awayScore) {
  away.wins += 1;
  home.losses += 1;
  away.points += 3;
} else {
  home.draws += 1;
  away.draws += 1;
  home.points += 1;
  away.points += 1;
}
```

Sort rows by points, goal difference, goals for, then team name.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/standings/standings.test.ts`

Expected: PASS.

---

## Task 2: Standings Rendering

**Files:**
- Create: `src/standings/format.ts`
- Create: `src/standings/format.test.ts`

- [ ] **Step 1: Write failing tests**

Assert:

```ts
const messages = createStandingsDashboardMessages({
  standings,
  updatedAt: new Date("2026-06-11T23:30:00.000Z"),
  timeZone: "UTC"
});

expect(messages).toHaveLength(2);
expect(messages[0]).toMatchObject({
  key: "groups_a_f",
  content: expect.stringContaining("Groups A-F"),
  embeds: expect.arrayContaining([
    expect.objectContaining({
      title: "Group A",
      description: expect.stringContaining("Pts")
    })
  ])
});
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/standings/format.test.ts`

Expected: FAIL because the renderer does not exist.

- [ ] **Step 3: Implement renderer**

Return project-owned payloads:

```ts
export interface StandingsDashboardMessage {
  key: StandingsPostKey;
  content: string;
  embeds: StandingsDashboardEmbed[];
}
```

Build two messages:

```ts
groups_a_f: ["A", "B", "C", "D", "E", "F"]
groups_g_l: ["G", "H", "I", "J", "K", "L"]
```

Each embed description is a code block with:

```text
# Team              P W D L GF GA GD Pts
1 Mexico            1 1 0 0  2  1  1   3
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/standings/format.test.ts`

Expected: PASS.

---

## Task 3: Standings Post Storage

**Files:**
- Modify: `src/storage/database.ts`
- Modify: `src/storage/database.test.ts`

- [ ] **Step 1: Write failing storage test**

Add a test:

```ts
store.recordStandingsPost({
  postKey: "groups_a_f",
  guildId: "guild-1",
  channelId: "channel-1",
  messageId: "message-1",
  createdAt: "2026-06-11T12:00:00.000Z",
  updatedAt: "2026-06-11T12:00:00.000Z"
});

expect(store.listStandingsPosts()).toEqual([
  {
    postKey: "groups_a_f",
    guildId: "guild-1",
    channelId: "channel-1",
    messageId: "message-1",
    createdAt: "2026-06-11T12:00:00.000Z",
    updatedAt: "2026-06-11T12:00:00.000Z"
  }
]);
```

- [ ] **Step 2: Run RED**

Run: `npm test -- src/storage/database.test.ts`

Expected: FAIL because standings post methods do not exist.

- [ ] **Step 3: Implement schema and methods**

Add `standings_posts`:

```sql
CREATE TABLE IF NOT EXISTS standings_posts (
  post_key TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (post_key, guild_id, channel_id)
) STRICT;
```

Add `StoredStandingsPost`, `recordStandingsPost`, and `listStandingsPosts`.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/storage/database.test.ts`

Expected: PASS.

---

## Task 4: App-Level Dashboard Updater

**Files:**
- Create: `src/app/standings-posting.ts`
- Create: `src/app/standings-posting.test.ts`

- [ ] **Step 1: Write failing updater tests**

Cover:

```ts
await updateStandingsDashboard({
  guildId: "guild-1",
  channelId: "channel-1",
  matches,
  results,
  timeZone: "UTC",
  now: () => new Date("2026-06-11T12:00:00.000Z"),
  listStandingsPosts: () => [],
  recordStandingsPost,
  upsertStandingsMessage
});
```

Expected first run posts two messages and records both `groups_a_f` and
`groups_g_l`.

Expected second run with existing stored posts edits both messages.

Expected deleted-message run posts a replacement when the adapter returns a new
message ID for an existing post.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/app/standings-posting.test.ts`

Expected: FAIL because updater module does not exist.

- [ ] **Step 3: Implement updater**

Use `computeGroupStandings` and `createStandingsDashboardMessages`, then call:

```ts
const messageId = await options.upsertStandingsMessage(message, existing?.messageId ?? null);
options.recordStandingsPost({
  postKey: message.key,
  guildId: options.guildId,
  channelId: options.channelId,
  messageId,
  createdAt: existing?.createdAt ?? timestamp,
  updatedAt: timestamp
});
```

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/app/standings-posting.test.ts`

Expected: PASS.

---

## Task 5: Discord Adapter And Commands

**Files:**
- Create: `src/discord/standings-posting.ts`
- Create: `src/discord/standings-posting.test.ts`
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/commands.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `/copanalhas standings` exists in `createCopanalhasCommand().toJSON()`.

Assert `upsertDiscordStandingsMessageWithClient`:

```ts
await upsertDiscordStandingsMessageWithClient(config, payload, "message-1", client)
```

fetches the configured channel, calls `channel.messages.fetch("message-1")`, and
edits with `{ content, embeds }`.

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- src/discord/commands.test.ts src/discord/standings-posting.test.ts
```

Expected: FAIL because command and adapter do not exist.

- [ ] **Step 3: Implement command and adapter**

Add command:

```ts
.addSubcommand((subcommand) =>
  subcommand.setName("standings").setDescription("Post or update group standings")
)
```

Adapter payload:

```ts
{
  content: message.content,
  embeds: message.embeds
}
```

If fetch/edit fails, send a replacement message and return its ID.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- src/discord/commands.test.ts src/discord/standings-posting.test.ts
```

Expected: PASS.

---

## Task 6: Operator And Runtime Integration

**Files:**
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/discord/operator-commands.test.ts`
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/bot-runtime.test.ts`
- Modify: `src/results/sync.ts`

- [ ] **Step 1: Write failing integration tests**

Assert:

```ts
await handleOperatorCommand(command("standings"), options({ updateStandingsDashboard }))
expect(updateStandingsDashboard).toHaveBeenCalled()
```

Assert manual result calls `upsertResult` and then `updateStandingsDashboard`.

Assert status includes:

```text
Standings posts: 2/2
Standings last updated: 2026-06-11T12:00:00.000Z
```

Assert runtime calls standings updater on startup and after result sync returns
at least one stored result.

- [ ] **Step 2: Run RED**

Run:

```powershell
npm test -- src/discord/operator-commands.test.ts src/app/bot-runtime.test.ts
```

Expected: FAIL because the new command and runtime hooks are missing.

- [ ] **Step 3: Implement integration**

Extend `OperatorSubcommand` with `"standings"`.

Add options:

```ts
listStandingsPosts(): StoredStandingsPost[];
updateStandingsDashboard(): Promise<UpdateStandingsDashboardResult>;
```

On manual result success, call `updateStandingsDashboard`.

In runtime, compose `updateStandingsDashboard` with `updateStandingsDashboard(...)`
from `src/app/standings-posting.ts`, call it once after startup, and call it
after `syncFinishedResults(...)` when `storedResults.length > 0`.

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm test -- src/discord/operator-commands.test.ts src/app/bot-runtime.test.ts
```

Expected: PASS.

---

## Task 7: CLI Wiring And Smoke Test

**Files:**
- Modify: `src/index.ts`
- Modify: `src/index.test.ts`

- [ ] **Step 1: Write failing CLI test**

Assert `runCli(["standings-preview"], deps)` prints both dashboard headers after
using simulated first-day results.

- [ ] **Step 2: Run RED**

Run: `npm test -- src/index.test.ts`

Expected: FAIL because `standings-preview` is not implemented.

- [ ] **Step 3: Implement CLI wiring**

Default runtime dependency:

```ts
upsertStandingsMessage:
  dependencies.upsertStandingsMessage ??
  ((message, existingMessageId) =>
    upsertDiscordStandingsMessage(configResult.config, message, existingMessageId))
```

Add `standings-preview` that computes standings from the seed plus simulated
first-day results and writes the two rendered messages to stdout. This command
does not read Discord credentials and does not post to Discord.

- [ ] **Step 4: Run GREEN**

Run: `npm test -- src/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Full verification**

Run:

```powershell
npm test
npm run build
npm run dev -- standings-preview
```

Expected: tests pass, build exits 0, and preview prints `Groups A-F` plus
`Groups G-L`.

---

## Plan Self-Review

- Spec coverage: computation, two-message rendering, storage, edit/post behavior,
  operator command, status, startup/manual/sync update triggers, and smoke
  verification are covered.
- Boundary check: Discord SDK types stay in `src/discord/*`; standings logic and
  formatting stay project-owned and testable without Discord.
- Scope check: official FIFA tie-breakers and knockout advancement remain out of
  scope as the design requires.
