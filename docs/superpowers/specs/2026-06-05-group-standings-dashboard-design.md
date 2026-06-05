# Group Standings Dashboard Design

## Goal

Give the Discord server a readable, low-noise tournament context surface by
letting the bot maintain current World Cup group standings for all 12 groups.

The bot should keep two editable Discord messages:

- `Groups A-F`
- `Groups G-L`

Each message shows compact group tables and is updated after final scores are
stored. Match prediction cards remain the interactive betting surface; standings
messages are the shared tournament status surface.

## Source Strategy

Group membership, fixtures, kickoff times, and phase metadata come from the
reviewed local World Cup fixture seed. Final scores come from the existing
stored result records, which may be inserted by automatic result sync or manual
operator command.

The standings feature should not introduce a second result source. It consumes
repo-owned fixtures plus stored final scores so it stays aligned with the
prediction scoring system.

## Discord Surface

The bot maintains one dashboard split into two Discord messages because a single
mega table is fragile on mobile and one post per group would create too much
channel noise.

Each dashboard message should use normal message content only: title, last
updated line, dashboard label, and one fenced ASCII code-block table. The table
shows three groups per row band and keeps only the scan-critical dashboard
columns: team code, points, and goal difference. Avoid embeds for this surface;
an embed plus a code block creates a double backdrop that makes the table feel
clunky and more constrained.

Recommended structure for the `Groups A-F` message:

```text
World Cup 2026 Group Standings
Updated: 2026-06-11 18:42 America/Sao_Paulo

Groups A-F

+--------------+--------------+--------------+
| GROUP A      | GROUP B      | GROUP C      |
+--------------+--------------+--------------+
| MEX  0   0   | BIH  0   0   | BRA  0   0   |
| RSA  0   0   | CAN  0   0   | HAI  0   0   |
| KOR  0   0   | QAT  0   0   | MAR  0   0   |
| CZE  0   0   | SUI  0   0   | SCO  0   0   |
+--------------+--------------+--------------+
| GROUP D      | GROUP E      | GROUP F      |
+--------------+--------------+--------------+
| USA  0   0   | GER  0   0   | NED  0   0   |
| PAR  0   0   | CUW  0   0   | JPN  0   0   |
| AUS  0   0   | CIV  0   0   | SWE  0   0   |
| TUR  0   0   | ECU  0   0   | TUN  0   0   |
+--------------+--------------+--------------+
```

The rendered dashboard must preserve:

- group label
- rank
- team code
- goal difference
- points
- last updated timestamp

Full per-group records such as played, wins, draws, losses, goals for, and goals
against remain available in the computation layer and can be exposed later via a
detail command if the dashboard needs a drill-down.

The standings messages should be edited in place. If stored message IDs are
missing or the messages were deleted, the bot should post replacements and store
the new message IDs.

## Storage

Add storage for standings dashboard message IDs, scoped by guild and channel.

Recommended shape:

```text
standings_posts
- post_key: groups_a_f | groups_g_l
- guild_id
- channel_id
- message_id
- created_at
- updated_at
```

This storage supports idempotent posting and lets the bot edit the existing
dashboard after restarts.

## Standings Computation

Compute standings from local group fixtures and stored final results.

For each group team:

- played: count of finished group matches involving the team
- wins/draws/losses
- goals for and against
- goal difference
- points: 3 for win, 1 for draw, 0 for loss

Sorting should be deterministic:

1. points descending
2. goal difference descending
3. goals for descending
4. team name ascending

FIFA tie-breakers are more detailed than this, but this deterministic local
ordering is enough for a dashboard until knockout qualification logic becomes
part of the product.

Matches without stored final results count as unplayed and must not affect the
table.

## Update Flow

The dashboard should update when:

- the bot starts and standings auto-posting is enabled
- an operator runs a standings post/update command
- automatic result sync stores at least one new final score
- manual result entry changes a final score

The update path should:

1. load reviewed group fixtures
2. load stored results
3. compute standings
4. render `Groups A-F` and `Groups G-L`
5. edit existing Discord messages or post replacements
6. store the current message IDs and update timestamps

Failures to edit or post should be reported privately to the operator command
when command-triggered and recorded in status/log output when automatic.

## Operator Controls

Add or extend Discord operator controls so the user can run standings updates on
demand.

Preferred commands:

- `/copanalhas standings` posts or updates the standings dashboard
- `/copanalhas status` includes whether standings posts exist and when they were
  last updated

This keeps normal operation autonomous while preserving a simple manual escape
hatch during development.

## Relationship To Matches Of The Day

Daily match cards and group standings are separate surfaces:

- match cards collect predictions and enforce cutoffs
- standings posts summarize tournament group state

The daily match post can link the idea of the current group phase in its copy,
but it should not duplicate all standings data inside each match card.

## Error Handling

- Missing standings post IDs: post both dashboard messages and save IDs.
- Deleted Discord message: create a replacement and save its ID.
- Discord edit failure: report through command reply or status output.
- Missing group fixture data: fail loudly; standings should not silently omit a
  group.
- Missing result data: treat the match as unplayed.
- Result conflict handling remains owned by the result storage/sync layer.

## Testing

Use unit tests without live Discord or network dependencies.

Cover:

- empty group standings from fixture seed
- points, goals, and records after wins and draws
- deterministic tie sorting
- ignoring unplayed matches
- rendering `Groups A-F` and `Groups G-L`
- storing and reusing standings post message IDs
- replacing missing/deleted standings messages
- update trigger after manual result upsert
- update trigger after automatic result sync imports finals
- `/copanalhas standings` command routing
- `/copanalhas status` includes standings post state

Manual verification should include one smoke run that posts the two messages to
the configured Discord channel using seeded group fixtures and simulated final
results.

## Scope Boundaries

This design does not implement official FIFA qualification tie-breakers, bracket
advancement, images, web dashboards, multi-channel standings, or live in-match
tables. Those can be added after the group dashboard is useful in Discord.
