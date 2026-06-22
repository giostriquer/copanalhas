# Painel do Caos Dashboard Design

## Goal

Add a permanent Discord image dashboard that summarizes Copanalhas prediction
chaos with a fun, roast-friendly tone. The dashboard should make the group easy
to compare week by week while still being grounded in real prediction and
scoring data.

The dashboard is called:

- `Painel do Caos`

It is a presentation feature. It must not change prediction acceptance,
prediction cutoff behavior, scoring rules, result sync gating, reveal messages,
leaderboard ranking, standings rendering, bracket rendering, or data-source
trust rules.

## Product Shape

The bot maintains one persistent Discord message in the configured guild and
channel. The message is edited in place and contains a generated PNG dashboard
plus a short textual fallback.

The dashboard covers:

- current all-time state so far in the tournament
- current calendar-week movement
- people-focused awards
- match-focused chaos stats

The tone should be `modo caos`: playful roasting is allowed, including public
callouts for terrible streaks, wrong consensus picks, overconfident misses, and
statistical shame. The stats must still be deterministic and explainable so the
joke feels earned.

The footer should keep the game context clear:

```text
Zoeira estatistica. Sem apostas, sem dinheiro, so vergonha publica.
```

## Non-Regression Contract

The implementation must be additive.

It must not weaken, skip, rewrite, or delete existing tests to make the new
feature pass. Existing tests for prediction parsing, scoring, leaderboard
ranking, standings output, bracket output, Discord filtering, result sync,
storage behavior, and reveal rendering remain authoritative. If a test failure
appears outside the chaos dashboard feature, the implementer must treat it as a
regression until proven otherwise.

The chaos dashboard may read predictions, reviewed match data, stored final
results, scoring output, and display names. It must not change how those
records are written or how official game points are computed.

## Discord Surface

The bot maintains an additional persistent dashboard message alongside the
existing public dashboards:

- `World Cup 2026 Group Standings, Groups A-F`
- `World Cup 2026 Group Standings, Groups G-L`
- `Copanalhas Leaderboard`
- `Copa do Mundo 2026 - Mata-mata`
- `Painel do Caos`

The lifecycle should mirror the other dashboards:

1. find the stored dashboard message for the configured guild and channel
2. edit it in place when possible
3. post a replacement and store the new message ID if the old message is missing
4. log post/edit/replace state with timestamped bot logs

The textual fallback should identify the dashboard, updated timestamp, week
range, scored match count, prediction count, and a short status if the image
render fails. Image render failure must not block standings, leaderboard,
bracket, result sync, or scoring.

## Architecture

Keep the feature split across the same boundaries used by existing dashboards.

### Stats Builder

Add a pure stats builder that consumes:

- reviewed World Cup matches
- stored predictions
- stored final results
- scored prediction rows or equivalent scoring output
- current leaderboard rows
- display-name map
- configured local timezone
- current clock
- optional weekly snapshot

It returns a `PainelDoCaosModel` or equivalent presentation model. The builder
must not import Discord SDK types, mutate storage, call provider APIs, or render
images.

### Weekly Snapshot Store

Add lightweight persistence for calendar-week leaderboard baselines. A snapshot
represents the standings at the start of a configured local calendar week and
lets the dashboard calculate movement such as `+3 posicoes` or `caiu 5`.

The week should be based on the bot's configured local timezone. A calendar week
starts Monday at `00:00:00` and ends before the next Monday at `00:00:00`.

The snapshot should store derived leaderboard state only:

- week start date
- guild ID
- channel ID
- user ID
- rank
- points
- scoring category totals
- generated timestamp

Do not store raw Discord message content, raw private channel history, or
provider secrets.

### Image Renderer

Render deterministically:

```text
PainelDoCaosModel -> SVG string -> PNG buffer
```

Use the repo's existing deterministic image-rendering approach from the bracket
dashboard where possible. Do not use AI-generated images, live browser
screenshots, or manually edited bitmap assets as the runtime renderer.

### Discord Posting Service

Add a small app service that loads the data, builds the model, renders the PNG,
and upserts the Discord dashboard message. Keep Discord adapter code separate
from stats and rendering logic.

### Operator Command

Add an operator command to force a refresh, preferably:

- `/copanalhas copanalhas-recap-painel`

The command should privately report whether the dashboard was posted, edited,
replaced, or failed to render.

## Dashboard Content

The image should prioritize fast visual scanning over dense analytics. A viewer
should understand who is winning, who got cooked, and which match caused the
most chaos within a few seconds.

### Header

Show:

- `Painel do Caos`
- updated timestamp in local time
- current calendar-week range
- scored matches counted
- predictions counted

### Main Scoreboard

Show the top five overall leaderboard rows:

```text
Nome | Pts | Solo | Exato | Resultado | Perto
```

Use the same scoring category meanings as the official leaderboard:

- Solo: exact score hit by only one person
- Exato: exact score hit by multiple people
- Resultado: correct winner or draw when nobody hit exact
- Perto: closest score when nobody hit exact or result

### Sobe E Desce Da Semana

Show the biggest weekly climbers and fallers compared with the stored snapshot
for the current calendar week.

If no weekly snapshot exists yet, show a graceful state:

```text
Sem historico semanal ainda.
```

If a user did not exist in the snapshot, treat them as new for movement display
instead of manufacturing a fake previous rank.

### Premios Da Zoacao

Render a rotating or fixed set of award tiles. V1 should prefer fixed awards so
tests and user expectations are stable.

Recommended people awards:

- `Profeta isolado`: most solo exacts
- `Exatinho de condominio`: most exacts that were shared with other people
- `Quase inteligente`: most close-score awards
- `Cientista do empate`: most draw predictions
- `Inimigo do obvio`: most wrong outcomes among active users
- `Mao de alface estatistica`: worst average total goal-difference error among
  active users
- `Cravou nada, falou tudo`: most zero-point predictions among active users
- `Teto solar aberto`: highest average total goals predicted among active users

For negative awards, apply an activity threshold so one isolated bad prediction
does not create a permanent roast. V1 should use at least five finished
predictions for active-user negative awards unless the implementation finds an
existing stronger project convention.

Award tiles may include short roast subtitles, but the number behind the award
must be visible.

### Caos Dos Jogos

Render match-focused chaos stats:

- `Jogo do caos`: finished match with the highest prediction spread
- `Consenso burro`: match where the most popular predicted outcome was wrong
- `Ninguem viu essa bomba`: finished match with no exact scorer and high average
  prediction error
- `Bonde do mesmo placar`: largest group of users with the same exact
  prediction for one match
- `Mesa dos profetas`: match with the most exact scorers

Each match tile should show the match label, Portuguese team names, final score
when available, and the relevant stat value.

## Stat Definitions

All stats must be derived from stored predictions and stored final results. Live,
partial, paused, suspended, or incomplete provider scores must not be used.

### Prediction Outcome

For a prediction and final result:

- exact: predicted home goals and away goals equal the final score
- outcome: predicted winner/draw equals final winner/draw
- total goal-difference error: `abs(predHome - finalHome) + abs(predAway - finalAway)`

### Prediction Spread

V1 can define match prediction spread as the average pairwise distance between
all submitted score predictions for that match, where distance is:

```text
abs(a.home - b.home) + abs(a.away - b.away)
```

If pairwise spread becomes too expensive, the implementation may use distance
from the mean predicted score, but the chosen formula must be documented in the
implementation plan and covered by tests.

### Consensus Failure

For each finished match, group predictions by outcome:

- home win
- draw
- away win

If the most common predicted outcome differs from the final outcome, the match
is eligible for `Consenso burro`. Rank eligible matches by number of users in
the wrong consensus group, then by share of total predictions.

### Zero-Point Predictions

Count finished predictions that received no official scoring award. This should
be computed from the same scoring output used by the official leaderboard, not
from a duplicate scoring implementation.

## Empty And Early States

The dashboard should degrade gracefully.

Before any results are stored:

- show prediction participation
- show copied score and high-goal prediction stats if predictions exist
- hide scoring-based awards or show `aguardando resultados`

After some results are stored:

- unlock scoring awards for finished matches
- keep unfinished matches out of final-result stats

At the start of a new week:

- create or reuse the week baseline
- show `sem historico semanal ainda` until movement can be compared

If there are no predictions yet:

- render a non-empty dashboard with an empty-state joke and operational footer

## Visual Direction

The PNG should feel like a loud sports recap board, not a spreadsheet.

Recommended layout:

- wide PNG sized for readable Discord preview
- header band with title, timestamp, week range, and totals
- left column for real competition state: top five and weekly movers
- center column for `Premios da Zoacao`
- right column for `Caos dos Jogos`
- bottom strip with the game disclaimer

Use Portuguese labels and Portuguese team display names. Use Discord display
names for users, truncated cleanly when needed. Make the visual distinct from
the bracket image: higher contrast, more color, stronger section titles, and
clear award tiles.

The renderer should avoid tiny text, low-contrast red/yellow combinations, and
dense tables that cannot be read from Discord's image preview.

## Update Flow

Refresh the dashboard when:

- the bot starts
- automatic result sync stores at least one new final result
- an operator records or changes a result manually
- an operator runs `/copanalhas copanalhas-recap-painel`
- prediction interactions change participation stats, if implementation can
  debounce image updates safely

The update path should:

1. load reviewed matches
2. load predictions
3. load stored final results
4. compute official scoring output
5. load or create the current weekly baseline
6. build the chaos dashboard model
7. render SVG and PNG
8. upsert the Discord dashboard message
9. store the current message ID and updated timestamp
10. log the post action and render state

Prediction-triggered refreshes are optional for V1. If included, they should be
debounced so a burst of predictions does not cause excessive image rendering or
Discord edits.

## Storage

Add a dedicated dashboard post record scoped by guild and channel. The simplest
shape mirrors existing persistent dashboard post tables:

```text
chaos_dashboard_posts
- guild_id
- channel_id
- message_id
- created_at
- updated_at
```

Add a weekly snapshot table for rank movement:

```text
chaos_weekly_snapshots
- week_start
- guild_id
- channel_id
- user_id
- rank
- points
- solo_awards
- exact_awards
- outcome_awards
- closest_awards
- created_at
```

The post table stores only the Discord message pointer. The snapshot table
stores only derived leaderboard state needed for movement calculations.

## Operator Controls And Status

Add `/copanalhas copanalhas-recap-painel` to post or update the dashboard.

Extend `/copanalhas status` with chaos dashboard health:

- whether the dashboard post exists
- last updated timestamp
- current week baseline state, if available from runtime/storage
- last render failure, if tracked by runtime state

The existing leaderboard, standings, bracket, prediction reveal, and result sync
commands must keep their behavior.

## Error Handling

- Missing dashboard post ID: post the dashboard and save the message ID.
- Deleted Discord message: post a replacement and save the new message ID.
- Image render failure: post or edit a truthful text fallback and log the render
  failure.
- Missing display name: fall back to the user ID or existing display-name
  fallback behavior.
- Missing final result: exclude the match from result-based awards.
- Missing weekly snapshot: render the no-history weekly state.
- Discord edit/post failure: report privately for command-triggered refreshes
  and log timestamped errors for automatic refreshes.

## Testing

Use unit tests without live Discord or network dependencies.

Required coverage:

- stats builder with no predictions
- stats builder with predictions but no results
- top five and scoring category totals match official scoring output
- weekly movement with existing baseline
- weekly movement with missing baseline
- new user absent from the baseline
- ties in award categories
- negative awards respect the active-user threshold
- prediction spread chooses the expected match
- consensus failure chooses the expected match
- copied-score group chooses the expected match and score
- zero-point prediction counts come from scoring output
- SVG renderer emits title, week range, totals, award labels, and footer
- PNG renderer returns a non-empty PNG buffer from known SVG
- dashboard post storage saves and reuses message IDs
- updater posts, edits, and replaces the dashboard message
- runtime refreshes after startup and result sync storage
- `/copanalhas copanalhas-recap-painel` command routing
- `/copanalhas status` includes chaos dashboard health

Required regression gates:

- `npm test`
- `npm run build`

Existing tests must remain collected and passing. The implementer must not use
skipped tests, loosened assertions, or deleted tests as a way to complete this
feature.

## Scope Boundaries

This design does not change scoring rules, prediction parsing, result sync,
standings, bracket topology, leaderboard ranking, reveal formatting, Discord
guild/channel scope, or raw-message storage policy.

This design does not introduce a hosted web dashboard, Discord Activity,
multi-guild dashboard, live match statistics provider, AI image generation, or a
new World Cup data source.

Manual one-off recap generation for arbitrary date ranges can be added later.
V1 focuses on one permanent dashboard plus one operator refresh command.
