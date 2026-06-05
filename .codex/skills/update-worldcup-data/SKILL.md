---
name: update-worldcup-data
description: Use when updating Copanalhas World Cup fixture, kickoff, team, venue, or result data from FIFA, football-data.org, or another reviewed source.
---

# Update World Cup Data

Use this repo-local skill when refreshing hardcoded or imported World Cup data.

## Workflow

1. Read `docs/data-sources.md` and `docs/scoring-rules.md`.
2. Identify the exact data being changed: fixtures, teams, kickoff times, venues,
   results, or knockout placeholders.
3. Prefer official FIFA schedule/results pages for human verification.
4. Use API data only if the provider is already approved in `docs/data-sources.md`.
5. If a new provider is needed, update `docs/data-sources.md` first with owner,
   docs URL, auth model, limits, terms concerns, consumed fields, and fallback.
6. Update the dataset in a future `data/worldcup/` path with source metadata and
   a schema version.
7. Validate duplicate match IDs, required teams/placeholders, kickoff timestamp
   shape, result completeness, and scoring compatibility.
8. Summarize source URLs, changed match IDs, validation output, and remaining TBD
   slots in the final response.

## Guardrails

- Do not scrape or call random World Cup APIs just because they return JSON.
- Do not store API keys in the repo.
- Do not overwrite reviewed source notes.
- Do not change scoring rules while updating match data.
- When source data conflicts, stop and report the conflict instead of guessing.
