# Product Brief

## Purpose

Copanalhas runs a private points-based World Cup prediction game inside a Discord
server owned by the operator. The bot posts match cards in one agreed channel,
members click `Predict`, and the system collects score predictions through a
Discord modal. It scores predictions after matches finish and produces a
leaderboard that can be shared back to the group.

## Scope

The first version should handle:

- one Discord guild
- one configured prediction channel
- one tournament: FIFA World Cup 2026
- scoreline predictions for scheduled matches
- exact-score and closest-score points
- auditable leaderboard updates

## Explicit Non-goals

- Real-money betting or prizes that convert to money.
- Betting odds, bookmaker integrations, or payment flows.
- Generic Discord moderation or archival tooling.
- Multi-server hosting or a public SaaS surface.

## Success Criteria

- The operator can configure the server, channel, and bot token without editing
  source code.
- Modal score predictions can be stored as `{ user, match, homeScore, awayScore }`
  records.
- Scoring can be reproduced from stored predictions and match results.
- World Cup schedule/results updates are traceable to reviewed sources.
- The bot never needs broader Discord permissions than the configured channel
  workflow requires.
