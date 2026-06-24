# Discord Ingestion

## Primary Prediction Flow

The preferred member workflow is Discord-native:

1. The operator starts the bot with `npm run dev -- bot`.
2. The bot posts one day-level matchday card for each date in the configured
   rolling auto-post window while the bot process is running.
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

## Matchday Rollover

Posting, `/copanalhas post-today`, `/copanalhas status`, `/copanalhas
meus-palpites`, posted-card dedupe, and test resets use an operational matchday
instead of the raw local calendar date. `COPANALHAS_MATCHDAY_ROLLOVER_TIME`
defaults to `06:00`, using `COPANALHAS_TIMEZONE`.

With the default Brazil timezone, a match that starts at `01:00` belongs to the
previous matchday card. The actual kickoff and prediction close timestamps still
come from `kickoffAtUtc`, so cutoff enforcement and Discord-rendered times stay
precise.

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
  reviewed matches on the selected operational matchday. If the date is omitted,
  the command uses the current operational matchday.
- `npm run dev -- clear-posted-date [YYYY-MM-DD]`: clears only posted-card
  dedupe records for the configured channel and selected date, allowing a test
  matchday card to be posted again without deleting predictions or results.
- `npm run dev -- bot`: starts the long-running bot. It listens for the card
  button and modal interactions, saves predictions, registers operator slash
  commands, runs auto-posting, posts locked prediction reveals into matchday
  threads, and runs optional result sync. Startup also catches up the configured
  auto-post window if auto-post time already passed and runs result sync with a
  two-day lookback window when result sync is enabled.

While `bot` is running, use `/copanalhas` for normal operator work:

- `/copanalhas post-today`
- `/copanalhas post-date date:2026-06-11`
- `/copanalhas clear-posted-date date:2026-06-11`
- `/copanalhas reset-test-date date:2026-06-11`
- `/copanalhas status`
- `/copanalhas leaderboard`
- `/copanalhas bracket`
- `/copanalhas copanalhas-recap-painel`
- `/copanalhas meus-palpites`
- `/copanalhas predictions match:wc2026-001`
- `/copanalhas reveal match:wc2026-001`
- `/copanalhas repost-reveal match:wc2026-001`
- `/copanalhas result match:wc2026-001 score:2-1`
- `/copanalhas sync-results`

Posted matchday cards are deduped by match and channel. The grouped Discord
message ID is recorded once per included match, so restarting the process or
re-running an operator post command does not repost matches already recorded in
SQLite. During smoke tests, `clear-posted-date` removes only those dedupe rows
for the configured channel and selected date.

`COPANALHAS_AUTO_POST_WINDOW_DAYS` defaults to `3`. Automatic posting still keeps
one Discord message per operational date; the window only controls how many dates
the daily catch-up tries to post.

`status` is the operator health check. It reports the active matchday, current
local time, auto-post setting, reviewed matches, posted/unposted card state,
prediction-window counts, the last auto-post action, result-sync state, the last
result-sync action, standings post health, leaderboard post health, and bracket
post health. Use it after starting the bot to confirm that catch-up ran and the
process is ready for members.

The main public dashboard surface starts with four persistent messages in the
configured channel:

- Copa do Mundo 2026 group standings, Groups A-F
- Copa do Mundo 2026 group standings, Groups G-L
- Copanalhas Leaderboard
- World Cup 2026 Bracket

The standings, leaderboard, and bracket messages are edited in place. Copanalhas
Recap posts are different: each completed recap period gets its own durable
message so members can compare week and phase artifacts side by side.
Startup posts or repairs missing dashboard messages. Automatic result sync,
manual result entry, forced result sync, and `reset-test-date` refresh the
affected dashboards so the channel does not fill with new scoreboard messages.
The standings dashboard is a deterministic PNG generated from local fixtures and
stored final results, split across Groups A-F and Groups G-L. It uses Portuguese
team display names, local SVG flag assets from `flag-icons`, full group-table
columns, visible Football-Data attribution, and a text fallback if image
rendering fails.
The bracket dashboard is a deterministic PNG generated from reviewed match data
and stored final results, with visible Football-Data attribution when API-backed
sync may be used. The image renders the knockout path from the Round of 32 edges
through Oitavas, Quartas, Semifinal, Final, and the third-place decision in the
center. The Round of 32 teams are split by the reviewed FIFA winner path so each
outside half converges toward its semifinal, while later rounds use explicit
winner/loser placeholders until knockout teams and results are reviewed. Team
names are rendered with Portuguese display names and local SVG flag assets from
the installed `flag-icons` package, so the runtime renderer does not fetch media
from the network. During the group stage, Round of 32 entrants are shown as
provisional `as it stands` slots; each team row uses a conservative security
border: green for an exact slot that is already locked, yellow for a team that
has qualified but can still move to another slot, and red for a projected team
that has not secured a Round of 32 place. The security calculation enumerates
remaining win/draw/loss point outcomes and treats unresolved tiebreaker or
third-place uncertainty as unsecured rather than guessing. Once all group
results are complete, final Round of 32 slots use the reviewed FIFA
qualification resolver. If FIFA tiebreakers still need manual review, the
bracket reports that blocked state instead of guessing. Operators can run
`/copanalhas bracket` to refresh only the bracket dashboard.

`Copanalhas Recap` is a deterministic PNG generated from reviewed match data,
stored predictions, stored final results, and the official scoring output. It
posts one durable image per completed tournament period. For the current
reviewed group-stage seed, the automatic recap periods are:

- `group-week-1`: matches #1-#24
- `group-week-2`: matches #25-#48
- `group-week-3`: matches #49-#72

A period is eligible only after every match in that period has a stored final
result. Startup and result sync backfill completed periods that do not already
have recap posts; they do not live-edit older completed period artifacts after
unrelated later matches. Operators can run `/copanalhas copanalhas-recap-painel`
to intentionally refresh/backfill completed recap posts, or pass the optional
`period` value such as `group-week-2` to refresh only one artifact. The feature
stores only the Discord message pointer per period and lightweight derived
snapshot rows; it does not store raw private message content. The recap image may
resolve the current Discord display avatars for the weekly profile cards while
rendering, but avatar URLs and image bytes are not persisted.

Prediction reveal posts are automatic. Every minute, the bot checks for matches
whose prediction cutoff has passed, groups matches that share the same cutoff
and matchday card, and posts one compact message in the matchday card thread.
The bot records one reveal row per match, so restarts do not duplicate the
thread post. Member mentions are rendered for readability with pings disabled.
When all matches represented by a reveal message have stored results, the bot
edits that same thread message from `Palpites encerrados` to `Resultado`,
showing the final score and points gained by each participant.

Match-start alerts are automatic only when `COPANALHAS_MATCH_START_ROLE_ID` is
configured. Every minute, the bot checks for reviewed matches whose alert window
has arrived, defaulting to five minutes before kickoff with
`COPANALHAS_MATCH_START_LEAD_MINUTES`, groups simultaneous kickoffs into one
configured-channel message, and allows only that role mention to ping. The alert
includes the match list and a CazeTV link. The bot records one alert row per
represented match so restarts do not duplicate pings. The same scheduler deletes
the alert message after all represented matches have stored results, or after
`COPANALHAS_MATCH_START_DELETE_AFTER_MINUTES` from kickoff as a fallback for
late result sync. If the bot misses the early window, it can still catch up for
`COPANALHAS_MATCH_START_GRACE_MINUTES` after kickoff.

`reset-test-date` is the broader smoke-test reset. It clears posted-card dedupe
records, predictions, prediction reveal records, match-start alert records, and
results for matches on the selected date, then refreshes standings, leaderboard,
bracket, and due recap backfills so temporary manual results do not keep
affecting public tables. Durable recap artifacts already posted to Discord are
not automatically deleted by reset commands.

`meus-palpites` is member-facing and private. It defaults to the active
operational matchday and shows only that matchday's predictions for the caller.
The optional `date` argument exists for test runs and catch-up days.

`predictions` is an operator-only private audit view. It can show submitted
picks before the prediction window closes, which helps with smoke tests and
moderation without exposing picks to other members. `reveal` is the public view:
it refuses while the prediction window is still open and posts the pick list only
after the match cutoff has passed.

`repost-reveal` is an operator-only private recovery command for cases where the
automatic locked-prediction reveal thread message was deleted or otherwise needs
to be recreated. It clears only the stored reveal pointer for the selected match
or its grouped reveal message, then reruns the normal locked-reveal post flow.
Predictions, results, standings, leaderboard, and bracket data are not touched.

Match arguments for `predictions`, `reveal`, `repost-reveal`, and `result` use
Discord autocomplete. Operators can search by match number, team code,
translated team name, original team name, or date instead of typing internal
match IDs.

`sync-results` is an operator-only private command for match-end impatience. It
bypasses the scheduled result-sync delay for unresolved Football-Data mapped
matches that have already kicked off, but it still stores only provider matches
whose status is `FINISHED`.

## Permissions

The Discord application should stay scoped to the owned guild/channel. Any change
that broadens intents, guild scope, channel scope, stored data, or posting
permissions must update this document and `docs/security-privacy.md`.
The bot needs permission to create public threads from matchday card messages and
send messages in those threads. If match-start role alerts are enabled, it also
needs permission to mention the configured role and delete its own alert
messages in the configured channel.
