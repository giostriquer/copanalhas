# Scoring Rules

## Prediction Unit

A prediction is one member's scoreline for one match:

```text
user + match + predicted home goals + predicted away goals
```

The first implementation should choose one canonical message format and reject
ambiguous input rather than guessing.

## Group And Regular-Time Points

For each completed group-stage match, and for each knockout match decided in
regular time:

- If exactly one member lands the exact scoreline, that member receives 5 solo
  points.
- If multiple members land the exact scoreline, each exact predictor receives 3
  exact points.
- Correct-outcome points are awarded only when nobody lands the exact scoreline.
- If nobody lands the exact scoreline, each member who lands the winner or draw
  receives 2 result points.
- Closest points are awarded only when nobody lands the exact scoreline or the
  correct winner/draw.
- If nobody lands the exact scoreline or correct winner/draw, the closest
  prediction receives 1 point.
- If nobody lands the exact scoreline or correct winner/draw and multiple
  predictions tie for closest, all tied predictions receive 1 point each.

## Knockout Extra-Time And Penalty Points

Knockout predictions also include a required decision-method choice:

- Tempo regulamentar
- Prorrogação
- Cobrança de pênaltis

Scoreline points are not awarded once per phase. They are awarded from the first
eligible exact-score phase only:

- If the match is decided in regular time, use the normal rules above, including
  result and closest-score points when nobody hit the exact scoreline.
- If the match reaches extra time or penalties, first compare predictions with
  the regular-time score. A solo regular-time exact earns 5 points; shared
  regular-time exacts earn 3 points each.
- If nobody hit the regular-time score and extra time is played, compare
  predictions with the score after extra time. Exact extra-time scorelines earn
  3 points each.
- If the match is decided after extra time and nobody hits those exact phases,
  no result or closest-score points are awarded.
- If the match is decided by penalties and nobody hits those exact phases, each
  member whose predicted scoreline picked the side that advanced receives 2
  result points. Draw predictions do not imply an advancing side.

The decision-method choice is an independent bonus:

- If the selected decision method matches how the match was actually decided,
  the member receives 2 bonus points.
- The bonus can stack with scoreline points, but it does not unlock additional
  phase scoring.
- Legacy knockout predictions without a decision method can still receive
  scoreline points, but cannot receive the method bonus.

## Closest Metric

Default closest metric:

```text
primary = abs(predicted_home - actual_home) + abs(predicted_away - actual_away)
tie-breaker = abs((predicted_home + predicted_away) - (actual_home + actual_away))
```

The lowest primary distance wins. If multiple predictions tie on that distance,
the prediction with the closest total number of goals wins. If predictions are
still tied after both checks, all tied predictions receive the closest point.
This metric is deterministic and easy to explain. Changing it later is a
scoring-rule change and must include migration/recompute notes.

## Recomputability

Leaderboard rows must be recomputable from stored predictions plus final match
results. Do not store points as the only source of truth.

The active scoring migration keeps stored predictions and stored final results
as the source of truth. Existing leaderboard and reveal output is recomputed from
those rows with the active point values: solo exact = 5, shared exact = 3,
result = 2, closest = 1, and knockout decision-method bonus = 2.

## Leaderboard Tie-Breakers

Leaderboard rows sort by:

1. total points, descending
2. solo exact scorelines, descending
3. shared exact scorelines, descending
4. correct winner/draw results, descending
5. closest-score awards, descending
6. Discord user ID, ascending, as the deterministic final fallback

Ranks are shared only when all scoring tie-breakers are also tied. The user ID
fallback orders otherwise identical rows but does not represent a scoring
achievement.

Decision-method bonus points are included in total points, but the bonus count
is not a tie-breaker after total points. If two rows tie on total points and all
score-achievement tie-breakers, they share the same rank before the deterministic
user ID fallback order.

## Prize Display

The leaderboard dashboard includes an operator-provided prize section:

- 1000 (da pra aumentar se alguem quiser contribuir)
- Primeiro lugar = 60%
- Segundo lugar = 30%
- Terceiro lugar = 10%

## Open Decisions

- Whether edited Discord messages update predictions until kickoff.
- Whether late predictions are rejected at kickoff or at a configurable cutoff.
- Whether each user can submit one prediction per match or multiple attempts with
  the latest valid one winning.
