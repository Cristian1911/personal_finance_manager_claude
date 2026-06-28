# Zeta — Capability Discovery & Guided-Experience Brief

> **Mission:** reduce the #1 friction — *users don't understand what the app can do.*
> **Scope:** webapp (design source of truth; mobile mirrors later).
> **Simplification stance:** §3 proposals are **suggestions only** — nothing changes without sign-off. Bold (behavior-changing) options listed with risk; conservative guidance-only fallbacks noted.
> **Source:** 8-agent capability/discoverability/friction map + 2-agent synthesis (`wf_84fcc03e-ba6`, ~833k tokens).

---

## 1. Capability Map

Grouped by user job. Discoverability deduplicated across the corpus; where desktop and mobile diverge, the worse rating wins.

### Capturar (getting data in)
| Capability | What it does | Discoverabilidad |
|---|---|---|
| Manual transaction form (`/transactions/new`, `transaction-form-dialog.tsx`) | Full gasto/ingreso/transferencia form; canonical add path. | **Obvio** (FAB → Nueva transacción) |
| PDF statement import (`/import`, `import-wizard.tsx`) | Upload bank PDF → auto-detect → match account → reconcile. | **Encontrable** (sidebar Herramientas) |
| Screenshot/OCR import (`step-upload.tsx`, `/import?mode=screenshot`) | 1–10 bank-app screenshots, OCR + merge into wizard. | **Encontrable** (FAB mobile; dropzone hint desktop) |
| Captura rápida (text) (`quick-capture-bar.tsx`) | NL one-liner parsed + auto-categorized. | **Encontrable** (mid-page card / 2nd-tier FAB) |
| **Captura por voz** (`voice-capture-sheet.tsx`) | Mic → conversational capture, asks for missing fields. | **Oculto** (mobile-only, one layer into FAB) |
| **Telegram capture** (`integrations-card.tsx`) | Text a bot → creates tx without opening app. | **Oculto** (buried in `/settings/integraciones`) |
| **AI/MCP capture tokens** (`capture-tokens.ts`, `/api/mcp/*`) | Connect Claude/ChatGPT to register + query finances. | **Oculto** (Settings only; manual token) |
| **Email-forwarded import** (`email-ingest-card.tsx`) | Personal ingest address; forwarded bank emails auto-create tx. | **Oculto** (deep in Settings; `/import` never mentions it) |
| PDF password vault (`pdf-passwords.ts`) | Saves bank-PDF passwords, auto-suggests next time. | **Encontrable** (inline only on protected PDF) |
| Reconciliation step (`reconciliation-step.tsx`) | Flags duplicates; AUTO_MERGE or per-pair MERGE/KEEP_BOTH. | **Encontrable** (only when matches exist) |

### Entender (insight / "am I on track?")
| Capability | What it does | Discoverabilidad |
|---|---|---|
| Dashboard hero — runway/ritmo (`hybrid-hero.tsx`) | "Disponible por día" + ritmo, tap-to-expand. | **Obvio** (first card) |
| Tendencias hub (`/tendencias`) | Verdict callout + stat tiles + period chips. | **Encontrable** (mobile 2 taps under Más) |
| **Tendencias lenses** (`lens-*.tsx`) | 3 reframes; "¿Cambios?" holds anomalies + forecast. | ¿Cambios? **Oculto** in practice |
| **Category drill-down + search** (`category-trend-list.tsx`) | Tap category → subcats → real transactions. | **Oculto** (lone chevron only) |
| Health score / meters (`health-score-section.tsx`) | Score + savings/emergency/debt meters. | **Encontrable** (below fold; no explanation) |
| Activity heatmap (`actividad-heatmap.tsx`) | Calendar heatmap of spend intensity. | **Encontrable** (no legend) |
| Attention signals (`attention-card.tsx`) | Aggregates to-dos; drives Bandeja badge. | **Obvio** (but rendered 3 different ways) |
| **Usage analytics** (`/settings/analytics`) | User's product_events funnel + D7 cohort. | **Oculto** (operator-grade content for end users) |

### Planear (budgets / debt / recurring)
| Capability | What it does | Discoverabilidad |
|---|---|---|
| Plan hub (`/plan`) | Unifies budget/period/recurring/debt/wishlist; "Margen actual". | **Obvio** (Plan tab) |
| Category budgets + 50/30/20 + modes (`budget-wizard.tsx`) | Per-category limits; per_category vs zero_based. | **Encontrable** ("Modo" = jargon) |
| **Periodo — envelope timeline** (`cashflow-planner/*`) | Zero-based "assign each peso to an income". | **Oculto** (peer tab, no explainer) |
| **Budget scenario sandbox** (`scenario-sandbox.tsx`) | What-if on limits/deseos vs income & cushion. | **Encontrable** (purpose unexplained) |
| Debt overview (`/deudas`) | Total debt, interest, utilization, debt-free countdown. | **Encontrable** (demoted to Herramientas) |
| Debt payoff planner (`/deudas/planificador`) | Avalanche vs snowball, compare, save scenarios. | **Encontrable** (brass button) |
| Recurring obligations (`recurring-form.tsx`) | Templates → monthly occurrences; cargo vs abono. | **Encontrable** (lifecycle invisible) |
| **Subscriptions** (`/suscripciones`) | Tracks subs; auto-detects suggestions. | **Oculto** (ORPHAN — no nav entry) |
| **Pendientes** (`/pendientes`) | Pending-items surface overlapping `/gestionar`. | **Oculto** (ORPHAN — deep-link only) |

### Decidir (purchase decisions)
| Capability | What it does | Discoverabilidad |
|---|---|---|
| Deseos / Wishlist scoring (`plan-tab-deseos.tsx`) | Each enriched item → verdict (Puedes comprarlo / Mejor esperar). | **Encontrable** (`/deseos`→`/plan?tab=deseos` mismatch) |
| Deseos nudges + insights | Contextual banners + buying-pattern card. | **Encontrable** (only for populated Deseos) |
| **¿Comprarlo? / Can I afford it** (`/puedo-pagar`) | Verdict + "Por qué" + save-to-wishlist; flagship "wow". | **Oculto** (NOT in nav; mobile tile **mis-wired to `/deseos`**) |

### Configurar (accounts / settings / people)
| Capability | What it does | Discoverabilidad |
|---|---|---|
| Accounts list + net worth (`/accounts`) | Grouped accounts, patrimonio header. | **Encontrable** (multi-currency net-worth trap) |
| Account create/edit (`specialized-account-form.tsx`) | Type-specific fields (CC cutoff/rate/payment day). | **Encontrable** (downstream effects unexplained) |
| Profile / currency / salary (`/settings/perfil`) | Currency drives app-wide math. | **Oculto** (buried) |
| **Personal debts / IOUs** (`/deudas-personales`) | Money lent/borrowed per person. | **Oculto** (confused with bank /deudas) |
| **Categorías management** (`/categories`) | Create/edit categories. | **Oculto** (ORPHAN — nav points elsewhere) |
| **Etiquetas / Ritmo YNAB tags** (`/etiquetas`) | Tag groups; "Ritmo YNAB" feeds pace cards. | **Oculto** (duplicate routes; never explained) |
| **Destinatarios automation** (`/destinatarios`) | Merchant rules auto-categorize future imports. | List **Encontrable**; payoff **Oculto** |

**The "Oculto" core (discovery-friction epicenter):** Captura por voz · Telegram · MCP · Email-ingest · Periodo · **¿Comprarlo?** · Subscriptions · Tendencias drill-down + ¿Cambios? · Personal debts · Destinatario rules · Ritmo YNAB. These are simultaneously the app's most *differentiating* capabilities **and** the ones with the weakest entry points.

---

## 2. Onboarding → App Cohesion

**What onboarding sets up** (`app/onboarding/page.tsx`, `actions/onboarding.ts`): welcome → name + purpose (Salir de deudas / Entender gastos / Ahorrar / Mejorar hábitos) → income + expenses + one manual account → celebration with a single purpose-routed CTA. Side effects: inserts ONE account, writes profile (name, app_purpose, income/expense estimates, currency from timezone, nav_focus, dashboard_config + mobile widget layout).

**Concrete narrative breaks:**

1. **Broken day-1 budget promise.** Step 3 shows "Disponible para presupuesto" / "Nos ayuda a sugerirte límites desde el día 1," but `finishOnboarding()` **never creates a budget**. Promise broken at the moment the user lands.
2. **Estimates instead of the import "moment of truth."** Wireframe Flow 01 makes PDF import the centerpiece ("drop a PDF, land on a populated home"). Shipped onboarding builds the first dashboard from *guesses*, so "¿voy bien?" is answered with fabricated numbers. **Largest divergence in the app.**
3. **Silent purpose cascade.** Picking a goal rewrites nav (`nav_focus`) + `dashboard_config` with one line of fine print. A "Salir de deudas" user lands with a Deudas tab and **zero debts + no prompt to add one.**
4. **Teaches almost nothing.** Only the conditional Deudas tab + "import later" are mentioned. Import, auto-categorization, recurring, debt planner, Tendencias, ¿Comprarlo?, voice/Telegram/email all go unmentioned.
5. **Inconsistent next-action.** Celebration CTA routes one way; the dashboard starter state shows a *different* set of steps. The "what next" thread forks immediately.
6. **Teaching window closes too early.** Starter guidance vanishes the instant one transaction exists — before the user has actually explored. Zero-account users never see it.
7. **Goal continuity dropped.** Nothing carries the goal forward on home; the user is never told their income estimate drives the Plan/debt heroes.
8. **Mislinked discovery + dead inputs.** `inicio-discovery-rail.tsx` "Recomendador de compras" describes ¿Comprarlo? but **links to `/deseos`**. Onboarding collects fields it discards; `?reset=1` is read by nothing.

**Net:** onboarding sets up *data* without building a *mental model*. The wireframe's explicit teaching layer ("tap anything to learn") was never built.

---

## 3. Simplification Candidates — SUGGESTIONS ONLY (ranked by friction-removed / effort)

> Bias: delete or auto-default before adding. Each item = bold default + conservative fallback + risk. **None applied without sign-off.**

1. **Dead day-1 budget calibration.** Step 3 collects income+expenses, previews "Disponible para presupuesto," but no budget is created. **Bold:** drop the promise + expense field (keep income; it powers heroes). **Conservative:** actually generate a starter presupuesto from the estimates. **Risk:** low.
2. **Mislinked discovery tile** → point "Recomendador de compras" to `/puedo-pagar` (currently `/deseos`). **Risk:** none (bugfix).
3. **Route orphans/duplicates** — `/suscripciones` (no nav), `/pendientes` (overlaps `/gestionar`), `/categories` (nav points elsewhere), `/etiquetas` + `/settings/etiquetas` (dupe). **Bold:** redirect/merge + add one nav tile. **Conservative:** add nav entries, leave routes. **Risk:** low (only hand-typed deep links).
4. **Lower step-3 finish gate** — balance defaults to 0, only income required. **Risk:** low.
5. **Honest import step count + auto-skip clean steps** when match confidence high and no destinatario decisions (CLAUDE.md says 6; reality is 3–4). **Conservative:** just fix the count display. **Risk:** medium (auto-skip must be conservative).
6. **Two parallel budgeting paradigms** (Presupuesto vs Periodo) with no "which do I use?" **Bold:** gate Periodo behind explicit opt-in. **Conservative:** one-line decision helper atop each. **Risk:** medium.
7. **Rename budget "Modo" jargon** (`per_category`/`zero_based` → plain language). **Risk:** none (copy).
8. **State PDF-vs-image dropzone rules upfront** instead of correcting via toast. **Risk:** none.
9. **Stop collecting discarded onboarding fields** + read `?reset=1`. **Risk:** none.
10. **Gate `/settings/analytics`** behind a flag (operator-grade). **Risk:** low.
11. **Move PDF-password mgmt into import flow**, delete standalone settings page. **Risk:** low.
12. **Unify the bespoke banner zoo** (DemoBanner, GuestBanner, DebtFreeBanner, DeseosNudgeBanner, ExchangeRateNudge) onto the **already-built-but-unused** `components/ui/alert.tsx`. **Risk:** medium (do incrementally).

---

## 4. Guided-Experience Strategy (how & where)

**No product tour.** 39 routes, 3 what-if engines, 2 budgeting paradigms, 7 capture methods — a modal step-through would be a wall users click past. Brand brief rule: **"the tutorial is the screen itself."** Five tightly-scoped, in-place, dismissible mechanisms that reuse seeds already in the code.

### 4.1 Contextual empty-state nudges — the workhorse (highest coverage, lowest build)
~40 surfaces reinvent empty states, most *describe the void* instead of teaching value + next action. Best existing template: `personas-root.tsx` `EmptyState`. **No shared `EmptyState` in `components/ui/`** → the one new primitive worth building. Every empty state answers **"¿qué me da esto?"** + **"¿qué hago primero?"** Rewrites:

- **Periodo** → **Planifica de dónde sale cada peso** · Asigna cada gasto a un ingreso concreto para saber cuánto te queda realmente. → *Crear mi primer periodo*
- **Recurrentes** → **Registra lo que se repite cada mes** · Tus pagos fijos alimentan tu margen del Plan y se sincronizan con tu periodo. → *Agregar recurrente*
- **Deudas** → **Aún no tienes deudas registradas** · Marca una cuenta como tarjeta o préstamo y se activa tu plan de pago. → *Marcar cuenta como deuda*
- **Deseos (un-enriched)** → Completa urgencia y cuenta y Zeta te dirá si conviene comprarlo ahora.
- **Zero-tx (transactions/dashboard)** → **Aún no hay movimientos** · Importa un extracto y verás tu dinero real en segundos, o registra un gasto a mano. → *Importar* · *Registrar*
- **Destinatarios** → **Crea una regla una vez, Zeta categoriza para siempre** · Asigna categoría a un comercio y sus compras futuras se clasifican solas.

### 4.2 Inline "?" info-popovers on heavy concepts (targeted, not everywhere)
Only **one** real tap-for-explanation pattern exists today: `debt/stat-tile.tsx` `popoverContent`. Generalize into one `InfoHint`, attach only to load-bearing jargon + numbers users must trust:
- **Hero "disponible por día"** → Tu gasto disponible de hoy = (saldo líquido − gastos fijos − ya gastado) ÷ días restantes. (no income → nudge: *Configura tu ingreso para que este número sea preciso →*)
- **Health meters** → per meter: what it measures + target + improve link.
- **Budget "Modo"** → **Por categoría:** límite por categoría. **Base cero:** repartes cada peso hasta que no sobre. Empieza con *Por categoría*.
- **50/30/20** → Referencia: 50% necesidades, 30% gustos, 20% ahorro/deuda.
- **Account currency / CC fields** → Las cuentas en otra moneda no se suman a tu patrimonio en COP. / Día de corte y tasa alimentan el planificador.

### 4.3 First-session "Primeros pasos" checklist — the onboarding↔home bridge (high ROI)
The missing continuity layer. Replace the vanishing starter state with a **persistent, dismissible checklist** on the dashboard that survives past the first transaction and teaches *breadth*, seeded by `profile.app_purpose`. Reuse `inicio-discovery-rail.tsx` + `DashboardAlerts` dismissal/snooze. Items check off as the user does them.

- **manage_debt** → Importar extracto · Marcar cuenta como deuda · Probar el Planificador · Registrar deuda personal
- **save_money** → Importar extracto · Crear presupuesto · Probar "¿Puedo pagarlo?" · Agregar un deseo
- **track_spending / improve_habits** → Registrar primer gasto · Importar extracto · Categorizar movimientos · Ver Tendencias

Header: **"Primeros pasos · {N} de {total}"** · *Activa Zeta en unos minutos. Puedes cerrarlo cuando quieras.*

### 4.4 Coach-marks — only THREE, only on truly invisible interactions
1. **Mobile FAB first-open** → **Más que registrar a mano:** dicta por voz, escribe en una línea o sube un pantallazo de tu banco.
2. **Tendencias category list (first visit)** → Toca cualquier categoría para ver los movimientos detrás.
3. **Reconciliation step (first time, inline in header)** → Encontramos movimientos que parecen el mismo. **Combinar** los une; **Mantener ambos** los deja separados. Al combinar se conserva la versión del banco.

**Do NOT build:** multi-step modal walkthrough, global tour engine, coach-marks everywhere.

### 4.5 Progressive disclosure (arrangement principle, not a component)
- Import wizard: honest "Paso N de N" + auto-skip steps with no decisions.
- Destinatario pattern builder: lead with "Sugerencias"; raw editing behind *Avanzado*.
- Email ingest: address + *activar* first; rest behind *Opciones avanzadas*.

### 4.6 Primitives: reuse vs build
**Reuse:** `DashboardAlerts` dismiss/snooze engine · `InicioDiscoveryRail` · `debt/stat-tile.tsx` popover · `personas-root.tsx` EmptyState · **`components/ui/alert.tsx` (built but UNUSED)** · `ui/tooltip.tsx`.
**Build exactly TWO:** `components/ui/empty-state.tsx` (replaces ~40 ad-hoc empties) · `components/ui/info-hint.tsx` (`?`→Popover/Tooltip).
**Do NOT build:** tour engine, help-center route, coach-mark framework beyond the 3, new banner component.

---

## 5. Placement Matrix

| Screen / Component | Mechanism | Trigger | Reuses existing? |
|---|---|---|---|
| `cashflow-planner/*` (Periodo) | EmptyState | No active period | New `ui/empty-state` |
| `recurring/recurring-list.tsx` | EmptyState | No templates | New `ui/empty-state` |
| `debt/*` overview | EmptyState | No debt accounts | New `ui/empty-state` |
| `deseos/deseos-list.tsx` | Inline hint | Un-enriched item | New `ui/empty-state` inline |
| `destinatarios/destinatario-list.tsx` | EmptyState | Few/no rules | New `ui/empty-state` |
| `/transactions` + `/dashboard` | EmptyState (dual CTA) | Zero tx | New `ui/empty-state` |
| `dashboard/hybrid-hero.tsx` | InfoHint (+ income nudge) | Tap "?" / no income | New `ui/info-hint` |
| `health-score-section.tsx` | InfoHint per meter | Tap "?" | New `ui/info-hint` |
| `budget/budget-wizard.tsx` (Modo) | InfoHint | Tap "?" | New `ui/info-hint` |
| `budget/allocation-bars-5030.tsx` | InfoHint | Tap "?" | New `ui/info-hint` |
| `accounts/account-form-dialog.tsx` | InfoHint (currency + CC) | Tap "?" | New `ui/info-hint` |
| `dashboard` (`inicio-discovery-rail.tsx`) | "Primeros pasos" checklist | Post-onboarding | Reuse rail + DashboardAlerts |
| `mobile/fab-menu.tsx` | Coach-mark | First FAB open | New (1 of 3) + localStorage |
| `tendencias/category-trend-list.tsx` | Coach-mark line | First visit | New (2 of 3) |
| `import/reconciliation-step.tsx` | Inline explainer | First render | Adopt `ui/alert.tsx` |
| `import/import-wizard.tsx` | Progressive disclosure | High confidence, no decisions | Refactor |
| `inicio-discovery-rail.tsx` mislink | Bug fix | n/a | Fix → `/puedo-pagar` |
| `import/step-results.tsx` | Inline next-action | Import complete | Adopt `ui/alert.tsx` |

---

## 6. Phased Implementation Plan

### Phase 1 — Empty states + "Primeros pasos" bridge (highest ROI, lowest build)
- Build `ui/empty-state.tsx` (pattern from `personas-root.tsx`).
- Replace ~10 highest-traffic ad-hoc empties (Periodo, Recurrentes, Deudas, Deseos, Destinatarios, zero-tx).
- Build "Primeros pasos" checklist by expanding `inicio-discovery-rail.tsx`, seeded by `app_purpose`, persisted via `DashboardAlerts`. Survives past first transaction.
- Fix discovery-rail mislink → `/puedo-pagar`; add Deseos tile.
- Add nav for orphan `/suscripciones`; surface `/puedo-pagar` in nav.
- **Mockup:** only the **"Primeros pasos" checklist card** (net-new layout). Rest = existing patterns + copy.

### Phase 2 — `InfoHint` on load-bearing numbers + reconciliation explainer
- Build `ui/info-hint.tsx` (generalize `stat-tile.tsx` popover).
- Attach to hero, health meters, budget Modo + 50/30/20, account currency/CC, net-worth.
- Adopt unused `ui/alert.tsx` for reconciliation explainer + import-success "esto cambió" callout.
- Honest "Paso N de N".
- **Mockup:** none — validate `InfoHint` in Storybook.

### Phase 3 — 3 coach-marks + progressive disclosure + long-tail empties
- 3 one-time coach-marks (FAB, Tendencias drill-down; reconciliation already inline). Single shared localStorage `seen` flag — no tour engine.
- Progressive disclosure: import auto-skip, destinatario "Avanzado", email "Opciones avanzadas".
- Convert remaining ~30 long-tail empties to shared component.
- Onboarding step 2: surface purpose-cascade preview; read `?reset=1`.
- **Mockup:** the **FAB coach-mark** (overlays bottom drawer — visual check vs z-index discipline).
