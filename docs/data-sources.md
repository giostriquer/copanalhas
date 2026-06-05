# World Cup Data Sources

## Source Policy

World Cup schedule and result data affects scoring, so treat it as source data,
not casual runtime decoration.

The preferred source order is:

1. Official FIFA schedule/results pages and PDFs for human verification.
2. `football-data.org` if its free World Cup coverage, token requirements,
   limits, and terms fit this private project.
3. A reviewed hardcoded dataset maintained in-repo.
4. Unofficial community APIs only after a safety and trust review.

## Research Snapshot - 2026-06-05

FIFA publishes the tournament schedule/results pages for all 104 fixtures and an
official schedule release. FIFA also noted that the schedule became final after
March 2026 playoff berths were resolved.

`football-data.org` lists FIFA World Cup coverage in its free coverage table and
provides a v4 API. It requires checking token setup and current tournament access
before making it a dependency.

Community APIs such as `rezarahiminia/worldcup2026`, `worldcup26.ir`, and
`wc2026api.com` advertise World Cup 2026 fixtures and scores. They are useful to
inspect, but they should not become trusted production sources without checking
maintenance, terms, rate limits, ownership, and data provenance.

## Hardcoded Dataset Path

The current MVP seed lives in `src/worldcup/seed.ts`. It contains a reviewed
opening group-stage subset from FIFA's public schedule page and stores source
metadata with the data. Kickoff times are intentionally `null` where this pass
verified the fixture/date/stadium but did not independently verify the local
kickoff time.

If no safe API is selected for the full tournament, future schedule snapshots may
move to `data/worldcup/` with:

- machine-readable JSON
- a short source note
- import timestamp
- reviewer initials or commit reference
- schema version

Use `.codex/skills/update-worldcup-data/SKILL.md` for that update workflow.

## Safety Bar For APIs

Before adding an API provider, record:

- provider owner and documentation URL
- authentication model and secret handling
- free-tier limits and paid-plan traps
- terms of use for private bot/game usage
- uptime and failure behavior
- fields consumed by Copanalhas
- fallback plan if the provider disappears or changes terms
