# Bracket Dashboard Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive persistent Discord bracket dashboard that renders a deterministic whole-bracket PNG from reviewed match data and stored final results.

**Architecture:** Keep bracket state, SVG rendering, PNG rasterization, app orchestration, Discord posting, and storage in separate modules. The bracket reads tournament data and results but does not mutate prediction, scoring, standings, leaderboard, parser, or result-sync rules.

**Tech Stack:** TypeScript, Vitest, discord.js 14.26, SQLite via `node:sqlite`, `sharp` for SVG-to-PNG rasterization.

---

## Hard Constraints

- Do not change scoring rules, prediction parsing, leaderboard ranking, standings formatting, result-sync final-result gating, reveal output, or Discord guild/channel filtering.
- Do not weaken, skip, delete, rename, or loosen existing tests to make this feature pass.
- Any unexpected failure in existing parser, scoring, leaderboard, standings, result sync, or Discord filtering tests is a regression until proven otherwise.
- The bracket renderer must be deterministic. Do not use AI image editing or a browser screenshot as the runtime renderer.
- Run `npm test` and `npm run build` before claiming completion.

## File Structure

- Create `src/bracket/types.ts`: project-owned bracket view model types.
- Create `src/bracket/template.ts`: canonical Round of 32 slot template and non-semantic later-round visual skeleton.
- Create `src/bracket/state.ts`: build provisional/final/blocked bracket state from matches and results.
- Create `src/bracket/svg.ts`: pure deterministic SVG renderer.
- Create `src/bracket/png.ts`: `sharp` adapter from SVG string to PNG buffer.
- Create `src/bracket/format.ts`: dashboard message payload creation.
- Create `src/app/bracket-posting.ts`: app-level post/edit/replace orchestration.
- Create `src/discord/bracket-posting.ts`: discord.js edge adapter for message attachment posting.
- Modify `src/storage/database.ts`: add `bracket_posts` storage.
- Modify `src/app/bot-runtime.ts`: refresh bracket dashboard on startup and after result changes.
- Modify `src/app/operator-health.ts`: include bracket dashboard status.
- Modify `src/discord/commands.ts`: add `/copanalhas bracket`.
- Modify `src/discord/operator-commands.ts`: route bracket command and status text.
- Modify `src/app/dev-log.ts`: add bracket dashboard log formatting.
- Modify `src/index.ts`: wire default bracket updater and optional CLI smoke preview if useful.
- Modify `docs/discord-ingestion.md`: document the fourth persistent dashboard and bracket command.
- Modify `package.json` and lockfile: add `sharp`.

## Task 1: Add Bracket Types And Templates

**Files:**
- Create: `src/bracket/types.ts`
- Create: `src/bracket/template.ts`
- Test: `src/bracket/state.test.ts`

- [ ] **Step 1: Write the initial bracket state tests**

```ts
import { describe, expect, test } from "vitest";

import { createBracketState } from "./state.js";
import type { StandingsResult } from "../standings/standings.js";
import type { WorldCupMatch } from "../worldcup/types.js";

describe("createBracketState", () => {
  test("creates a whole bracket skeleton with provisional round-of-32 entrants from incomplete group results", () => {
    const state = createBracketState({
      matches: groupMatches(["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]),
      results: [
        result("A-AB", 1, 0),
        result("B-AB", 2, 0),
        result("C-AB", 3, 0)
      ]
    });

    expect(state.phase).toBe("provisional");
    expect(state.rounds.map((round) => round.key)).toEqual([
      "round_of_32",
      "round_of_16",
      "quarter_finals",
      "semi_finals",
      "final"
    ]);
    expect(state.rounds[0]?.matches).toHaveLength(16);
    expect(state.rounds[0]?.matches[0]?.label).toBe("#73");
    expect(state.rounds[0]?.matches[0]?.home.sourceSlot).toBe("2A");
    expect(state.rounds[0]?.matches[0]?.away.sourceSlot).toBe("2B");
    expect(state.rounds[1]?.matches[0]?.home.label).toBe("W-32-1");
    expect(state.rounds[0]?.matches.some((match) => match.state === "provisional")).toBe(true);
    expect(
      state.rounds[0]?.matches.some(
        (match) => match.home.warning === "tie-order-provisional" || match.away.warning === "tie-order-provisional"
      )
    ).toBe(true);
  });
});

function result(matchId: string, homeScore: number, awayScore: number): StandingsResult {
  return { matchId, homeScore, awayScore };
}

function groupMatches(groups: readonly string[]): WorldCupMatch[] {
  return groups.flatMap((group) => [
    match(`${group}-AB`, group, `${group}1`, `${group}2`, 1),
    match(`${group}-AC`, group, `${group}1`, `${group}3`, 2),
    match(`${group}-AD`, group, `${group}1`, `${group}4`, 3),
    match(`${group}-BC`, group, `${group}2`, `${group}3`, 4),
    match(`${group}-BD`, group, `${group}2`, `${group}4`, 5),
    match(`${group}-CD`, group, `${group}3`, `${group}4`, 6)
  ]);
}

function match(
  id: string,
  group: string,
  homeCode: string,
  awayCode: string,
  offset: number
): WorldCupMatch {
  return {
    id,
    matchNumber: group.charCodeAt(0) * 10 + offset,
    phase: "group",
    group,
    homeTeam: { code: homeCode, name: `${homeCode} Name` },
    awayTeam: { code: awayCode, name: `${awayCode} Name` },
    localDate: "2026-06-11",
    kickoffTimeLocal: "13:00",
    kickoffAtUtc: "2026-06-11T19:00:00.000Z",
    venue: "Test Stadium",
    sourceId: "test-source",
    externalIds: {}
  };
}
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npm test -- src/bracket/state.test.ts`

Expected: FAIL because `src/bracket/state.ts` does not exist.

- [ ] **Step 3: Add bracket type definitions**

```ts
export type BracketPhase = "provisional" | "final" | "blocked";

export type BracketRoundKey =
  | "round_of_32"
  | "round_of_16"
  | "quarter_finals"
  | "semi_finals"
  | "final";

export type BracketMatchState = "provisional" | "scheduled" | "final" | "blocked";

export interface BracketState {
  phase: BracketPhase;
  generatedAtLabel?: string;
  rounds: BracketRound[];
  notes: string[];
}

export interface BracketRound {
  key: BracketRoundKey;
  label: string;
  matches: BracketMatch[];
}

export interface BracketMatch {
  id: string;
  label: string;
  state: BracketMatchState;
  home: BracketEntrant;
  away: BracketEntrant;
  kickoffLabel?: string;
  scoreLabel?: string;
}

export interface BracketEntrant {
  label: string;
  teamCode?: string;
  teamName?: string;
  sourceSlot?: string;
  warning?: "tie-order-provisional";
}
```

- [ ] **Step 4: Add canonical templates**

```ts
import type { BracketRoundKey } from "./types.js";

export type RoundOf32WinnerSlot = "1A" | "1B" | "1D" | "1E" | "1G" | "1I" | "1K" | "1L";

export interface RoundOf32Template {
  matchNumber: number;
  homeSlot: string;
  awaySlot?: string;
  thirdPlaceWinnerSlot?: RoundOf32WinnerSlot;
}

export interface VisualSkeletonRoundTemplate {
  key: BracketRoundKey;
  label: string;
  matchCount: number;
  sourcePrefix: string;
}

export const ROUND_OF_32_TEMPLATES: readonly RoundOf32Template[] = [
  { matchNumber: 73, homeSlot: "2A", awaySlot: "2B" },
  { matchNumber: 74, homeSlot: "1E", thirdPlaceWinnerSlot: "1E" },
  { matchNumber: 75, homeSlot: "1F", awaySlot: "2C" },
  { matchNumber: 76, homeSlot: "1C", awaySlot: "2F" },
  { matchNumber: 77, homeSlot: "1I", thirdPlaceWinnerSlot: "1I" },
  { matchNumber: 78, homeSlot: "2E", awaySlot: "2I" },
  { matchNumber: 79, homeSlot: "1A", thirdPlaceWinnerSlot: "1A" },
  { matchNumber: 80, homeSlot: "1L", thirdPlaceWinnerSlot: "1L" },
  { matchNumber: 81, homeSlot: "1D", thirdPlaceWinnerSlot: "1D" },
  { matchNumber: 82, homeSlot: "1G", thirdPlaceWinnerSlot: "1G" },
  { matchNumber: 83, homeSlot: "2K", awaySlot: "2L" },
  { matchNumber: 84, homeSlot: "1H", awaySlot: "2J" },
  { matchNumber: 85, homeSlot: "1B", thirdPlaceWinnerSlot: "1B" },
  { matchNumber: 86, homeSlot: "1J", awaySlot: "2H" },
  { matchNumber: 87, homeSlot: "1K", thirdPlaceWinnerSlot: "1K" },
  { matchNumber: 88, homeSlot: "2D", awaySlot: "2G" }
];

export const VISUAL_SKELETON_ROUNDS: readonly VisualSkeletonRoundTemplate[] = [
  { key: "round_of_16", label: "Round of 16", matchCount: 8, sourcePrefix: "W-32" },
  { key: "quarter_finals", label: "Quarter-finals", matchCount: 4, sourcePrefix: "W-16" },
  { key: "semi_finals", label: "Semi-finals", matchCount: 2, sourcePrefix: "W-QF" },
  { key: "final", label: "Final", matchCount: 1, sourcePrefix: "W-SF" }
];
```

- [ ] **Step 5: Add the minimal FIFA-slot skeleton state builder**

```ts
import {
  computeFifaGroupStandings,
  resolveAnnexCThirdPlaceAssignments,
  type FifaGroupCode
} from "../worldcup/fifa-qualification.js";
import type { StandingsResult } from "../standings/standings.js";
import type { WorldCupMatch } from "../worldcup/types.js";
import { ROUND_OF_32_TEMPLATES, VISUAL_SKELETON_ROUNDS } from "./template.js";
import type { BracketMatch, BracketRound, BracketState } from "./types.js";

export interface CreateBracketStateOptions {
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
}

export function createBracketState(options: CreateBracketStateOptions): BracketState {
  const groupMatches = options.matches.filter((match) => match.phase === "group");
  const standings = computeFifaGroupStandings(groupMatches, options.results);
  const slotEntrants = new Map<string, BracketMatch["home"]>();

  for (const standing of standings) {
    for (const row of standing.rows.slice(0, 3)) {
      const sourceSlot = `${row.rank}${standing.group}`;

      slotEntrants.set(sourceSlot, {
        label: row.teamCode,
        teamCode: row.teamCode,
        teamName: row.teamName,
        sourceSlot,
        ...(row.tiebreakerStatus === "needs-manual-tiebreaker"
          ? { warning: "tie-order-provisional" as const }
          : {})
      });
    }
  }

  const thirdPlaceRows = standings
    .map((standing) => standing.rows[2])
    .filter((row): row is NonNullable<typeof row> => row !== undefined)
    .toSorted(compareThirdPlaceRows);
  const thirdPlaceCutoffWarning =
    thirdPlaceRows[7] !== undefined &&
    thirdPlaceRows[8] !== undefined &&
    compareThirdPlaceScores(thirdPlaceRows[7], thirdPlaceRows[8]) === 0;
  const thirdPlaceGroups = thirdPlaceRows
    .slice(0, 8)
    .map((row) => row.group as FifaGroupCode);
  const thirdPlaceAssignments =
    thirdPlaceGroups.length === 8
      ? resolveAnnexCThirdPlaceAssignments(thirdPlaceGroups).assignments
      : undefined;

  return {
    phase: "provisional",
    notes: [
      "Round of 32 entrants are provisional until all group results and tiebreakers are resolved.",
      "Later rounds are visual placeholders until reviewed knockout topology is available."
    ],
    rounds: [
      round("round_of_32", "Round of 32", ROUND_OF_32_TEMPLATES.map((template, index) => ({
        id: `r32-${template.matchNumber}`,
        label: `#${template.matchNumber}`,
        state: "provisional",
        home: entrantForSlot(template.homeSlot, slotEntrants, false),
        away: entrantForSlot(
          awaySlotForTemplate(template, thirdPlaceAssignments) || `OPEN-${index + 1}`,
          slotEntrants,
          thirdPlaceCutoffWarning
        )
      }))),
      ...VISUAL_SKELETON_ROUNDS.map((template) =>
        winnerRound(template.key, template.label, template.matchCount, template.sourcePrefix)
      )
    ]
  };
}

function compareThirdPlaceRows(
  left: ReturnType<typeof computeFifaGroupStandings>[number]["rows"][number],
  right: ReturnType<typeof computeFifaGroupStandings>[number]["rows"][number]
): number {
  return compareThirdPlaceScores(left, right) || left.group.localeCompare(right.group);
}

function compareThirdPlaceScores(
  left: ReturnType<typeof computeFifaGroupStandings>[number]["rows"][number],
  right: ReturnType<typeof computeFifaGroupStandings>[number]["rows"][number]
): number {
  return right.points - left.points || right.goalDifference - left.goalDifference || right.goalsFor - left.goalsFor;
}

function awaySlotForTemplate(
  template: (typeof ROUND_OF_32_TEMPLATES)[number],
  thirdPlaceAssignments: ReturnType<typeof resolveAnnexCThirdPlaceAssignments>["assignments"] | undefined
): string {
  if (template.awaySlot) {
    return template.awaySlot;
  }

  if (template.thirdPlaceWinnerSlot && thirdPlaceAssignments) {
    return thirdPlaceAssignments[template.thirdPlaceWinnerSlot];
  }

  return "";
}

function entrantForSlot(
  slot: string,
  slotEntrants: ReadonlyMap<string, BracketMatch["home"]>,
  thirdPlaceCutoffWarning: boolean
): BracketMatch["home"] {
  const entrant = slotEntrants.get(slot) ?? placeholder(slot);

  if (thirdPlaceCutoffWarning && slot.startsWith("3")) {
    return { ...entrant, warning: "tie-order-provisional" };
  }

  return entrant;
}

function round(key: BracketRound["key"], label: string, matches: BracketMatch[]): BracketRound {
  return { key, label, matches };
}

function winnerRound(
  key: BracketRound["key"],
  label: string,
  count: number,
  prefix: string
): BracketRound {
  return round(
    key,
    label,
    Array.from({ length: count }, (_, index) => ({
      id: `${key}-${index + 1}`,
      label: label,
      state: "scheduled",
      home: placeholder(`${prefix}-${index * 2 + 1}`),
      away: placeholder(`${prefix}-${index * 2 + 2}`)
    }))
  );
}

function placeholder(label: string) {
  return { label, sourceSlot: label };
}
```

- [ ] **Step 6: Run the focused test**

Run: `npm test -- src/bracket/state.test.ts`

Expected: PASS.

## Task 2: Final And Blocked Round Of 32 Resolution

**Files:**
- Modify: `src/bracket/state.ts`
- Test: `src/bracket/state.test.ts`

- [ ] **Step 1: Add failing tests for final and blocked state**

Add tests that use `WORLD_CUP_2026_SEED.matches` and proof results from `src/worldcup/fifa-qualification.test.ts` style data. The final-state test should assert match 73 includes `RSA` and `BIH` when all group results are present. The blocked-state test should create a tie that makes `resolveWorldCup2026RoundOf32` throw and assert `state.phase === "blocked"` plus a note containing `manual tiebreaker`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/bracket/state.test.ts`

Expected: FAIL because `createBracketState` always returns provisional.

- [ ] **Step 3: Use existing qualification resolver when safe**

Update `createBracketState` so it:

- checks whether every reviewed group match has a stored result
- calls `resolveWorldCup2026RoundOf32(groupMatches, results)` inside a try/catch when complete
- returns `phase: "final"` with resolved fixtures when the call succeeds
- returns `phase: "blocked"` with placeholder affected slots and a note when the resolver throws because manual tiebreaker data is needed
- keeps provisional behavior when group results are incomplete

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/bracket/state.test.ts`

Expected: PASS.

## Task 3: SVG Renderer

**Files:**
- Create: `src/bracket/svg.ts`
- Test: `src/bracket/svg.test.ts`

- [ ] **Step 1: Write failing SVG renderer tests**

Assert `renderBracketSvg(state)` returns an SVG string that includes:

- `<svg`
- `World Cup 2026 Bracket`
- round labels
- team/placeholders from the state
- `As it stands` for provisional matches
- `tie-order provisional` when entrant warning is present
- Football-Data attribution in the footer
- match labels appearing in state order: `#73` before `#74`, and `#74` before `#75`
- escaped text when team names contain `&`, `<`, or `>`

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npm test -- src/bracket/svg.test.ts`

Expected: FAIL because `src/bracket/svg.ts` does not exist.

- [ ] **Step 3: Implement deterministic SVG rendering**

Create a fixed-size SVG with constants for column width, match height, row gap,
and connector strokes. Use only pure string generation and explicit XML escaping.
Keep layout code private to `svg.ts` and export only this API:

```ts
import type { BracketState } from "./types.js";

export interface RenderBracketSvgOptions {
  title?: string;
}

export function renderBracketSvg(
  state: BracketState,
  options: RenderBracketSvgOptions = {}
): string;
```

The implementation in this step must satisfy the assertions above with real
state-driven SVG content, not a fixed or blank stub.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/bracket/svg.test.ts`

Expected: PASS.

## Task 4: PNG Renderer With Sharp

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/bracket/png.ts`
- Test: `src/bracket/png.test.ts`

- [ ] **Step 1: Add sharp**

Run: `npm install sharp`

Expected: `package.json` and `package-lock.json` update with `sharp`.

- [ ] **Step 2: Write failing PNG renderer test**

Test `renderBracketPng(svg)` returns a Buffer whose first bytes match the PNG signature:

```ts
expect(buffer.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
expect(buffer.length).toBeGreaterThan(1000);
```

- [ ] **Step 3: Implement sharp adapter**

```ts
import sharp from "sharp";

export async function renderBracketPng(svg: string): Promise<Buffer> {
  return sharp(Buffer.from(svg)).png().toBuffer();
}
```

- [ ] **Step 4: Run focused tests**

Run: `npm test -- src/bracket/png.test.ts`

Expected: PASS.

## Task 5: Dashboard Message Formatting

**Files:**
- Create: `src/bracket/format.ts`
- Test: `src/bracket/format.test.ts`

- [ ] **Step 1: Write failing formatter tests**

Assert `createBracketDashboardMessage` returns content with title, timestamp,
phase text, notes, `Football data provided by the Football-Data.org API.`, and
an attachment filename like `copanalhas-bracket.png`.

- [ ] **Step 2: Implement formatter**

Define:

```ts
export interface BracketDashboardMessage {
  content: string;
  embeds: [];
  files: Array<{ attachment: Buffer; name: string }>;
}
```

Create a message from bracket state and PNG buffer. Keep it Discord-SDK-free.
The content must always include `Football data provided by the Football-Data.org API.`

- [ ] **Step 3: Run focused tests**

Run: `npm test -- src/bracket/format.test.ts`

Expected: PASS.

## Task 6: Bracket Post Storage

**Files:**
- Modify: `src/storage/database.ts`
- Test: `src/storage/database.test.ts`

- [ ] **Step 1: Write failing storage test**

Add a test mirroring leaderboard post storage:

```ts
test("records bracket dashboard posts by guild and channel", () => {
  const db = openMemoryDatabase();
  db.recordBracketPost({
    guildId: "guild-1",
    channelId: "channel-1",
    messageId: "bracket-message-1",
    createdAt: "2026-06-11T18:00:00.000Z",
    updatedAt: "2026-06-11T18:00:00.000Z"
  });

  expect(db.listBracketPosts()).toEqual([
    {
      guildId: "guild-1",
      channelId: "channel-1",
      messageId: "bracket-message-1",
      createdAt: "2026-06-11T18:00:00.000Z",
      updatedAt: "2026-06-11T18:00:00.000Z"
    }
  ]);
});
```

- [ ] **Step 2: Run storage test and confirm failure**

Run: `npm test -- src/storage/database.test.ts`

Expected: FAIL because bracket storage methods do not exist.

- [ ] **Step 3: Add `bracket_posts` migration and methods**

Add `StoredBracketPost`, `CREATE TABLE IF NOT EXISTS bracket_posts`, `recordBracketPost`, `listBracketPosts`, and row mapping. Use primary key `(guild_id, channel_id)`.

- [ ] **Step 4: Run storage test**

Run: `npm test -- src/storage/database.test.ts`

Expected: PASS.

## Task 7: App-Level Bracket Updater

**Files:**
- Create: `src/app/bracket-posting.ts`
- Test: `src/app/bracket-posting.test.ts`

- [ ] **Step 1: Write failing app updater tests**

Cover:

- posts and records when no stored bracket post exists
- edits when existing ID is reused
- records `replaced` when upsert returns a different ID
- records a text-only fallback when rendering throws

- [ ] **Step 2: Implement updater**

Define `updateBracketDashboard(options)` with this shape:

```ts
import type { BracketDashboardMessage } from "../bracket/format.js";
import type { StoredBracketPost } from "../storage/database.js";
import type { StandingsResult } from "../standings/standings.js";
import type { WorldCupMatch } from "../worldcup/types.js";

export interface UpdateBracketDashboardOptions {
  guildId: string;
  channelId: string;
  matches: readonly WorldCupMatch[];
  results: readonly StandingsResult[];
  timeZone: string;
  now(): Date;
  listBracketPosts(): StoredBracketPost[];
  recordBracketPost(post: StoredBracketPost): void;
  renderPng(svg: string): Promise<Buffer>;
  upsertBracketMessage(
    message: BracketDashboardMessage,
    existingMessageId: string | null
  ): Promise<string>;
}

export interface UpdateBracketDashboardResult {
  action: "updated";
  post: {
    messageId: string;
    action: "posted" | "edited" | "replaced";
  };
  bracketPhase: "provisional" | "final" | "blocked";
  renderState: "image" | "text-fallback";
  renderError?: string;
}
```

The body should:

1. read the existing bracket post for the configured guild/channel
2. build bracket state from matches and results
3. render SVG
4. call `renderPng(svg)`
5. if rendering throws, format a text-only fallback message with `files: []` and `renderState: "text-fallback"`
6. upsert the Discord message
7. record the message ID with created/updated timestamps
8. return post action, bracket phase, render state, and render error text if any

- [ ] **Step 3: Run focused test**

Run: `npm test -- src/app/bracket-posting.test.ts`

Expected: PASS.

## Task 8: Discord Bracket Adapter

**Files:**
- Create: `src/discord/bracket-posting.ts`
- Test: `src/discord/bracket-posting.test.ts`

- [ ] **Step 1: Write failing Discord adapter tests**

Mirror leaderboard/standings adapter tests and assert payload includes:

- `content`
- `embeds`
- `files`

- [ ] **Step 2: Implement adapter**

Use `Client({ intents: [GatewayIntentBits.Guilds] })`, fetch configured channel,
edit existing message when possible, send replacement otherwise, and destroy the
client in `finally`.

- [ ] **Step 3: Run focused test**

Run: `npm test -- src/discord/bracket-posting.test.ts`

Expected: PASS.

## Task 9: Commands, Runtime Wiring, Logs, And Docs

**Files:**
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/operator-commands.ts`
- Modify: `src/app/bot-runtime.ts`
- Modify: `src/app/operator-health.ts`
- Modify: `src/app/dev-log.ts`
- Modify: `src/index.ts`
- Modify: `docs/discord-ingestion.md`
- Tests: matching existing tests for each modified module

- [ ] **Step 1: Add failing tests for command and status visibility**

Assert `/copanalhas bracket` appears in command JSON, operator command calls the bracket updater, operator-triggered bracket failure returns a private failure reply, status includes bracket dashboard health, and dev logs include bracket post action plus render fallback state.

- [ ] **Step 2: Add failing runtime tests for update triggers**

Assert bracket updater runs on startup, after result sync stores finals, after manual result entry, and after test-date reset clears results. Also assert a thrown bracket updater error is logged or reported but does not prevent existing standings and leaderboard refresh calls from completing in the same runtime path.

- [ ] **Step 3: Implement command, status, runtime, and docs wiring**

Follow the existing standings/leaderboard dependency-injection style. Do not
move scoring, parser, or leaderboard behavior.

- [ ] **Step 4: Run focused tests**

Run focused tests for modified modules, for example:

```powershell
npm test -- src/discord/commands.test.ts src/discord/operator-commands.test.ts src/app/bot-runtime.test.ts src/app/operator-health.test.ts src/app/dev-log.test.ts src/index.test.ts
```

Expected: PASS.

## Task 10: Regression Gate

**Files:**
- All touched files

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: PASS. Existing parser, scoring, leaderboard, standings, result sync,
and Discord filtering tests remain collected and passing.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Inspect changed files**

Run: `git status --short`

Expected: only bracket feature files, intended package files, and intended docs
are modified. No unrelated user changes are reverted.

- [ ] **Step 4: Commit coherent slices**

Use focused commits such as:

```powershell
git add src/bracket src/storage/database.ts src/storage/database.test.ts
git commit -m "feat: model bracket dashboard state"
git add src/app src/discord src/index.ts docs/discord-ingestion.md package.json package-lock.json
git commit -m "feat: post bracket dashboard image"
```

Only commit after tests and build pass.

## Self-Review

- Spec coverage: The tasks cover bracket state, provisional/final/blocked behavior, SVG rendering, PNG rasterization, Discord posting, storage, command/status/runtime wiring, docs, and regression gates.
- Placeholder scan: The plan intentionally leaves visual implementation details inside `svg.ts` to the implementer but specifies the exported API and required assertions. There are no TODO/TBD placeholders.
- Type consistency: The plan consistently uses `BracketState`, `BracketDashboardMessage`, `StoredBracketPost`, and `updateBracketDashboard`.
