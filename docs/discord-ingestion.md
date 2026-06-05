# Discord Ingestion

## Primary Prediction Flow

The preferred member workflow is Discord-native:

1. The operator starts the bot with `npm run dev -- bot`.
2. The bot posts one matchday card for the configured daily schedule while the
   bot process is running.
3. The matchday card contains one prediction button per reviewed match, with the
   match ID in each button custom ID.
4. A member clicks the match's prediction button and the bot opens a score modal
   for that match.
5. The member enters one numeric field for each team. If that member already
   has a prediction for the match, the modal opens with the saved values
   pre-filled.
6. The bot validates the score fields, upserts that user's prediction for the
   match, and sends a private confirmation.

Matchday cards render kickoff and prediction-close values with Discord-native
timestamp tokens so each member sees local and relative time in their client.
Shared Discord buttons cannot change color per member, so the per-member state
lives in the private modal and confirmation flow instead of the public card.

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

## Prediction Cutoff

Predictions close 30 minutes before `kickoffAtUtc`.

- If `kickoffAtUtc` is missing, predictions are closed for that match until the
  fixture time is verified.
- At the exact close timestamp, submissions are rejected.
- Members may update a prediction by submitting the modal again before the
  cutoff; storage upserts by `(userId, matchId)`.

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

- `npm run dev -- post-matches-today [YYYY-MM-DD]`: posts one matchday card for
  reviewed matches on the selected date. If the date is omitted, the command uses
  the current ISO date.
- `npm run dev -- clear-posted-date [YYYY-MM-DD]`: clears only posted-card
  dedupe records for the configured channel and selected date, allowing a test
  matchday card to be posted again without deleting predictions or results.
- `npm run dev -- bot`: starts the long-running bot. It listens for the card
  button and modal interactions, saves predictions, registers operator slash
  commands, runs auto-posting, and runs optional result sync. Startup also
  catches up today's missing matchday card if auto-post time already passed and
  runs result sync with a two-day lookback window when result sync is enabled.

While `bot` is running, use `/copanalhas` for normal operator work:

- `/copanalhas post-today`
- `/copanalhas post-date date:2026-06-11`
- `/copanalhas clear-posted-date date:2026-06-11`
- `/copanalhas reset-test-date date:2026-06-11`
- `/copanalhas status`
- `/copanalhas leaderboard`
- `/copanalhas meus-palpites`
- `/copanalhas predictions match:wc2026-001`
- `/copanalhas reveal match:wc2026-001`
- `/copanalhas result match:wc2026-001 score:2-1`

Posted matchday cards are deduped by match and channel. The grouped Discord
message ID is recorded once per included match, so restarting the process or
re-running an operator post command does not repost matches already recorded in
SQLite. During smoke tests, `clear-posted-date` removes only those dedupe rows
for the configured channel and selected date.

`status` is the operator health check. It reports the current local date/time,
auto-post setting, today's reviewed matches, posted/unposted card state,
prediction-window counts, the last auto-post action, result-sync state, the last
result-sync action, and standings post health. Use it after starting the bot to
confirm that catch-up ran and the process is ready for members.

`reset-test-date` is the broader smoke-test reset. It clears posted-card dedupe
records, predictions, and results for matches on the selected date, then refreshes
standings so temporary manual results do not keep affecting group tables.

`meus-palpites` is member-facing and private. It defaults to the current local
date in the configured timezone and shows only that matchday's predictions for
the caller. The optional `date` argument exists for test runs and catch-up days.

`predictions` is an operator-only private audit view. It can show submitted
picks before the prediction window closes, which helps with smoke tests and
moderation without exposing picks to other members. `reveal` is the public view:
it refuses while the prediction window is still open and posts the pick list only
after the match cutoff has passed.

Match arguments for `predictions`, `reveal`, and `result` use Discord
autocomplete. Operators can search by match number, team code, translated team
name, original team name, or date instead of typing internal match IDs.

## Permissions

The Discord application should stay scoped to the owned guild/channel. Any change
that broadens intents, guild scope, channel scope, stored data, or posting
permissions must update this document and `docs/security-privacy.md`.
