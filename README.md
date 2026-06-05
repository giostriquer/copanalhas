# copanalhas

Copanalhas is a private Discord-based prediction game for the FIFA World Cup.
It collects point-based match predictions from one configured channel in one
Discord server owned by the operator. It is not gambling, does not involve real
money, and should not collect more Discord data than is needed to score the game.

## Goals

- Collect match predictions from a single configured Discord guild/channel.
- Parse predictions into structured records tied to Discord user IDs and match IDs.
- Keep World Cup match data reviewable and updateable as the tournament changes.
- Score exact scoreline predictions and closest misses deterministically.
- Preserve enough audit history to explain leaderboard changes.

## Non-goals

- No real-money betting, odds, payouts, or wagering features.
- No collection across multiple servers unless explicitly redesigned.
- No broad Discord message archiving.
- No dependency on unofficial sports APIs without a source and safety review.

## Current Status

This repository currently contains the project brief, architecture notes, safety
policy, scoring rules, and repo-local Agent Workshop onboarding. Implementation
should start from the docs in `docs/` and use `AGENTS.md` as the contributor and
agent routing guide.

## Documentation

- `docs/product-brief.md` describes the product scope.
- `docs/architecture.md` sketches the initial system boundaries.
- `docs/discord-ingestion.md` defines Discord API and collection constraints.
- `docs/data-sources.md` records the World Cup schedule data policy.
- `docs/scoring-rules.md` defines the scoring model.
- `docs/security-privacy.md` captures safety and privacy constraints.
- `docs/testing-policy.md` defines the initial testing posture.
- `docs/conventions/implementation-patterns.md` is the source for pattern review.
