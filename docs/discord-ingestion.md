# Discord Ingestion

## Current API Constraints

Discord apps receive events through gateway intents. Message content is privileged:
without the Message Content intent configured or approved where required, message
objects can arrive with empty `content`, `embeds`, `attachments`, and `components`.
Bot API calls must authenticate with a bot token, and HTTP Authorization headers
use the `Bot <token>` scheme.

For Copanalhas, the bot should request only the intents and channel permissions
needed to read prediction messages in the configured channel and optionally post
summaries back.

## Channel Scope

Every ingestion path must check:

- configured guild ID
- configured channel ID
- author is not the bot itself
- message timestamp is within the active collection policy for the match

Messages outside the configured guild/channel are ignored before parsing.

## Storage Policy

Prefer storing parsed prediction records:

- Discord user ID
- Discord message ID
- match ID
- predicted home score
- predicted away score
- created/edited timestamp
- parser version

Avoid storing raw message content. If parser diagnostics need raw content, keep it
short-lived, mark it as diagnostic data, and cover the parser case with tests so
raw content can be removed.

## Permissions

The first implementation should document the exact Discord Developer Portal and
server permissions it needs before asking the operator to enable them. Any change
that broadens intents, guild scope, or channel scope must update this document and
`docs/security-privacy.md`.
