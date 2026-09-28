# Zeta v2 — decision log

Decisions taken in the planning sessions (`docs/mlp/sessions/`). Where one contradicts `10-build-plan.md`, this log wins; the plan is rewritten at the end of session 6.

| ID | Date | Decision | Replaces |
|---|---|---|---|
| S1-1 | 2026-09-28 | **Offline-first with one shared engine.** Every user or capture action is a *command* whose logic lives once in `@zeta/shared`. The phone runs it immediately against local SQLite (full result offline: dedup, merchant, category, bills, balances, Te deben) and queues the command, not the rows. The server replays the same command with the same code against Postgres (plus what only it sees: Gmail, PDF) and records the command id so replays are idempotent. Sync brings the server's result back. One test suite runs every command against both storage adapters. Cost: +2–3 weeks in M0/M1. Needs signal only for: Gmail capture, PDF parsing, naming never-seen merchants, template pack updates, detail older than the local window, new-device sign-in. | `10-build-plan.md` §2 "captures go through `/api/ingest`, phone shows pendiente" |
| S1-2 | 2026-09-28 | **Conflicts split by kind of field.** Bank facts (amount, date, merchant text): higher capture tier wins (PDF › email › notification › manual). User choices (category, note, split/share, cuotas, trip, bill link): the user's value always survives a server replay; same field edited on two devices → latest edit wins (per-field timestamp). Weak duplicate matches are never auto-resolved; they become a Revisar card. | — |
