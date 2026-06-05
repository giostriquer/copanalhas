# Architecture

## Initial Shape

The project should be split into five boundaries:

1. Discord ingestion: connects to Discord, filters by guild/channel, and forwards
   candidate messages.
2. Prediction parser: converts allowed message formats into structured prediction
   records or parser errors.
3. Tournament data: stores match IDs, teams, kickoff times, phases, and results.
4. Scoring engine: computes points and leaderboard rows from predictions/results.
5. Persistence and audit: stores predictions, parse failures worth reviewing,
   match data snapshots, and scoring runs.

Keep these boundaries independent. Discord SDK types should not leak into scoring
or tournament-data logic.

## Data Flow

1. Discord emits a message event for the configured channel.
2. Ingestion rejects messages outside the configured guild/channel.
3. Parser attempts to match a supported prediction format.
4. Valid predictions are upserted by user and match according to the active edit
   policy.
5. Results are imported from reviewed World Cup data sources.
6. Scoring recomputes points from predictions and final results.
7. Leaderboard output is generated from the scoring result.

## Future Implementation Notes

A TypeScript Node service is a good default because Discord bot tooling is mature
there. SQLite is enough for the first private version unless concurrent operators
or hosted multi-instance deployment become real requirements.

Do not pick the final stack inside docs alone. Choose it in the implementation
spec, with current Discord library docs checked before coding.
