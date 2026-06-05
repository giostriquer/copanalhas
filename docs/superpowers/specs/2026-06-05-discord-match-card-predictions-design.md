# Discord Match Card Predictions Design

## Goal

Replace the annoying typed match-number prediction flow with a Discord-native game board:
the bot posts match cards for the day, each card has a `Predict` button, and users
enter only a score such as `2x1` in a modal.

## User Experience

The operator runs a command that posts today's reviewed World Cup matches into the
configured prediction channel. The bot posts one card per match:

```text
Match #1 - Group A
Mexico vs South Africa
Kickoff: Jun 11

[Predict]
```

When a member clicks `Predict`, the bot opens a modal titled with the match. The
modal has one text input: `Score`, with examples like `2x1` or `2-1`. On submit,
the bot validates the score, saves or updates that user's prediction for the match,
and sends a private confirmation:

```text
Saved: Mexico 2-1 South Africa
```

If the score is invalid, the bot sends a private error and does not store anything.

## Architecture

Discord component custom IDs carry match identity:

- Button: `copanalhas:predict:<matchId>`
- Modal: `copanalhas:score:<matchId>`
- Score input: `score`

The button/modal flow is the primary prediction UX. The old raw-message parser can
remain as a development fallback, but it is no longer the desired member workflow.

Core parsing stays Discord-independent. A new score parser accepts only strict score
input such as `2x1`, `2 x 1`, or `2-1`. Discord interaction handling stays at the
edge and converts button/modal events into project-owned prediction records.

## Data Flow

1. Operator runs `npm run dev -- post-matches-today`.
2. Bot posts one match card per reviewed match for the selected date.
3. User clicks a card's `Predict` button.
4. Bot opens a modal with the match ID embedded in the modal custom ID.
5. User submits a score.
6. Bot validates score format.
7. Bot upserts `{ userId, matchId, messageId, homeScore, awayScore }`.
8. Bot sends a private confirmation.

## Error Handling

- Unknown match ID in a component custom ID: private error.
- Invalid custom ID: ignore.
- Invalid score text: private error with examples.
- Missing configured channel or bot token: existing config validation remains.
- Messages outside the configured guild/channel remain ignored.

## Testing

Add unit tests for:

- custom ID creation/parsing
- match card view models
- score-only parsing
- modal submission storage
- invalid score replies
- CLI command that posts match cards through an injected Discord poster

Live Discord verification still requires the operator's token, guild ID, channel ID,
and Message Content/interaction permissions.
