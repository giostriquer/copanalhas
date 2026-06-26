# Knockout Prediction Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add knockout-only scoring with regular-time, extra-time, penalties, and a stacked decision-method bonus while preserving current group-stage behavior.

**Architecture:** Keep scoring pure in `src/scoring/scoring.ts`, keep Discord objects at the edge in `src/discord`, and keep stored data recomputable in `src/storage/database.ts`. Add nullable prediction decision-method data and nullable detailed knockout result fields while leaving `homeScore`/`awayScore` as the compatibility final-score fields used by standings, bracket, alerts, and existing dashboards.

**Tech Stack:** TypeScript, Node.js SQLite, Vitest, discord.js modal components, Football-Data v4 score payloads.

---

## File Structure

- Modify `src/scoring/scoring.ts`: add decision-method types, rich match result support, knockout scoring branch, bonus award, and leaderboard bonus aggregation.
- Modify `src/scoring/scoring.test.ts`: prove group rules stay unchanged and cover knockout tiers and bonus stacking.
- Modify `src/storage/database.ts`: migrate `predictions` and `results` with nullable knockout columns and round-trip them.
- Modify `src/storage/database.test.ts`: verify old and new prediction/result rows remain readable.
- Modify `src/discord/components.ts`: add knockout-only decision dropdown to prediction modals.
- Modify `src/discord/interactions.ts`: read dropdown values for knockout submissions and preserve nullable values for groups.
- Modify `src/discord/interactions.test.ts`: assert group modal remains score-only and knockout modal stores/pre-fills decision method.
- Modify `src/predictions/locked-reveal.ts`: show decision method on locked/result reveal lines and score knockout result reveals with rich result data.
- Modify `src/predictions/locked-reveal.test.ts`: cover grouped reveal formatting with decision method and result points.
- Modify `src/results/football-data.ts`: parse `score.duration`, `score.regularTime`, `score.extraTime`, `score.penalties`, and `score.winner`.
- Modify `src/results/football-data.test.ts`: cover regular, extra-time, penalty, and incomplete knockout provider payloads.
- Modify `src/results/sync.ts`: store rich knockout details only when enough provider detail exists; skip incomplete knockout detail.
- Modify `src/results/sync.test.ts`: assert provider skips incomplete knockout detail and stores complete detail.
- Modify `src/discord/commands.ts` and `src/discord/operator-commands.ts`: add optional manual result detail fields for knockout recovery.
- Modify `src/discord/operator-commands.test.ts`: cover manual knockout result entry.
- Modify `src/leaderboard/format.ts`, `src/leaderboard/svg.ts`, and tests: include decision bonus category without changing tie-breaker priority.
- Modify `docs/scoring-rules.md`, `docs/discord-ingestion.md`, and `docs/data-sources.md`: document knockout-only rules and provider detail handling.

---

### Task 1: Scoring Model

**Files:**
- Modify: `src/scoring/scoring.ts`
- Test: `src/scoring/scoring.test.ts`

- [ ] **Step 1: Write failing scoring tests**

Add tests that call `scoreMatch` with group-compatible results and rich knockout results:

```ts
expect(scoreMatch({ matchId: "group-1", homeScore: 2, awayScore: 1 }, [
  prediction("u1", "group-1", 2, 1),
  prediction("u2", "group-1", 1, 1)
])).toMatchObject([{ userId: "u1", points: 5, awards: ["solo"] }]);

expect(pointsByUser(scoreMatch({
  matchId: "ko-1",
  phase: "round_of_32",
  homeScore: 2,
  awayScore: 1,
  decisionMethod: "regular",
  regularTime: { homeScore: 2, awayScore: 1 }
}, [
  prediction("u1", "ko-1", 2, 1, "regular"),
  prediction("u2", "ko-1", 3, 2, "regular")
]))).toEqual({ u1: 7, u2: 2 });
```

Also add tests for shared regular exact, extra-time exact, no result or closest-score points after extra time/penalties, regular-time result and closest-score points, wrong bonus receiving 0, and leaderboard bonus aggregation.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/scoring/scoring.test.ts`

Expected: fails because `decisionMethod`, `phase`, and the new `decisionBonus` award/category do not exist.

- [ ] **Step 3: Implement scoring types and group fallback**

Add:

```ts
export type DecisionMethod = "regular" | "extra_time" | "penalties";
export type ScoreAward = "solo" | "exact" | "outcome" | "closest" | "decision_bonus";
export type MatchPhaseForScoring = "group" | "round_of_32" | "round_of_16" | "quarter_final" | "semi_final" | "third_place" | "final";
```

Extend `MatchResult`, `ScorePrediction`, `ScoredPrediction`, and `LeaderboardRow` with optional knockout fields and `decisionBonusCount`. Route `phase === "group"` or missing `phase` through the existing group scoring behavior.

- [ ] **Step 4: Implement knockout scoring**

For knockout results, compute:

1. regular-time exact: solo 5 or shared exact 3
2. if no regular exact, extra-time exact 3
3. no result, closest-score, or advancement-side points after extra time/penalties when no exact phase hit
4. regular-time knockout finishes reuse the normal result and closest-score tiers
5. decision-method bonus 2 independently when prediction decision equals result decision

Set `distance` against the score layer that was considered for exact scoring, or the compatibility final score when no layer exists.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/scoring/scoring.test.ts`

Expected: all scoring tests pass.

---

### Task 2: Storage Migration

**Files:**
- Modify: `src/storage/database.ts`
- Test: `src/storage/database.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add tests that:

```ts
store.upsertPrediction({
  userId: "user-1",
  matchId: "wc2026-073",
  messageId: "interaction-1",
  homeScore: 1,
  awayScore: 1,
  decisionMethod: "penalties",
  submittedAt: "2026-06-29T12:00:00.000Z",
  updatedAt: null,
  parserVersion: "prediction-modal-v2"
});

store.upsertResult({
  matchId: "wc2026-073",
  homeScore: 5,
  awayScore: 4,
  decisionMethod: "penalties",
  regularTimeHomeScore: 1,
  regularTimeAwayScore: 1,
  extraTimeHomeScore: 1,
  extraTimeAwayScore: 1,
  penaltyHomeScore: 4,
  penaltyAwayScore: 3,
  winner: "home",
  recordedAt: "2026-06-29T23:00:00.000Z",
  resultSource: "manual",
  externalMatchId: null,
  fetchedAt: null
});
```

Expect `listPredictions()` and `listResults()` to return the same nullable fields, and existing old-style rows to return `decisionMethod: null`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/storage/database.test.ts`

Expected: fails because the schema and TypeScript interfaces do not contain the new fields.

- [ ] **Step 3: Add columns and round-trip mapping**

Add nullable columns:

```sql
predictions.decision_method TEXT
results.decision_method TEXT
results.regular_time_home_score INTEGER
results.regular_time_away_score INTEGER
results.extra_time_home_score INTEGER
results.extra_time_away_score INTEGER
results.penalty_home_score INTEGER
results.penalty_away_score INTEGER
results.winner TEXT
```

Use `ensureColumn` for migrations and preserve existing `home_score`/`away_score`.

- [ ] **Step 4: Run storage tests**

Run: `npm test -- src/storage/database.test.ts`

Expected: storage tests pass.

---

### Task 3: Discord Prediction Modal

**Files:**
- Modify: `src/discord/components.ts`
- Modify: `src/discord/interactions.ts`
- Test: `src/discord/interactions.test.ts`

- [ ] **Step 1: Write failing Discord interaction tests**

Add tests that:

```ts
const knockout = { ...firstSeedKnockoutMatch(), phase: "round_of_32", group: null };
const modal = vi.mocked(interaction.showModal).mock.calls[0]?.[0].toJSON();
expect(JSON.stringify(modal)).toContain("Tempo regulamentar");
expect(JSON.stringify(modal)).toContain("Prorrogação");
expect(JSON.stringify(modal)).toContain("Cobrança de pênaltis");
```

Also assert group modal JSON does not contain the dropdown, and a knockout modal submit stores `decisionMethod: "penalties"`.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/discord/interactions.test.ts`

Expected: fails because the modal has only text inputs and the interaction adapter reads only text fields.

- [ ] **Step 3: Add dropdown builders**

Use `LabelBuilder` and `StringSelectMenuBuilder` from `discord.js` for knockout modals. Export `decisionMethodSelectCustomId` and decision labels from `src/discord/components.ts`.

- [ ] **Step 4: Read dropdown values**

Extend `PredictionModalSubmitInteraction` with:

```ts
getStringSelectValues?(customId: string): readonly string[];
```

For Discord modal submissions, map `interaction.fields.getStringSelectValues(customId)`. Require a valid decision method only when `match.phase !== "group"`.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/discord/interactions.test.ts`

Expected: Discord interaction tests pass.

---

### Task 4: Provider And Result Sync

**Files:**
- Modify: `src/results/football-data.ts`
- Modify: `src/results/sync.ts`
- Test: `src/results/football-data.test.ts`
- Test: `src/results/sync.test.ts`

- [ ] **Step 1: Write failing provider tests**

Add parser tests for:

```ts
score: {
  winner: "HOME_TEAM",
  duration: "PENALTY_SHOOTOUT",
  fullTime: { home: 6, away: 5 },
  regularTime: { home: 1, away: 1 },
  extraTime: { home: 0, away: 0 },
  penalties: { home: 5, away: 4 }
}
```

Expect `decisionMethod: "penalties"`, `winner: "home"`, regular-time `1-1`, extra-time final `1-1`, penalties `5-4`, and compatibility final `6-5`.

- [ ] **Step 2: Write failing sync tests**

For a knockout match with `duration: "PENALTY_SHOOTOUT"` and missing `regularTime`, expect skip reason `missing-knockout-detail`. For complete detail, expect `upsertResult` receives all rich knockout fields.

- [ ] **Step 3: Implement parser**

Parse Football-Data `score.duration` values:

- `REGULAR` -> `regular`
- `EXTRA_TIME` -> `extra_time`
- `PENALTY_SHOOTOUT` -> `penalties`

Compute extra-time final as regular-time score plus extra-time goals when both are available. Leave fields null when provider values are missing.

- [ ] **Step 4: Implement sync storage guard**

In `resultFromProviderMatch`, require rich detail only for `localMatch.phase !== "group"` and provider decision method is not regular. Return skip reason `missing-knockout-detail` when needed. Keep group result sync behavior unchanged.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/results/football-data.test.ts src/results/sync.test.ts`

Expected: provider and sync tests pass.

---

### Task 5: Manual Result Recovery

**Files:**
- Modify: `src/discord/commands.ts`
- Modify: `src/discord/operator-commands.ts`
- Test: `src/discord/operator-commands.test.ts`

- [ ] **Step 1: Write failing command tests**

Add a test for `/copanalhas result` on a knockout match with options:

```text
score: 5-4
decision: penalties
regular-score: 1-1
extra-score: 1-1
penalties-score: 4-3
winner: home
```

Expect `upsertResult` to include the rich fields and all dashboards/reveal refreshes to run.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/discord/operator-commands.test.ts`

Expected: fails because result options are not registered or parsed.

- [ ] **Step 3: Register optional result detail options**

Add optional string choices to the `result` subcommand:

- `decision`: `regular`, `extra_time`, `penalties`
- `regular-score`
- `extra-score`
- `penalties-score`
- `winner`: `home`, `away`

Keep `score` required and backwards compatible.

- [ ] **Step 4: Parse and validate manual detail**

For group matches, ignore absent optional detail and keep existing behavior. For knockout matches, store provided detail; reject invalid optional scores with explicit private messages.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/discord/operator-commands.test.ts`

Expected: operator command tests pass.

---

### Task 6: Reveals And Leaderboards

**Files:**
- Modify: `src/predictions/locked-reveal.ts`
- Modify: `src/leaderboard/format.ts`
- Modify: `src/leaderboard/svg.ts`
- Test: `src/predictions/locked-reveal.test.ts`
- Test: `src/leaderboard/format.test.ts`

- [ ] **Step 1: Write failing output tests**

Add reveal expectations such as:

```text
<@user-1>  1x1 (Pênaltis) - 5 pts
```

Add leaderboard text and SVG expectations for a `Metodo` or compact `Bonus` column once at least one row has a decision bonus.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- src/predictions/locked-reveal.test.ts src/leaderboard/format.test.ts`

Expected: fails because bonus data is not formatted.

- [ ] **Step 3: Implement reveal labels**

Append decision-method labels only when `prediction.decisionMethod` is non-null. Use short labels in result lines to keep thread messages compact:

- `Tempo regulamentar`
- `Prorrogação`
- `Pênaltis`

- [ ] **Step 4: Implement leaderboard bonus display**

Add `decisionBonusCount` to text fallback and dashboard SVG. Keep ranking tie checks based on points, solo, exact, result, closest, then user ID; do not add bonus as a tie-breaker.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- src/predictions/locked-reveal.test.ts src/leaderboard/format.test.ts`

Expected: output tests pass.

---

### Task 7: Docs And Full Verification

**Files:**
- Modify: `docs/scoring-rules.md`
- Modify: `docs/discord-ingestion.md`
- Modify: `docs/data-sources.md`

- [ ] **Step 1: Update docs**

Document knockout-only scoring, decision-method dropdown, manual result recovery, and provider skip behavior for incomplete knockout detail.

- [ ] **Step 2: Run full verification**

Run:

```text
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit implementation**

Run:

```text
git status --short
git add src docs
git commit -m "feat: add knockout prediction scoring"
```

- [ ] **Step 4: Push main**

Run:

```text
git push origin main
```

Expected: `main` with the spec commit and implementation commit is pushed to `origin/main`.
