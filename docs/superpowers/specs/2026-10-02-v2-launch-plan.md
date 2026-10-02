# Zeta v2 — launch plan (submit Oct 20, the Nov 10 bet)

**Date:** 2026-10-02 · **Decisions:** S9-1 … S9-5 (`docs/mlp/12-decision-log.md`) · **Interaction spec:** `2026-10-01-v2-interaction-design.md`
**Goal:** the most active users by **Nov 10**, measured on the store dashboards. v2 ships as the store app's update on **Oct 20**, then ~3 weeks of growth.
**Split:** the owner fixes Google/Apple sign-in (on the v2 backend); Claude builds v2.

## 1. What changes from the M0–M7 plan

| Before | Now |
|---|---|
| v2 behind a flag until M7, then a migration of v1 users | **Everyone moves to v2 on the Oct 20 update.** Fresh start on a new backend; old data stays untouched on today's production and is migrated later (§7). |
| Separate dev project; production by hand | **zeta-dev (`gmqgfdijdfvltwiiqbug`) becomes v2 production.** Today's production (`tgkhaxipfgskxydotdtu`) keeps running the web app and v1 data, never written by v2. |
| Capture: email, PDF, Android notifications, iPhone Shortcuts (M2, M5, M6) | **Launch capture: Anotar (manual) + bank-email forwarding + Dictar (voice).** PDF, Android notifications and Shortcuts come after Nov 10. |
| Sync and the command runner in M2 (3 weeks) | **A launch-sized sync** (§3): enough for email movements to reach the phone and for the phone's data to survive a reinstall. |

## 2. What ships on Oct 20

- **Sign in** (Google, Apple, email) on the v2 backend; old sessions are discarded and the user signs in again.
- **Onboarding:** when you get paid, how much, how much you have today, **your fixed payments before payday** (without them Disponible is wrong), your accounts, optional email forwarding setup.
- **Inicio** (built), **Tu flujo** (built), **Movimientos + Detalle A** (PR #445), the **open row** with ⋯.
- **Anotar** (the "+"): Gasto / Ingreso / Entre cuentas, effect line, **Dictar**.
- **Mis cuentas + Cuenta + Agregar.**
- **Pagos fijos, minimal:** add, list, mark paid, auto-link by amount + date window (needed so Por pagar is real).
- **Ajustes:** Tu número (Cuándo me pagan, Ahorro, Mis cuentas), Fuentes (email forwarding), Apariencia, Bloqueo, Privacidad (incl. **Borrar mi cuenta**, required by Apple), Ayuda, Cerrar sesión.
- **Last, before submit (S9-6):** **categories** (25 + seeding, the picker, "¿Siempre para X?"), **destinatarios** (picker, sheet, comercio/persona), **PDF import** (the existing parser service → v2 commands). Revisar and Te deben if time allows. All reuse v1 code.
- **Not at launch:** Límites, Pagos tab content beyond the minimal list, Android notifications, Shortcuts, Plus.

## 3. Sync, launch-sized

- **Push:** the phone's outbox drains to `POST /api/v2/commands` (webapp route, Bearer auth, applies each command with the same engine through the Postgres adapter as the user, returns the stored result; idempotent by command id). Drains on foreground and after each command when online.
- **Pull:** `GET /api/v2/changes?since=<cursor>` returns the user's own rows changed since the cursor for the v2 tables the phone holds (accounts, account_settings, transactions in the last 3 cycles, user_cycle_settings, recurring templates/occurrences for the launch Pagos fijos). The phone upserts them into SQLite. Cursor = server `updated_at`.
- **Reinstall / new phone:** sign in → full pull → same data.
- **Conflicts:** the engine's rules already apply on the server (field versions, tiers); the pull overwrites local rows with the server's result.
- **Server env:** the routes live in the existing webapp deploy but use `V2_SUPABASE_URL` / `V2_SUPABASE_PUBLISHABLE_KEY` / `V2_SUPABASE_SECRET_KEY` (zeta-dev), never the production client.

## 4. Email capture on v2

- Each user gets a forwarding address (exists in v1: Resend inbound). The v2 inbound route resolves the address → v2 user, parses with the existing bank templates, and applies a new **`captureBankEmail`** command (tier 2, same idempotency key as v1) on zeta-dev. The phone gets it on the next pull.
- Setup lives in Onboarding (optional) and Ajustes › Fuentes (copy address, step-by-step for Gmail filter).

## 5. Dictar

- On the phone: device speech recognition → text → the offline parser ("almuerzo 45 mil en efectivo" → amount, what, account). If it doesn't understand, the text goes to "En qué" and the user completes the rest. A server fallback (Claude Haiku, S4-4) is a later improvement.

## 6. Making zeta-dev production

- Checked 2026-10-02: no auth users and every public table empty (no system categories seeded either). Integration tests create and delete a temporary user per run; move them to a separate dev database before real users arrive.
- Backups: not while the owner is the only user (S9-6); turn on before the public launch.
- Auth: providers (Google, Apple, email) configured on zeta-dev — **the owner's Google work targets this project**: Supabase → Auth → Google client ids; Google Cloud OAuth clients (Android SHA-1 of the Play signing key + upload key; iOS; web) pointing at `https://gmqgfdijdfvltwiiqbug.supabase.co/auth/v1/callback`; Apple Services ID return URL to the same callback.
- RLS on every table (already applied by the migrations); `pnpm audit` and the mobile security review before submit.
- The app build for Oct 20 points `EXPO_PUBLIC_SUPABASE_URL` at zeta-dev and turns v2 on by default.

## 7. Migration of v1 data (after Nov 10)

A one-time import per user, opt-in from Ajustes: "Traer mis datos de la versión anterior" → sign in to the old account → server copies accounts, transactions, recurring, debts from production into zeta-dev as commands (`importLegacy*`), deduplicated by idempotency key. Designed after the launch; nothing in the launch blocks it.

## 8. Calendar (18 days)

| Days | Work | PRs |
|---|---|---|
| Oct 2–3 | Merge #445. zeta-dev production-ready (§6). App env switch. | ops, `chore(v2): point the app at zeta-dev` |
| Oct 3–6 | Shared components + tab bar + FAB. Sync push (`/api/v2/commands` + outbox drain). | 2, 3 |
| Oct 6–9 | Sync pull + reinstall path. Accounts on the phone (schema v5, create/edit/archive) + Mis cuentas / Cuenta. | 4, 5 |
| Oct 9–12 | Anotar (Gasto, Ingreso, Entre cuentas) + Dictar. Pagos fijos minimal. | 6, 7 |
| Oct 12–15 | Email capture (route + `captureBankEmail` + Fuentes setup). Onboarding v2. | 8, 9 |
| Oct 15–17 | Ajustes shell (incl. Borrar mi cuenta). v2 default; v1 hidden. | 10, 11 |
| As time allows, before Oct 20 | Categories → destinatarios → PDF import (S9-6), reusing v1 code. | 12–14 |
| Oct 17–19 | Full walk on iPhone + Android, store screenshots and listing, privacy labels updated (new data flows: email forwarding). | — |
| **Oct 20** | **Submit** (App Store; Play closed track → production when approved). | — |
| Oct 20–Nov 10 | Growth (WhatsApp, community, social, ads when Android is public) + fixes. | — |

Each PR: plan → TDD → gates → reviews → owner check on a device. Merge to `main` deploys the webapp (the v2 routes are inert until the app calls them).

## 9. Risks

- **Google Play production access** (rejected twice) gates public Android regardless of v2. Round 3 must run in parallel (owner).
- **Sign-in on the new backend** must work on both platforms before any test user can try v2.
- **Store review** of a big update: Apple may ask about data handling (email forwarding). Privacy labels and the Privacidad screen must match.
- **Scope:** the owner wants categories, destinatarios and PDF in the launch; they're scheduled last. If time runs short, cut first: Entre cuentas → Dictar; then decide with the owner between email capture and the S9-6 items.
