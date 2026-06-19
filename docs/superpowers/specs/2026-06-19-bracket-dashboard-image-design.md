# Bracket Dashboard Image Design

## Goal

Add a persistent public Discord dashboard message for the FIFA World Cup 2026
knockout bracket. The message should be edited in place after tournament result
data changes and should display a deterministic PNG image generated from
repo-owned match data, not from AI image editing.

This is a new presentation feature. Existing standings tables, leaderboard
rules, prediction parsing, prediction cutoff behavior, scoring, result sync
gating, and reveal output must not regress.

## Non-Regression Contract

The implementation must be additive.

It must not weaken, skip, rewrite, or delete existing tests to make the new
feature pass. Existing tests for prediction parsing, scoring, leaderboard
ranking, standings output, Discord filtering, result sync, and storage behavior
remain authoritative. If a test failure appears outside the bracket feature, the
implementer must treat it as a regression until proven otherwise.

The bracket feature may read reviewed match data and stored final results. It
must not change how predictions are accepted, how match scores are scored, how
leaderboard rows are ranked, or how standings tables are rendered.

## Discord Surface

The bot maintains a fourth persistent dashboard message in the configured
channel:

- `World Cup 2026 Bracket`

The current public dashboards remain:

- `World Cup 2026 Group Standings, Groups A-F`
- `World Cup 2026 Group Standings, Groups G-L`
- `Copanalhas Leaderboard`

The bracket dashboard should mirror the standings and leaderboard lifecycle:

1. find the stored dashboard message for the configured guild and channel
2. edit it in place when possible
3. post a replacement and store the new message ID if the old message is missing
4. report post/edit/replace state through status/log output

The message payload should include a short textual fallback plus the generated
PNG attachment. The text should identify the dashboard, the update timestamp,
the bracket confidence state, and the visible attribution required by the data
source policy:

```text
Football data provided by the Football-Data.org API.
```

The PNG should also include a small footer with the same attribution when any
synced results may be represented. If image rendering fails, the bot should
still post or edit a truthful text-only fallback with the attribution and should
report the render failure without blocking standings, leaderboard, result sync,
or scoring.

## Bracket State

The bracket state builder consumes:

- reviewed local World Cup seed matches
- stored final results
- current time zone formatting for display only

During group stage, the builder should compute current FIFA-style group
standings and build provisional `as it stands` Round of 32 slots. These slots
must be visibly labeled as provisional in the rendered image and fallback text.
If a displayed provisional entrant depends on a tie that the current standings
code marks as `needs-manual-tiebreaker`, the slot may still show the current
deterministic ordering, but it must carry an additional visible tie warning such
as `tie-order provisional`. This keeps the dashboard useful without presenting
the deterministic fallback as official FIFA qualification.

The same rule applies to the provisional eighth-best third-place cutoff. Before
all group results are complete, the builder may use the current deterministic
third-place ranking to choose the eight provisional third-place groups for
Annexe C mapping. If the current 8th and 9th third-place rows are tied on the
ranking scores used by the code, every Round of 32 slot that receives a
third-place entrant through that provisional Annexe C mapping must carry
`tie-order provisional`. Do not silently render those third-place entrants as
ordinary provisional slots.

Once all group results are stored and qualification can be resolved without
manual tiebreaker data, the builder should use the existing
`resolveWorldCup2026RoundOf32` logic. Those Round of 32 slots become final.

If all group results are complete but qualification cannot be resolved because a
group or the eighth-best third-place cutoff needs manual tiebreaker data, the
affected slots become blocked placeholders. The dashboard should explain the
state instead of guessing.

The Round of 32 slot template must match the existing FIFA resolver:

```text
73: 2A vs 2B
74: 1E vs Annexe-C third-place slot for 1E
75: 1F vs 2C
76: 1C vs 2F
77: 1I vs Annexe-C third-place slot for 1I
78: 2E vs 2I
79: 1A vs Annexe-C third-place slot for 1A
80: 1L vs Annexe-C third-place slot for 1L
81: 1D vs Annexe-C third-place slot for 1D
82: 1G vs Annexe-C third-place slot for 1G
83: 2K vs 2L
84: 1H vs 2J
85: 1B vs Annexe-C third-place slot for 1B
86: 1J vs 2H
87: 1K vs Annexe-C third-place slot for 1K
88: 2D vs 2G
```

Later knockout rounds are represented as a whole skeleton from the start. Until
their teams can be derived from reviewed knockout fixture topology and stored
knockout results, they show explicitly non-semantic visual placeholders such as
`W-32-1`, `W-16-1`, `W-QF-1`, and `W-SF-1`. V1 must not invent official
advancement wiring for later rounds. Either consume reviewed knockout topology
if it exists at implementation time, or label the later-round skeleton as a
visual placeholder until that topology is reviewed and imported.

## Renderer

The renderer should be deterministic:

```text
Bracket state -> SVG string -> PNG buffer
```

Use a fixed SVG layout and rasterize it with `sharp`. Do not use LLM image
generation, screenshots as the runtime renderer, or manually edited bitmap
assets. The same input state must produce equivalent output every time.

### Visual Amendment - 2026-06-19

The first full-skeleton rendering proved too hard to read in Discord. Until
reviewed knockout topology is imported and there is useful later-round state to
show, the production image should focus on the Round of 32 only. Render the
sixteen Round of 32 fixtures as two large, readable halves:

- left half: fixtures whose winners feed the path toward semi-final #101
- right half: fixtures whose winners feed the path toward semi-final #102

Within each half, order fixture pairs by the reviewed FIFA winner path:

```text
Left:  #74/#77 -> #89, #73/#75 -> #90, #83/#84 -> #93, #81/#82 -> #94
Right: #76/#78 -> #91, #79/#80 -> #92, #86/#88 -> #95, #85/#87 -> #96
```

The image should use Portuguese team display names and deterministic vector flag
markers instead of emoji flags, because the `sharp` rasterization path does not
reliably render emoji flag glyphs as flags.

The original whole-skeleton shape remains a future extension. When implemented,
it must be based on reviewed knockout topology and should not reintroduce
unreadable placeholder columns.

The full-bracket image, when that future extension exists, should show:

- Round of 32
- Round of 16
- Quarter-finals
- Semi-finals
- Final

Each match box should include:

- match label or match number when known
- two entrants, either team code/name or winner placeholders
- scheduled date/time when known
- result when known
- visible state text such as provisional, scheduled, final, or blocked
- tie-order warning when a provisional slot depends on unresolved tiebreaker
  ordering

The first implementation may favor team codes and compact labels over full flag
art if reliable flag assets are not already available. Missing flags or media
assets must not block the bracket image.

## Storage

Add a dedicated bracket dashboard post record scoped by guild and channel. The
simplest shape mirrors `leaderboard_posts`:

```text
bracket_posts
- guild_id
- channel_id
- message_id
- created_at
- updated_at
```

The record is only for the Discord dashboard message ID. It must not store
derived points, predictions, bracket winners, or other state that should remain
recomputed from source data.

## Update Flow

The bracket dashboard should refresh when:

- the bot starts
- automatic result sync stores at least one new final result
- an operator records or changes a result manually
- an operator runs `/copanalhas bracket`
- test-date reset clears results for affected matches

The update path should:

1. load reviewed matches
2. load stored results
3. build bracket state
4. render SVG and PNG
5. upsert the Discord dashboard message
6. store the current message ID and updated timestamp
7. log the post action and render state

Bracket refresh failure should not prevent existing standings and leaderboard
refreshes from running. Operator-triggered failures should return a private
operator reply.

## Operator Controls And Status

Add `/copanalhas bracket` as an operator command that posts or updates the
bracket dashboard.

Extend `/copanalhas status` with bracket dashboard health:

- whether the bracket post exists
- last updated timestamp
- last bracket state, when available from runtime state

The existing `/copanalhas leaderboard` command and public leaderboard dashboard
must not change.

## Testing

Use unit tests without live Discord or network dependencies.

Required coverage:

- provisional Round of 32 state from incomplete group results
- final Round of 32 state using existing FIFA qualification resolution
- blocked/manual-tiebreaker state when qualification cannot be safely resolved
- FIFA-slot-accurate provisional Round of 32 mapping
- placeholder propagation into later rounds
- visible Football-Data attribution in fallback content and image footer
- SVG renderer emits expected labels, match ordering, and state markers
- PNG renderer returns a non-empty PNG buffer from known SVG
- bracket post storage records and lists persistent message IDs
- app updater posts, edits, and replaces bracket dashboard messages
- Discord adapter sends attachments and replaces missing messages
- runtime refreshes bracket after startup, result sync storage, manual result
  entry, and test-date reset
- `/copanalhas bracket` command routing
- `/copanalhas status` includes bracket health

Required regression gates:

- `npm test`
- `npm run build`

Existing tests must remain collected and passing. The implementer must not use
`.only`, `xit`, skipped tests, loosened assertions, or deleted tests as a way to
complete this feature.

## Scope Boundaries

This design does not change scoring rules, prediction parsing, leaderboard
formatting, standings table formatting, result-source trust rules, Discord
guild/channel scope, or raw-message storage policy.

This design does not introduce a Discord Activity, hosted web dashboard, live
browser screenshot renderer, AI image editing, multi-guild support, or a new
World Cup data source.

Full knockout advancement beyond placeholders can be added later when knockout
fixtures/results are present in repo-owned tournament data.
