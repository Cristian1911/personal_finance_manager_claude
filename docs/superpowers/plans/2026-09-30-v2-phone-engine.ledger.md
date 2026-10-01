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
| 5 Debug screen | done | `e92ccf7` |
| 6.1–6.3 Simulator | done in the local Mac session (2026-09-30, iOS 27 simulator) | — |
| 6.4 Gates | done (run before and after the review fixes) | |
| 6.5 Reviews | done; fixes applied | (review-fix commit) |

## Rulings (deviations from the plan)

- **R1 — Skill not available.** `superpowers:executing-plans` is not installed in the cloud session. The plan was executed inline task by task following its steps; this file is the ledger.
- **R2 — `foreign_keys = ON` (Task 3).** The plan's `openKeyed` omits it; spec §2 lists it among the connection pragmas. Added to match the spec (no FKs in schema v1, so no behaviour change today).
- **R3 — Delete WAL/SHM siblings (Task 3).** expo-sqlite 55's `deleteDatabaseAsync` removes only the main file (checked in the iOS and Android sources). A `-wal` left by a crash was written with the old key and would break the rebuilt file (Review Focus 2). Added `deleteDatabaseFiles(name)` (main, `-wal`, `-shm`) and used it in the rebuild path, `resetV2Database` and the self-test.

- **R4 — Button label colours (Task 5).** In the plan, the text colour lived only in the `Pressable`'s class (`BRASS_BUTTON_CLASS` / `GHOST_BUTTON_CLASS`); React Native `Text` does not inherit it, so ghost labels would render default black on the dark surface. The label now sets `text-z-ink` (primary) or `text-z-sage-light` (ghost), as the other screens do.
- **R5 — Route guard as a wrapper (Task 5).** The plan returned `<Redirect>` after the hooks, so the mount effect still opened (and created) `zeta-v2.db` and its Keychain key in a production build reached by deep link. The default export now redirects before the screen component mounts.
- **R6 — Colombia date (Task 5).** The test capture used `new Date().toISOString().slice(0, 10)` (UTC; rolls the day after ~7 pm COT, forbidden by CLAUDE.md). Uses `toColombiaDateString()` from `lib/utils/date`.
- **R7 — Panel class (Task 5).** The plan's `rounded-2xl bg-z-surface-2` panels became `PANEL_SURFACE_CLASS` (the existing standard panel), and the spinner uses `COLORS.brass` instead of the platform default.

- **R8 — Rebuild only an unreadable file (review, mobile-sync-doctor F1, required).** The plan's `openV2Database` rebuilt on any open error, so a busy database, a full disk or a failed future migration would wipe the file and its queued outbox; and a delete that failed silently (file still open) was followed by a new key overwriting the good one. Now: rebuild only on SQLCipher's "file is not a database" / "malformed" (SQLite codes 26/11), rethrow anything else (the single-flight retries on the next open); `deleteDatabaseFiles` ignores only "not found" and rethrows the rest; the new key is generated first and saved to SecureStore only after the fresh file opens with it. `createDbKey()` became `newDbKey()` + `saveDbKey(key)`.
- **R9 — Recover a connection left in a transaction (review F2, optional, applied).** If COMMIT and then ROLLBACK both fail, the connection stays inside a transaction and every later `BEGIN IMMEDIATE` fails until restart. The driver now checks `isInTransactionAsync()` before `BEGIN` and rolls back the leftover.
- **R10 — Debug buttons disabled while busy (review F3 + zetas-front-guy optional 1–2).** Prevents a reset closing the database under an in-flight command and accidental double captures; the spinner has an accessibility label. Concurrency itself stays covered by the Autoprueba line "Dos comandos a la vez no se mezclan".
- **Not applied (optional, logged):** warning about pending outbox rows before a rebuild (F1.4) belongs to M2, already flagged by the `ponytail` comment; `text-z-debt` instead of `text-z-expense` for failures, a destructive style for "Borrar base v2" (not one of the approved button variants), and Spanish wrapping of raw error/JSON text in a debug tool — cosmetic.

## Notes

- Task 1: the first cold run of the engine suite had 3 failures that did not reproduce in three later runs (57/57 each). Likely the default 5 s Vitest timeout on a cold PGlite start (each contract test boots a fresh PGlite). Pre-existing; watched in the gates.
- Gates (after review fixes): `pnpm install` (lockfile unchanged), `pnpm --filter @zeta/shared test`, `pnpm build:web`, `mobile: npx tsc --noEmit`, `pnpm audit --audit-level high` (2 high, both ignored image-size advisories). Results in the session summary.
- `superpowers:systematic-debugging` was not needed: no gate failed.
- Task 6 Steps 1–3 (local Mac, 2026-09-30, on `main` after #441): v1 opens its data; Autoprueba 9 de 9; Inicio three questions → $2.000.000, a $25.000 expense → $1.975.000; Simular clave perdida → "Bien". First run gave **8 de 9** ("legible sin clave"): the existing `mobile/ios/` predated `useSQLCipher` and `expo run:ios` doesn't re-run prebuild, so the build had plain SQLite. Fixed with `npx expo prebuild -p ios` + `pod install`; the self-test caught it as designed. Xcode 27 workarounds (scene delegate, deployment target, no Simulator.app) are in BACKLOG.
