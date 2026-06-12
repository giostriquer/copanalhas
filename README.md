# Copanalhas

Copanalhas is a Discord-based points prediction game for the FIFA World Cup. It
posts matchday cards in one configured Discord channel, collects score
predictions through Discord buttons/modals, locks picks before kickoff, reveals
locked predictions in match threads, and keeps standings plus a player
leaderboard updated.

This repository is public source for a private server bot. It is not gambling:
there is no real money, no odds, no payouts, and no wagering mechanic.

## Goals

- Collect match predictions from a single configured Discord guild/channel.
- Let members click match cards and submit score predictions through Discord modals.
- Store predictions as structured records tied to Discord user IDs and match IDs.
- Keep World Cup match data reviewable and updateable as the tournament changes.
- Score exact scoreline predictions and closest misses deterministically.
- Preserve enough audit history to explain leaderboard changes.

## Non-goals

- No real-money betting, odds, payouts, or wagering features.
- No collection across multiple servers unless explicitly redesigned.
- No broad Discord message archiving.
- No dependency on unofficial sports APIs without a source and safety review.

## What It Does

This repository contains an autonomous Discord operator runtime, a reviewed
World Cup seed subset, SQLite storage, scoring/leaderboard logic, Discord-native
matchday prediction cards, operator slash commands, prediction cutoffs,
posted-card dedupe, and optional football-data.org result sync.

## Local Commands

- `npm run dev -- seed-matches`
- `npm run dev -- bot`
- `npm run dev -- post-matches-today 2026-06-11`
- `npm run dev -- clear-posted-date 2026-06-11`
- `npm run dev -- record-result wc2026-001 2 1`
- `npm run dev -- leaderboard`

Windows launchers:

- `scripts\windows\start-copanalhas-bot.cmd`: double-clickable bot launcher.
- `powershell -ExecutionPolicy Bypass -File scripts\windows\install-start-menu-shortcut.ps1`:
  creates a Start Menu shortcut named `Copanalhas Bot` that can be pinned to
  Start.
- `powershell -ExecutionPolicy Bypass -File scripts\windows\install-startup-shortcut.ps1`:
  starts the bot automatically when you log into Windows.
- `powershell -ExecutionPolicy Bypass -File scripts\windows\remove-startup-shortcut.ps1`:
  removes the automatic startup shortcut.

## Discord Bot Flow

Run `npm run dev -- bot` for the normal Discord experience. While the bot is
running it registers `/copanalhas` operator commands, posts a rolling window of
day-level matchday cards with one prediction button per match at the configured
local time, listens for prediction button/modal interactions with team-specific
score fields, and can sync finished results from football-data.org when a token
is configured.
`COPANALHAS_MATCHDAY_ROLLOVER_TIME` defaults to `06:00`, so matches that start
after midnight but before 06:00 in `COPANALHAS_TIMEZONE` still belong to the
previous operational matchday.
On startup, the bot immediately catches up the configured auto-post window if
the configured auto-post time has already passed, refreshes standings, and runs
result sync with a small lookback window when result sync is enabled. The main
public dashboard is three persistent posts: group standings A-F, group standings
G-L, and the Copanalhas player leaderboard.
When a prediction window closes, the bot posts one compact reveal message in the
matchday card thread, grouping matches that locked at the same time. After a
result is stored, that same thread message is edited into a result receipt with
the official score and points gained by each participant.
If `COPANALHAS_MATCH_START_ROLE_ID` is configured, the bot also pings that role
in the configured channel shortly before kickoff, grouping simultaneous kickoffs
in one message with a CazeTV link. It deletes the ping after the represented
matches have stored results, or after the fallback cleanup deadline if result
sync is late.
Terminal commands remain useful for setup and manual recovery. Discord slash
commands are the preferred operator controls during the game.

Useful operator commands while the bot is running:

- `/copanalhas post-date date:2026-06-11`: post the reviewed matchday card for a
  date.
- `/copanalhas clear-posted-date date:2026-06-11`: clear posted-card dedupe
  records for a date so it can be reposted during testing.
- `/copanalhas reset-test-date date:2026-06-11`: clear posted cards,
  predictions, reveal records, match-start alerts, and results for one test
  date, then refresh standings.
- `/copanalhas status`: privately show a morning health checklist with Discord
  route, local matchday time, next matchday post, prediction windows, pending
  locked reveal posts, Football Data/result-sync timing, and dashboard post
  health. The bot also prints the same compact checklist to the console after
  startup catch-up work.
- `/copanalhas meus-palpites`: privately show your predictions for the active
  matches. Add `date:2026-06-11` to inspect another matchday.
- `/copanalhas predictions match:wc2026-001`: privately inspect submitted picks
  for one match before or after lock. Match fields support autocomplete by team
  or match number.
- `/copanalhas reveal match:wc2026-001`: publicly reveal submitted picks only
  after predictions have closed.
- `/copanalhas result match:wc2026-001 score:2-1`: record or override a result.
- `/copanalhas sync-results`: force one immediate Football-Data result sync for
  unresolved matches that have already kicked off. Only `FINISHED` provider
  results are stored.
- `/copanalhas leaderboard`: privately preview the current leaderboard. The
  public leaderboard dashboard post is updated automatically after result
  changes.

## Automation Settings

- `COPANALHAS_AUTO_POST_WINDOW_DAYS`: number of operational matchdays to post on
  each daily auto-post run, default `3`. Each date is still posted as its own
  matchday card.
- `COPANALHAS_MATCH_START_ROLE_ID`: optional Discord role ID to ping when a
  match is nearing kickoff. Leave blank to disable match-start pings.
- `COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES`: fallback deletion deadline
  after kickoff for match-start pings, default `180`.
- `COPANALHAS_MATCH_START_LEAD_MINUTES`: minutes before kickoff to post
  match-start pings, default `5`. Set to `0` to post at kickoff.
- `COPANALHAS_MATCH_START_GRACE_MINUTES`: startup/tick grace window for posting
  a just-started match ping, default `5`.

## Result Sync

- `FOOTBALL_DATA_TOKEN`: enables the provider client when present.
- `COPANALHAS_RESULT_SYNC_ENABLED`: set to `false` to disable provider result
  sync even with a token.
- `COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES`: first provider check after
  kickoff, default `110`, which is expected group-stage end plus five minutes.
- `COPANALHAS_RESULT_SYNC_RETRY_MINUTES`: retry delay when a due match is still
  not final, default `1`.

Football-Data credentials must never be committed. The public dashboard includes
the required visible attribution when result data may be synced from the API:
`Football data provided by the Football-Data.org API.`

## Public Repo Policy

Issues are welcome for bugs, safety concerns, or questions, but do not include
Discord tokens, Football-Data tokens, guild IDs, channel IDs, runtime SQLite
files, logs, screenshots with secrets, or private Discord message content.

The code is released under the MIT License. Runtime data remains private and is
ignored by git.

## Documentation

- `docs/product-brief.md` describes the product scope.
- `docs/architecture.md` sketches the initial system boundaries.
- `docs/discord-ingestion.md` defines Discord API and collection constraints.
- `docs/data-sources.md` records the World Cup schedule data policy.
- `docs/scoring-rules.md` defines the scoring model.
- `docs/security-privacy.md` captures safety and privacy constraints.
- `docs/testing-policy.md` defines the initial testing posture.
- `docs/conventions/implementation-patterns.md` is the source for pattern review.
