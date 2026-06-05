# Implementation Patterns

## Pattern Domains

`pattern-reviewer` should focus on these domains:

- Discord ingestion boundaries
- prediction parser boundaries
- scoring determinism
- World Cup source-data trust
- persistence and audit trail design
- secret and private-message minimization

## Required Patterns

- Keep Discord SDK objects at the edge. Convert them into project-owned input
  records before parsing or scoring.
- Keep scoring pure. Scoring accepts predictions and match results and returns a
  computed result without reading Discord, files, clocks, or environment.
- Treat World Cup data updates as reviewed imports with source metadata.
- Prefer explicit rejection over fuzzy parsing for ambiguous predictions.
- Make late/edit policy visible in one module and one doc section.
- Keep raw Discord content out of durable storage unless explicitly justified.

## Anti-patterns

- Parsing predictions inside Discord event handlers.
- Computing points incrementally in a way that cannot be reproduced.
- Pulling live schedule data from an unreviewed endpoint at scoring time.
- Using broad guild/message intents for convenience.
- Logging bot tokens, raw message bodies, or private server identifiers in test
  fixtures or examples.
