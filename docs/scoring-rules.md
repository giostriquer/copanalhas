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

- Exact scoreline: 3 points.
- Closest non-exact prediction: 1 point.
- If exact scorelines exist, exact predictors still receive 3 points and the
  closest non-exact prediction also receives 1 point.
- If no exact scoreline exists, the closest prediction receives 1 point.
- If multiple predictions tie for closest, all tied predictions receive 1 point.

## Closest Metric

Default closest metric:

```text
abs(predicted_home - actual_home) + abs(predicted_away - actual_away)
```

This metric is simple, deterministic, and easy to explain. Changing it later is a
scoring-rule change and must include migration/recompute notes.

## Recomputability

Leaderboard rows must be recomputable from stored predictions plus final match
results. Do not store points as the only source of truth.

## Open Decisions

- Whether edited Discord messages update predictions until kickoff.
- Whether late predictions are rejected at kickoff or at a configurable cutoff.
- Whether each user can submit one prediction per match or multiple attempts with
  the latest valid one winning.
