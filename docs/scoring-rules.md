# Scoring Rules

## Prediction Unit

A prediction is one member's scoreline for one match:

```text
user + match + predicted home goals + predicted away goals
```

The first implementation should choose one canonical message format and reject
ambiguous input rather than guessing.

## Points

For each completed match:

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
unchanged. Existing leaderboard and reveal output is recomputed from those rows
with the active point values: solo exact = 5, shared exact = 3, result = 2, and
closest = 1.

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
