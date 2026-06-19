# World Cup Data Sources

## Source Policy

World Cup schedule and result data affects scoring, so treat it as source data,
not casual runtime decoration.

The preferred source order is:

1. Official FIFA schedule/results pages and PDFs for human verification.
2. `football-data.org` for optional finished-result sync if its free World Cup
   coverage, token requirements, limits, and terms fit this private project.
3. A reviewed hardcoded dataset maintained in-repo.
4. Unofficial community APIs only after a safety and trust review.

## Research Snapshot - 2026-06-05

FIFA publishes the tournament schedule/results pages for all 104 fixtures and an
official schedule release. FIFA also noted that the schedule became final after
March 2026 playoff berths were resolved.

`football-data.org` lists FIFA World Cup coverage in its free coverage table and
provides a v4 API. Copanalhas uses it only when `FOOTBALL_DATA_TOKEN` is set and
`COPANALHAS_RESULT_SYNC_ENABLED` allows sync. The consumed fields are provider
match ID, `utcDate`, `status`, and `score.fullTime`. Football-Data v4 score
nodes use `home`/`away` team keys while older examples may show
`homeTeam`/`awayTeam`. Result sync queries planned provider match IDs through
the `/v4/matches?ids=...` filter because the broader competition date response
can lag detailed match scores.

Football-Data credentials are developer credentials and must not be stored in
open-source repositories. When Copanalhas may use Football-Data result sync, the
public Discord dashboard and public documentation must include visible
attribution:

`Football data provided by the Football-Data.org API.`

Community APIs such as `rezarahiminia/worldcup2026`, `worldcup26.ir`, and
`wc2026api.com` advertise World Cup 2026 fixtures and scores. They are useful to
inspect, but they should not become trusted production sources without checking
maintenance, terms, rate limits, ownership, and data provenance.

## Regulations Snapshot - 2026-06-19

The official `Regulations for the FIFA World Cup 26`, published by FIFA in May
2026, is the source of truth for competition-format logic that Copanalhas can
derive from results:

- 12 groups of four teams.
- Group stage followed by round of 32, round of 16, quarter-finals,
  semi-finals, third-place play-off, and final.
- Group standings tiebreakers start with head-to-head points, head-to-head goal
  difference, and head-to-head goals scored among the tied teams.
- If teams still cannot be separated by score-derived criteria, team conduct and
  FIFA ranking criteria may be required. Copanalhas should not pretend those
  cases are fully automatic unless those inputs are available.
- The 12 group winners, 12 runners-up, and eight best third-place teams qualify
  for the round of 32.
- Annexe C defines the 495 valid combinations for mapping the eight qualifying
  third-place teams into the round of 32.

The extracted Annexe C table lives in `src/worldcup/fifa-annex-c.ts`, and the
pure resolver and validation logic lives in `src/worldcup/fifa-qualification.ts`.
Source URL:
`https://digitalhub.fifa.com/asset/73f73fe3-235a-4f54-b252-b53d3d580ec5/FWC2026_regulations_EN.pdf`

## Hardcoded Dataset Path

The current seed lives in `src/worldcup/seed.ts`. It contains the reviewed full
72-match group stage with groups, teams, local fixture dates, venue-local kickoff
times, UTC kickoff timestamps, and FIFA-style venue names. The seed stores source
metadata with the data.

Knockout fixtures should stay out of this seed until the participating teams are
known or represented with an explicit placeholder type. If future schedule
snapshots become too large for inline TypeScript, they may move to
`data/worldcup/` with:

- machine-readable JSON
- a short source note
- import timestamp
- reviewer initials or commit reference
- schema version

Use `.codex/skills/update-worldcup-data/SKILL.md` for that update workflow.

## Result Sync Policy

FIFA-reviewed fixture data remains the schedule source of truth. Provider data is
used only to confirm finished results for local matches that already have a
reviewed `externalIds.footballData` mapping.

Result sync stores:

- final score
- source `"football-data"`
- provider match ID
- fetch timestamp

Manual results use source `"manual"` and can overwrite provider results. Provider
sync must not overwrite existing manual results.

The bot checks provider results only while `npm run dev -- bot` is running and a
token is configured. It does not poll just because the process is alive. It waits
until at least one mapped, unresolved match is past
`COPANALHAS_RESULT_SYNC_FIRST_CHECK_MINUTES` after kickoff, then sends one
batched date-range request for due matches. If the provider has not marked a due
match final yet, retries wait `COPANALHAS_RESULT_SYNC_RETRY_MINUTES`.
The default first check is 110 minutes after kickoff, approximating 90 minutes
of play, halftime, and a five-minute buffer; default retries are one minute
apart, with duplicate not-due logs suppressed while the next check is unchanged.
Operators can run `/copanalhas sync-results` to force one immediate finished
result check for unresolved mapped matches that have already kicked off.

Keep polling conservative; the free football-data.org client limit is small, and
failures such as rate limiting should not break prediction collection.

## Safety Bar For APIs

Before adding an API provider, record:

- provider owner and documentation URL
- authentication model and secret handling
- free-tier limits and paid-plan traps
- terms of use for private bot/game usage
- uptime and failure behavior
- fields consumed by Copanalhas
- fallback plan if the provider disappears or changes terms
