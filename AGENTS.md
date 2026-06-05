# AGENTS.md

## Project

Copanalhas is a private Discord prediction game for the FIFA World Cup. It reads
predictions from one configured channel in one Discord server owned by the
operator. The game is points-only: no real money, no odds, no payouts, and no
wagering mechanics.

## Source Priority

Read these docs before changing behavior:

1. `docs/product-brief.md`
2. `docs/architecture.md`
3. `docs/discord-ingestion.md`
4. `docs/scoring-rules.md`
5. `docs/data-sources.md`
6. `docs/security-privacy.md`
7. `docs/testing-policy.md`
8. `docs/conventions/implementation-patterns.md`

## Discord Safety Rules

- Scope collection to configured `DISCORD_GUILD_ID` and `DISCORD_CHANNEL_ID`.
- Store the bot token only in environment variables or secret storage.
- Do not commit Discord tokens, guild IDs for public examples, channel IDs for
  public examples, or raw exported private channel history.
- Prefer parsed prediction records over raw message storage.
- If raw message content is temporarily needed for parser debugging, document the
  reason and delete it once the parser behavior is covered by tests.
- Treat Discord Message Content access as privileged. Do not broaden intents or
  permissions without updating `docs/discord-ingestion.md`.

## World Cup Data Rules

- FIFA schedule/results pages are the source of truth for manual verification.
- `football-data.org` is the preferred candidate for API-backed match data only
  after token, rate-limit, coverage, and terms are checked for this tournament.
- Unofficial community APIs are research inputs, not trusted sources, until a
  review is recorded in `docs/data-sources.md`.
- Use `.codex/skills/update-worldcup-data/SKILL.md` when refreshing hardcoded
  schedule or result data.

## Agent Workshop Profile

This repo adopts the Agent Workshop `review-core` pack:

- `spec-reviewer`: use before implementation begins on meaningful specs or plans.
- `pattern-reviewer`: use for architecture, data-flow, Discord ingestion, scoring,
  and source-trust changes. Its pattern domains are defined in
  `docs/conventions/implementation-patterns.md`.
- `test-quality-reviewer`: use when changing parser, scoring, data update, or
  Discord ingestion behavior. Its policy is `docs/testing-policy.md`.

Do not install broad docs, research, governance, or visual agents until the repo
has enough workflow surface to justify them.

## Development Conventions

- Keep Discord API code separated from parsing, scoring, storage, and World Cup
  data providers.
- Make scoring pure and deterministic from predictions plus final results.
- Keep data-source imports explicit, reviewable, and repeatable.
- Add implementation docs only when they become source-of-truth for future work.
