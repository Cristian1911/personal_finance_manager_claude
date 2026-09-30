# v2 phone engine — execution ledger

Plan: `2026-09-30-v2-phone-engine.md` · Spec: `../specs/2026-09-30-v2-phone-engine-design.md`

Cloud session scope (owner): Tasks 1–5, Task 6 Step 4 (gates) and Step 5 (reviews). Task 6 Steps 1–3 (iOS simulator) are left for the local Mac session; Step 6 (PR) is not opened yet.

## Progress

| Task | State | Commit |
|---|---|---|
| 1 Injectable hash + engine SQLite schema | done | `fdb6119` |
| 2 Outbox — `applyAndEnqueue` | done | `0159673` |
| 3 Phone database | done | `8f6e397` |
| 4 Local runner + self-test | done | `903b68b` |
| 5 Debug screen | done | (this commit) |
| 6.1–6.3 Simulator | left for the local session | |
| 6.4 Gates | pending | |
| 6.5 Reviews | pending | |

## Rulings (deviations from the plan)

- **R1 — Skill not available.** `superpowers:executing-plans` is not installed in the cloud session. The plan was executed inline task by task following its steps; this file is the ledger.
- **R2 — `foreign_keys = ON` (Task 3).** The plan's `openKeyed` omits it; spec §2 lists it among the connection pragmas. Added to match the spec (no FKs in schema v1, so no behaviour change today).
- **R3 — Delete WAL/SHM siblings (Task 3).** expo-sqlite 55's `deleteDatabaseAsync` removes only the main file (checked in the iOS and Android sources). A `-wal` left by a crash was written with the old key and would break the rebuilt file (Review Focus 2). Added `deleteDatabaseFiles(name)` (main, `-wal`, `-shm`) and used it in the rebuild path, `resetV2Database` and the self-test.

- **R4 — Button label colours (Task 5).** In the plan, the text colour lived only in the `Pressable`'s class (`BRASS_BUTTON_CLASS` / `GHOST_BUTTON_CLASS`); React Native `Text` does not inherit it, so ghost labels would render default black on the dark surface. The label now sets `text-z-ink` (primary) or `text-z-sage-light` (ghost), as the other screens do.
- **R5 — Route guard as a wrapper (Task 5).** The plan returned `<Redirect>` after the hooks, so the mount effect still opened (and created) `zeta-v2.db` and its Keychain key in a production build reached by deep link. The default export now redirects before the screen component mounts.
- **R6 — Colombia date (Task 5).** The test capture used `new Date().toISOString().slice(0, 10)` (UTC; rolls the day after ~7 pm COT, forbidden by CLAUDE.md). Uses `toColombiaDateString()` from `lib/utils/date`.
- **R7 — Panel class (Task 5).** The plan's `rounded-2xl bg-z-surface-2` panels became `PANEL_SURFACE_CLASS` (the existing standard panel), and the spinner uses `COLORS.brass` instead of the platform default.

## Notes

- Task 1: the first cold run of the engine suite had 3 failures that did not reproduce in three later runs (57/57 each). Likely the default 5 s Vitest timeout on a cold PGlite start (each contract test boots a fresh PGlite). Pre-existing; watched in the gates.
