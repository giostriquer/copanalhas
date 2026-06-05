# Autonomous Discord Operator Design

## Goal

Make Copanalhas easier to operate during development and tournament play by
letting one manually started bot process handle daily match posting, prediction
collection, cutoff enforcement, result sync, scoring, and operator controls from
Discord.

The operator can still start the bot manually with `npm run dev -- bot`. Once it
is running, day-to-day control should happen mostly through Discord slash
commands instead of terminal commands.

## Source Strategy

Copanalhas should keep a clear split between reviewed fixture data and automatic
result data.

Fixture, group, venue, and kickoff information should come from official FIFA
schedule pages or PDFs and be stored as reviewed repo-owned data. The local data
must include enough timing detail to enforce prediction cutoffs:

- match ID
- external source IDs where available
- group or knockout phase metadata
- teams or unresolved bracket slots
- venue
- `kickoffAtUtc`
- display date/time fields
- source metadata and review timestamp

Automatic result sync can use `football-data.org` as an optional machine-readable
provider because its free coverage lists Worldcup and its match resource exposes
status and full-time score fields. FIFA remains the human/source-of-truth
reference for review and correction. The provider token is optional; without it,
manual result commands remain available.

## Prediction Cutoff

Predictions can be created or changed until 30 minutes before kickoff.

The system derives:

```text
predictionClosesAt = kickoffAtUtc - 30 minutes
```

Modal submissions after the cutoff are rejected with a private reply. Missing
kickoff data must not silently mean predictions stay open all day. If a match
lacks verified kickoff time, prediction submissions for that match are rejected
until the data is completed or the operator explicitly uses a future override
feature.

Match cards should show both kickoff time and prediction close time so members
understand the deadline before clicking `Predict`.

## Bot Runtime

`npm run dev -- bot` becomes the single long-running local operator process.

On startup, the bot should:

1. load `.env`
2. validate Discord config
3. open and migrate SQLite
4. seed reviewed match data
5. register/listen for Discord interactions
6. start the in-process scheduler
7. start optional result sync if configured

The bot does not need an external scheduler for this phase. If the process is not
running, automatic posting and sync do not happen.

## Automatic Match Posting

The scheduler checks the configured local date/time while the bot is running.
Default behavior:

```text
COPANALHAS_AUTO_POST_ENABLED=true
COPANALHAS_AUTO_POST_TIME=09:00
COPANALHAS_TIMEZONE=America/Sao_Paulo
```

For each reviewed match on the current local date, the bot posts a match card
only if that match has not already been posted to the configured channel. Posting
must be idempotent across bot restarts.

Store posted cards in a table such as:

```text
posted_match_cards
- match_id
- channel_id
- message_id
- posted_for_date
- posted_at
- post_source: auto | command
```

This supports dedupe, status reporting, and audit history.

## Discord Operator Commands

Add Discord slash commands for operator control:

- `/copanalhas post-today`
- `/copanalhas post-date date:2026-06-11`
- `/copanalhas status`
- `/copanalhas leaderboard`
- `/copanalhas result match:wc2026-001 score:2-1`

The existing terminal commands can remain as development fallback, but the
preferred daily surface is Discord. Operator commands should reply privately
where Discord allows it, especially for status and operational errors.

Operator commands must stay scoped to the configured guild/channel and should not
grant broad multi-server behavior.

## Result Sync

If `FOOTBALL_DATA_TOKEN` is configured, the bot can poll `football-data.org` for
nearby World Cup matches while running. Polling should be conservative and stay
well below free-tier limits.

Result sync should:

1. map local matches to provider match IDs
2. poll only relevant upcoming/live/recent matches
3. ignore matches without a final full-time score
4. upsert results when provider status is finished and score fields are present
5. record source metadata
6. run scoring after new results are stored
7. optionally post or update leaderboard output

Store enough result provenance for audit:

```text
results
- match_id
- home_score
- away_score
- recorded_at
- result_source: manual | football-data
- external_match_id
- fetched_at
```

Manual result entry remains available for provider failures, delayed data, or
corrections. Manual corrections should overwrite automatic results with visible
source metadata.

## Status And Safety

`/copanalhas status` should surface:

- bot scheduler state
- next auto-post time
- matches scheduled today
- posted/unposted cards
- missing kickoff times
- closed/open prediction windows
- result sync enabled/disabled
- last result sync time and provider errors

Secrets must stay in `.env` and should never be printed in Discord responses,
logs, or stored records.

## Error Handling

- Missing kickoff time: do not accept predictions for that match.
- Cutoff passed: reject modal submission privately.
- Duplicate auto-post attempt: skip and report as already posted.
- Discord channel missing or not sendable: log and report through status.
- Result provider unavailable: keep manual result commands available and record
  last sync failure without crashing the bot.
- Provider result missing score fields: ignore until complete.
- Provider result conflicts with stored manual result: keep manual result and
  report the conflict in status.

## Testing

Implementation should be test-first and avoid live Discord/network dependencies
in unit tests.

Cover:

- cutoff derivation and modal rejection after close time
- missing kickoff time rejection
- match card text includes kickoff and close time
- scheduler posts due matches once
- scheduler does not duplicate posted cards after restart
- slash command routing for post/status/result/leaderboard
- result provider mapping and finished-score import
- manual result override behavior
- status output for missing times and sync failures

Live Discord and live provider checks are separate manual verification steps.

## Open Scope Boundaries

This design does not add a web dashboard, external OS scheduler, multi-guild
hosting, paid API dependency, or broad sports-data ingestion. Those can be
revisited later if the local Discord-first operator surface stops being enough.
