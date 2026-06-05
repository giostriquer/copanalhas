# Discord Ingestion

## Primary Prediction Flow

The preferred member workflow is Discord-native:

1. The operator runs `npm run dev -- post-matches-today [YYYY-MM-DD]`.
2. The bot posts one match card per reviewed World Cup match on that date.
3. Each card has a `Predict` button with the match ID in its custom ID.
4. A member clicks `Predict` and the bot opens a score modal for that match.
5. The member enters only a score, such as `2x1` or `2-1`.
6. The bot validates the score, upserts that user's prediction for the match,
   and sends a private confirmation.

Raw channel message parsing can remain as a development fallback, but it is no
longer the desired member-facing prediction workflow.

## Current API Constraints

Discord apps receive events through gateway intents. Message content is privileged:
without the Message Content intent configured or approved where required, message
objects can arrive with empty `content`, `embeds`, `attachments`, and `components`.
Bot API calls must authenticate with a bot token, and HTTP Authorization headers
use the `Bot <token>` scheme.

For Copanalhas, the primary flow needs the bot token, guild ID, channel ID,
permission to send messages in the configured channel, and permission to receive
component/modal interactions. The message-content reader is only needed while the
raw-message fallback remains enabled.

## Channel Scope

Every message or interaction path must check:

- configured guild ID
- configured channel ID
- author/user is not the bot itself for raw messages
- message timestamp is within the active collection policy for the match

Events outside the configured guild/channel are ignored before parsing or
opening modals.

## Storage Policy

Prefer storing parsed prediction records:

- Discord user ID
- Discord message or interaction ID
- match ID
- predicted home score
- predicted away score
- created/edited timestamp
- parser version

Avoid storing raw message content. If parser diagnostics need raw content, keep it
short-lived, mark it as diagnostic data, and cover the parser case with tests so
raw content can be removed.

## Commands

- `npm run dev -- post-matches-today [YYYY-MM-DD]`: posts one reviewed match card
  per match on the selected date. If the date is omitted, the command uses the
  current ISO date.
- `npm run dev -- bot`: starts the long-running bot. It listens for the card
  button and modal interactions and saves predictions.

## Permissions

The Discord application should stay scoped to the owned guild/channel. Any change
that broadens intents, guild scope, channel scope, stored data, or posting
permissions must update this document and `docs/security-privacy.md`.
