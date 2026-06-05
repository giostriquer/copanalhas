# copanalhas

Copanalhas is a private Discord-based prediction game for the FIFA World Cup.
It collects point-based match predictions from one configured channel in one
Discord server owned by the operator. It is not gambling, does not involve real
money, and should not collect more Discord data than is needed to score the game.

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

## Current Status

This repository contains an autonomous Discord operator runtime, a reviewed
World Cup seed subset, SQLite storage, scoring/leaderboard logic, Discord-native
matchday prediction cards, operator slash commands, prediction cutoffs,
posted-card dedupe, and optional football-data.org result sync.

Useful commands:

- `npm run dev -- seed-matches`
- `npm run dev -- bot`
- `npm run dev -- post-matches-today 2026-06-11`
- `npm run dev -- clear-posted-date 2026-06-11`
- `npm run dev -- record-result wc2026-001 2 1`
- `npm run dev -- leaderboard`

Run `npm run dev -- bot` for the normal Discord experience. While the bot is
running it registers `/copanalhas` operator commands, posts daily matchday cards
with one prediction button per match at the configured local time, listens for
prediction button/modal interactions with team-specific score fields, and can
sync finished results from football-data.org when a token is configured.
Terminal commands remain useful for setup and manual recovery, but Discord slash
commands are the preferred operator controls during the game.

Useful operator commands while the bot is running:

- `/copanalhas post-date date:2026-06-11`: post the reviewed matchday card for a
  date.
- `/copanalhas clear-posted-date date:2026-06-11`: clear posted-card dedupe
  records for a date so it can be reposted during testing.
- `/copanalhas predictions match:wc2026-001`: privately inspect submitted picks
  for one match before or after lock.
- `/copanalhas reveal match:wc2026-001`: publicly reveal submitted picks only
  after predictions have closed.
- `/copanalhas result match:wc2026-001 score:2-1`: record or override a result.
- `/copanalhas leaderboard`: privately show the current leaderboard.

## Documentation

- `docs/product-brief.md` describes the product scope.
- `docs/architecture.md` sketches the initial system boundaries.
- `docs/discord-ingestion.md` defines Discord API and collection constraints.
- `docs/data-sources.md` records the World Cup schedule data policy.
- `docs/scoring-rules.md` defines the scoring model.
- `docs/security-privacy.md` captures safety and privacy constraints.
- `docs/testing-policy.md` defines the initial testing posture.
- `docs/conventions/implementation-patterns.md` is the source for pattern review.
