# Knockout Prediction Scoring Design

## Goal

Add knockout-only scoring rules for matches that can go through regular time,
extra time, and penalties, while keeping all group-stage prediction and scoring
behavior unchanged.

The feature should support the member-facing score prediction flow, add a
knockout-only decision-method dropdown, and keep leaderboard/reveal output
recomputable from stored predictions plus stored final results.

## Terminology

- Regular time means 90 minutes plus stoppage time.
- Extra time means the additional 30 minutes, usually two 15-minute periods.
- Penalties means the penalty shootout after extra time ends tied.

The Portuguese dropdown labels are:

- `Tempo regulamentar`
- `Prorrogação`
- `Cobrança de pênaltis`

## Member Experience

Group-stage prediction modals stay as they are today: one numeric score field
per team.

Knockout prediction modals add one required dropdown after the two score fields.
The dropdown asks how the match will be decided. It is independent from the
scoreline fields, so a member may submit combinations such as `3x2` plus
`Cobrança de pênaltis`. That combination is allowed: it can win the
decision-method bonus if the match reaches penalties, even though the scoreline
cannot be exact for a penalty shootout.

When a member already has a knockout prediction, the modal should pre-fill both
score fields and the previously selected decision method.

## Group-Stage Scoring

Group matches keep the current rules:

- solo exact scoreline: 5 points
- shared exact scoreline: 3 points each
- correct winner or draw, only when nobody hit exact: 2 points each
- closest score, only when nobody hit exact or result: 1 point each

Existing group-stage stored predictions remain valid and do not need a decision
method.

## Knockout Score Points

Knockout score points are computed before the decision-method bonus.

First, compare predictions against the regular-time score:

- If exactly one member hits the regular-time scoreline, that member receives 5
  solo points.
- If multiple members hit the regular-time scoreline, each receives 3 exact
  points.

If nobody hits the regular-time scoreline and extra time is played, compare
predictions against the score after extra time:

- Any exact scoreline after extra time receives 3 exact points.
- If nobody hits that exact extra-time scoreline and extra time produces a
  winner, each member who predicted that winning side receives 2 result points.

If the match goes to penalties and nobody hit the exact score after extra time,
award 2 result points to each member whose scoreline predicted the side that
advanced. Draw scoreline predictions do not claim an advancement side, so a
non-exact draw prediction receives no result points in this tier.

Knockout matches do not use closest-score points.

## Decision-Method Bonus

Every knockout prediction has an independent decision-method bonus:

- 2 points if the selected method matches how the match was actually decided.
- 0 points otherwise.

This bonus always stacks with score points. For example, a solo regular-time
exact prediction with the correct `Tempo regulamentar` dropdown receives
7 total points: 5 score points plus 2 bonus points.

The dropdown never gates, blocks, or changes score scoring. It only adds the
separate decision-method bonus.

## Result Data

Stored knockout results must contain enough reviewed data to recompute both
score points and the decision-method bonus:

- regular-time score
- extra-time score when extra time is played
- penalty shootout score or advancing side when penalties decide the match
- actual decision method

For group matches, the current final-score storage remains sufficient.

Result sync must store knockout scoring details only when the provider response
has enough final data to identify the decision method and relevant score layers.
If provider data is incomplete, the sync should skip scoring that knockout match
and log the reason with the existing timestamped result-sync log shape. Manual
operator result entry should support the detailed knockout result shape so the
bot can recover without guessing.

## Storage

Prediction storage should add a nullable decision-method field:

- `null` for group-stage predictions and old records
- required for new knockout modal submissions

Scoring output should add a decision-method bonus category. Leaderboard total
points include the bonus. Existing score-achievement tie-breakers stay in their
current order; the decision-method bonus should not outrank solo, exact, result,
or close-score achievements when total points are tied.

## Discord Output

Locked prediction reveals for knockout matches should show both the scoreline
and selected decision method. Result reveals should show the final points for
each member and make the decision-method bonus understandable without bloating
the thread.

Leaderboard and recap images should include decision-method bonus points or
counts only when knockout matches have been scored. Group-stage-only views can
remain visually unchanged.

## Error Handling

- Group modal submissions do not require or store a decision method.
- Knockout modal submissions reject missing or invalid decision-method values.
- Legacy knockout predictions without a decision method can still be scored for
  scoreline points, but receive no decision-method bonus.
- Unknown provider knockout result shapes should be skipped rather than guessed.
- Runtime logs must keep the existing `[timestamp][category] ...` shape and must
  not log secrets.

## Testing

Focused tests should cover:

- group-stage scoring remains unchanged
- regular-time solo exact and shared exact knockout scoring
- extra-time exact scoring when no regular-time exact exists
- extra-time result scoring when no regular-time or extra-time exact exists
- penalty advancement-side scoring when no prior tier awarded points
- non-exact draw predictions receive no advancement-side points in penalty games
- decision-method bonus stacks with every score tier
- wrong decision method receives no bonus
- knockout modal contains the dropdown and pre-fills existing values
- group modal does not contain the dropdown
- storage migration keeps old predictions readable
- reveal and leaderboard output include knockout decision bonus information
- result sync skips incomplete knockout detail without storing guessed scores

Full verification remains:

```text
npm test
npm run build
```
