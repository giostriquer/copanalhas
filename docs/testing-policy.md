# Testing Policy

## Priority Surfaces

The highest-impact behavior is:

1. prediction parsing
2. kickoff/edit cutoff handling
3. scoring and tie behavior
4. World Cup data imports
5. Discord guild/channel filtering
6. secret handling and log redaction

## Expected Coverage Shape

- Parser tests should cover accepted formats, rejected ambiguous formats, edited
  messages, bot messages, and messages outside the active channel.
- Scoring tests should use small tables of predictions/results and assert exact,
  closest, no-exact, exact-plus-closest, and tied-closest behavior.
- Data-source tests should validate schema, duplicate match IDs, kickoff time
  shape, result completeness, and source metadata.
- Discord integration should be wrapped behind an interface so most behavior can
  be tested without live Discord.

## Review Guidance

Use `test-quality-reviewer` for changes that affect parser, scoring, Discord
filtering, source-data import, or leaderboard output. Do not accept tests that
only mirror implementation internals without proving user-visible behavior.
