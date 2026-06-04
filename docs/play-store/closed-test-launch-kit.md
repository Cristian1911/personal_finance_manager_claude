# Closed-Test Launch Kit — Zeta (Play Store, 14-day track)

> Purpose: unblock the **longest pole** to production. A personal Play dev account (registered after Nov 2023) must run a **closed test with ≥20 testers for ≥14 continuous days** before the first production release. This kit is everything you can act on *now* without waiting on code. Start the clock ASAP — the 14 days run in parallel with everything else.

## 0. Pre-upload gate (must be true before the AAB goes up)
- [ ] `mobile/credentials/google-play-service-account.json` present (referenced in `eas.json` → `submit.production.android`). Create in Google Cloud console → grant the service account "Release manager" in Play Console → API access.
- [ ] Confirm Play **account type** (personal vs org). Personal post-Nov-2023 ⇒ the 14-day rule applies. Org ⇒ you may promote closed→prod directly (then this kit just accelerates QA).
- [ ] Build the production AAB: `cd mobile && pnpm build:aab:production` (EAS, `production-android` profile, auto-increments versionCode).
- [ ] Data Safety form filled from `docs/play-store/DATA_SAFETY.md` (now includes Location incl. background + Photos/videos — reconciled 2026-05-30).
- [ ] Background-location **declaration form + demo video** completed in Play Console (required because background location ships). Record: open Settings → toggle "Guardar ubicación…" → the disclosure dialog appears → grant → show a transaction getting a location. 30–60s screen capture.

## 1. Recruiting ≥20 testers
Google counts **opted-in testers**, not installs. Aim for **25–30** enrolled to safely clear 20 active. Channels: family/friends on Android, finance/Colombia communities, Twitter/X, a WhatsApp broadcast. They must:
1. Join via your closed-test **opt-in URL** (Play Console → Closed testing → Testers → copy link), OR be added by email to the tester list / a Google Group.
2. Install from the Play link (not a sideloaded APK — only Play installs count).
3. Open the app at least a few times across the 14 days.

### Tester-recruitment message (Spanish, copy-paste)
> **Ayúdame a probar Zeta 🪙**
> Estoy por lanzar **Zeta**, una app para organizar tus finanzas en Colombia: importa extractos del banco (PDF), te arma un presupuesto 50/30/20, te recuerda tus pagos y te dice "¿puedo pagarlo?".
> Necesito **20+ personas con Android** que la prueben 2 semanas. Solo tienes que:
> 1. Tocar este enlace y unirte: **[PEGAR ENLACE DE PRUEBA CERRADA]**
> 2. Instalar desde Play Store.
> 3. Abrirla unas cuantas veces y, si puedes, registrar un gasto o importar un extracto.
> ¿Te animas? Tu feedback me ayuda muchísimo a lanzarla bien. 🙏

### Tester tracking (fill as they join)
| # | Nombre | Email/teléfono | ¿Unido al enlace? | ¿Instaló? | ¿Abrió? |
|---|--------|----------------|-------------------|-----------|---------|
| 1 | | | | | |
| … | | | | | |
(Target ≥20 with "Abrió" = yes by day 14.)

## 2. What testers should verify (also your reviewer-access path)
Send testers (and use yourself) this short script — exercises the core value + the new shipped work:
1. **Onboarding** → finish setup (purpose, currency, first account). *(fires `onboarding_completed`)*
2. **Registrar un gasto** via the brass + button. *(fires `transaction_created`)*
3. **Importar un extracto PDF** (Bancolombia/Davivienda/etc.) — confirm transactions appear.
4. **Recordatorios de pago**: Settings → Notificaciones → activar; confirm the permission + disclosure.
5. **¿Puedo pagarlo?** and **Plan/Presupuesto** — glance at the numbers.
6. Reviewer demo path: **"Probar demo sin cuenta"** on the login screen (no signup needed).

## 3. Screenshot shot-list (≥2 phone, 9:16, min 1080px — capture POST-rebrand)
Capture on a clean device/emulator with demo data seeded ("Probar demo sin cuenta"):
1. **Dashboard / Inicio** — hero "¿voy bien?" + ritmo. (the money shot)
2. **Plan 50/30/20** — allocation + flujo.
3. **Importar** — the PDF import wizard mid-flow.
4. **Movimientos** — transaction list with categories/destinatarios.
5. **Deudas** — payoff overview.
6. *(optional)* **Recordatorios** — the payment-reminder notification.
- Feature graphic 1024×500 already at `logo-exports/play-store/feature-graphic-1024x500.png`; icon 512 at `play-store-icon-512.png`. Confirm these are the final post-rebrand assets.
- Listing copy: review/finalize `docs/play-store/LISTING_ES.md` (título 30ch, descripción corta 80ch, completa 4000ch).

## 4. Day-by-day
- **Day 0**: upload AAB to closed track → opt-in link live → blast the recruitment message → fill Data Safety + declarations.
- **Days 1–14**: keep testers engaged (a mid-test "¿cómo va?" ping helps). Watch the Play **pre-launch report** (automated crash/perf) and fix blockers.
- **Day 14+**: if ≥20 testers stayed opted-in for the full window → eligible to create the **production** release (reuse the same AAB; no rebuild). First prod submission → manual review (finance app, hours–days).

## 5. iOS (App Store) — parallel track, no 14-day rule
- TestFlight is optional; you can submit straight to App Store review. Same screenshots (use an iPhone), `docs/app-store/LISTING_ES.md`, financial-app disclosure in the ASC form, privacy nutrition labels from `docs/app-store/PRIVACY_NUTRITION_LABELS.md` (now includes Location, reconciled 2026-05-30).
- `eas.json` `submit.production.ios` is already configured (appleId / ascAppId / appleTeamId).
