# Kickoff prompt — plan the new Zeta mobile app (paste into a new Claude Code session on this repo)

---

You're the tech lead for **Zeta v2**, a redesign of the Zeta mobile app (personal finance for Colombia). The product has been redefined and a new design system exists. Your job in this session is to **plan the build, not write feature code yet**: produce a technical plan and the scope of the first PR, and flag the decisions that need the owner. Work in Spanish for UI copy and English for code and docs.

## Read first (in this order)
1. `docs/mlp/01-zeta-brief-and-mlp.md`: critique, locked decisions, MLP scope.
2. `docs/mlp/03-experience-proposal.md`: the target experience (3 tabs, onboarding, Revisar, Disponible formula, edge cases).
3. `docs/mlp/04-review-and-reuse-map.md`: what to reuse, change, build and retire. Includes the destinatario/recurring decisions.
4. `docs/mlp/06-ai-assist.md`, `07-category-eval-baselines.md`, `08-train-your-categories.md`: AI assist (evaluated), the 25-category list, merchant-level teaching.
5. `docs/mlp/05-claude-design-prompt.md` and `05b-claude-design-followup.md`: what the designer was asked for.
6. **The new design system and screens:** `<PASTE PATH OR LINK: e.g. design/zeta-v2/ exported from Claude Design>`. Treat it as the visual source of truth. The old `claude-ai-design/Zeta Wireframes.html` and `docs/design-system/` describe the *previous* app and are superseded for v2 (CLAUDE.md still points to them; propose the CLAUDE.md update).
7. The current code, only as much as you need: `mobile/` (Expo SDK 55, expo-router, NativeWind v4, expo-sqlite + custom sync engine in `mobile/lib/sync/`, Reanimated 4, Gesture Handler, Skia, expo-notifications, expo-speech-recognition), `packages/shared/` (`@zeta/shared`: categorization, reconciliation, idempotency, recurrence, installments, personal debt, weekly digest), `supabase/` (schema, RLS, envelope encryption on 9 tables), `webapp/` (becomes backend + small companion), `services/pdf_parser/`.

## Decisions already made (don't reopen)
- **Native mobile only** for the product. The Next.js webapp stays as backend (server actions/API routes, email ingest, parser proxy) plus a small companion for bulk PDF import. **No web↔mobile parity work.**
- **Stack: React Native + Expo**, reusing `@zeta/shared` and the existing Supabase backend. Not Flutter.
- **Same store identity:** ship as an update to the existing app (bundle `com.venti5.zeta`) so current users migrate; existing data must keep working.
- **One number: Disponible** (safe-to-spend until next payday, and per day), cash-based. One verdict function (Vas bien / Cuidado / Te pasaste) used everywhere.
- **3 tabs:** Inicio, Movimientos, Revisar. One row grammar, one detail sheet, one way to edit.
- **Capture:** Android bank-notification reading with a user-chosen app list, exact templates, a training inbox, auto-capture only on full match. iPhone: Gmail read-only (bank senders). Statement PDF always. Manual quick-add, plus voice/text (phone speech-to-text, deterministic parser first, small LLM fallback).
- **Te deben** is its own ledger (only your share is spending; Disponible drops by the full amount paid). **Trips** are a separate pot. **Category limits:** 3 suggested by default, more allowed.
- **Categories:** the 25-category default list; teaching is per merchant (destinatario with `kind = business`), with a Siempre / Casi siempre / Pregúntame policy. People are destinatarios with `kind = person`. Merge `category_rules` into destinatario rules over time.
- **Keep as engine:** PDF parsers, email parsing, idempotency + reconciliation + capture hierarchy, destinatario rules, recurring templates → occurrences, installment estimation, personal debts, trips data, weekly digest, FX cache, encryption.
- **AI:** suggests only; code decides. Jev not used for categories (eval); a small LLM once per new merchant, cached.

## What to produce
Write `docs/mlp/10-build-plan.md` with:

1. **Build approach, with a recommendation:**
   - **(a)** a new route tree/app shell inside `mobile/`, retiring old screens as the new ones land, or
   - **(b)** a new Expo app in the monorepo (e.g. `apps/zeta/`) that replaces `mobile/` at release under the same bundle ID.

   Weigh: reuse of repositories/sync, risk of dragging the old UI, store continuity, migration of local SQLite data, CI/EAS changes.
2. **Data layer decision, with a recommendation:** keep the offline-first SQLite + sync engine, or go online-first with a local cache plus a durable **capture queue** (notification capture must work offline either way). Give the concrete cost of each against the new scope (≈8 screens, fewer tables).
3. **Design system → code:** how tokens (color light/dark, type, spacing, radius, elevation), primitives (Row, Chip with suggested/pre-selected/selected states, Verdict pill, Bottom sheet, Buttons, Segmented control, Draggable card + Drop zone, Empty state) and icons map to RN. Decide NativeWind (v4, Tailwind v3 syntax) vs a typed theme object; one source of truth for tokens. Include a Storybook or preview-screen strategy.
4. **Domain/engine work in `@zeta/shared`,** each as a pure, tested function:
   - `computeDisponible` (cycles from payday, bills and cuotas, card-payment neutralization, Te deben, trips, carryover, irregular income, missing-data states) and the single `verdict` function with hysteresis;
   - merchant policy resolution;
   - the category-suggestion pipeline (rules → merchant default → LLM for new merchants).

   Define inputs/outputs and the test cases from `03` §6–§7.
5. **Schema changes (Supabase),** listed per table. Respect envelope encryption: spawn `supabase-migrator` for `_enc` tables. Expected:
   - payday/cycle settings on the profile;
   - the destinatario policy + usual categories;
   - the 25-category defaults and a mapping for existing users' categories;
   - the Te deben share at purchase time (today spending = `amount − split_repaid_amount`);
   - notification templates (server-signed pack + user-trained);
   - the capture method `NOTIFICATION` (tier 2) in `capture-hierarchy.ts` + enum;
   - the Gmail link.

   Mark which are additive vs breaking.
6. **Native capabilities:**
   - an Android NotificationListenerService via an Expo module (Kotlin) with package allowlist, on-device filtering, heartbeat and OEM battery guidance, plus Play policy/prominent disclosure;
   - Gmail OAuth read-only (backend-side token handling, the restricted-scope verification plan);
   - speech-to-text (existing);
   - push (existing, local reminders plus a server digest).

   Estimate each and name the risks.
7. **Migration of existing users:** data mapping (categories → 25, recurring → Pagos, personal debts → Te deben semantics, trips), what happens on first launch of v2, rollback.
8. **Milestones as vertical slices,** each shippable to internal testing:
   - M0 foundations (tokens, primitives, nav, auth, data layer);
   - M1 Inicio + Disponible + Movimientos + detail sheet;
   - M2 Revisar + categories + merchant policy;
   - M3 Pagos + Te deben + Límites;
   - M4 Android notification capture + training;
   - M5 Gmail + PDF + voice;
   - M6 onboarding polish, push, digest, store release.

   For each: screens, engine pieces, schema, done criteria, rough size.
9. **Quality gates:** which existing review agents still apply (`mobile-sync-doctor`, `mobile-perf-doctor`, `supabase-migrator`, `import-flow-doctor`, `recurring-doctor`) and which rules in `CLAUDE.md` are webapp-only for v2. Propose the `CLAUDE.md` changes.
10. **Open questions for the owner,** at most 7, each with your recommendation.
11. **The first PR:** exact scope (files/folders), what it proves, how to verify it on a device/simulator.

## Rules
- Don't write feature code in this session; small spikes are fine only to answer a feasibility question (say so and keep them out of the plan branch, or delete them).
- Verify claims against the code before writing them (e.g. what `mobile/lib/sync/` really does, which tables mobile syncs).
- Be concrete: file paths, function names, table names. No generic advice.
- Keep the plan to roughly 3,000–5,000 words; tables over prose.
- Commit the plan on your branch and push; don't open a PR unless asked.
