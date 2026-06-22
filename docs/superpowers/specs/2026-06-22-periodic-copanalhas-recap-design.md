# Periodic Copanalhas Recap Design

## Goal

`Copanalhas Recap` should be a durable recap series, not a live dashboard. The
bot should post one generated recap image after each reviewed tournament period
is complete, preserving previous period posts so members can compare them.

## Periods

The first supported periods are the three group-stage weeks already represented
by the reviewed seed data:

- `group-week-1`: matches `#1-#24`
- `group-week-2`: matches `#25-#48`
- `group-week-3`: matches `#49-#72`

Future knockout recaps should use the same period model once knockout fixtures
and results exist in repo data:

- `round-of-32`
- `round-of-16`
- `quarter-finals`
- `semi-finals`
- `finals`

## Posting Rules

A recap period is eligible only when every match in that period has a stored
final result. The bot should then post or edit exactly one Discord message for
that period. Completed period posts are durable artifacts; they should not be
edited after every later match.

Startup should backfill any completed periods that are missing posts. Result
sync and manual result entry should check whether a newly completed period is
now due and post it. The operator command
`/copanalhas copanalhas-recap-painel` should refresh/backfill completed recap
periods.

## Data Model

Store one recap post pointer per `(guild, channel, period_key)`. The recap image
and stats should be derived from current predictions, reviewed matches, and
stored final results; raw Discord message content is not stored.

Period stats should include only predictions and results for matches inside the
recap period. Overall leaderboard movement can be removed from this first
periodic version because cross-period comparison comes from the durable posts
themselves.

## Logging And Health

Runtime logs should keep the existing `[timestamp][category] ...` shape. Recap
logs should identify the period key and whether a post was created, edited, or
skipped. Status should report how many completed recap periods have posts.

## Tests

Tests should cover:

- group-stage period definitions and completion detection
- period-scoped stats
- one post pointer per period
- startup/result-sync/manual-command backfill
- command registration and operator replies
- full build and test suite
