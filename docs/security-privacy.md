# Security And Privacy

## Boundaries

Copanalhas is a private points game for an owned Discord server. It must not
become a broad Discord scraper, odds tool, payment tool, or wagering system.

## Secrets

- Store Discord bot tokens outside git.
- Store `FOOTBALL_DATA_TOKEN` outside git.
- Never store Football-Data developer credentials in open-source repositories.
- Add `.env` files to `.gitignore`.
- Provide examples with placeholder IDs only.
- Rotate tokens if they are ever pasted into chat, commits, logs, or screenshots.

## Data Minimization

Collect only what is needed to score predictions:

- Discord user ID
- Discord message ID
- match ID
- parsed score prediction
- timestamps needed for cutoff/edit policy

Avoid retaining raw private message content. Avoid collecting display names,
profile data, unrelated channel messages, attachments, reactions, or member lists
unless a later documented feature truly needs them.

Optional provider sync stores only result provenance needed for auditability:
provider name, provider match ID, final score, and fetch timestamp. It must not
store raw provider responses.

If Football-Data sync is enabled, keep the attribution visible in player-facing
or operator-facing dashboard output:

`Football data provided by the Football-Data.org API.`

## Operational Safety

- Ignore all messages outside the configured guild/channel.
- Make source-data imports auditable.
- Log failures without exposing tokens or raw private message bodies.
- Keep admin/operator commands explicit and restricted.
- Use `/copanalhas` commands only in the configured guild/channel.
- Use thread posting only for matchday prediction reveal messages.
- Document permission changes before applying them to the Discord app.
