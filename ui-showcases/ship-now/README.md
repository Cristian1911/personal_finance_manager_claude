# Ship-Now UI Showcases

This folder is an isolated UX sandbox. It does not import from or modify the live app.

## What I observed

- The current webapp is broad but not immature. The production build passes when network access is available for Google Fonts.
- The strongest existing flows are already real: onboarding, dashboard starter mode, import wizard, transactions, and quick capture.
- The main ship-now risk is not missing capability. It is information architecture sprawl and a weak first operating model.

## Evidence behind that read

- Desktop navigation currently exposes 10 primary destinations, plus a separate bottom section. That is too much top-level choice for a first-use finance product.
- The navigation also mixes language and concept levels: `Dashboard`, `Analytics`, `Gestionar`, `Destinatarios`, `Presupuesto`.
- Onboarding still includes a "Tu app" tab-preview step before the user reaches their first real money task.
- The dashboard already has the right building blocks for a stronger product story: starter mode, hero state, health meters, upcoming obligations, recent activity.
- The import wizard and quick capture bar are the best activation engines in the codebase today.

## Candidate paths

### 1. Estado y siguiente paso

Recommended.

Make the app feel like a daily command center:

- answer "Am I on track?" immediately
- show the next 2-3 actions
- keep deeper setup screens behind `Mas`
- let import and quick capture power activation, not define the whole product

Best for:

- broadest set of users
- fastest path to "this already feels usable"
- preserving the existing dashboard investment

Tradeoff:

- requires discipline to hide advanced areas from primary navigation

### 2. Operador de movimientos

Make the app feel like an import and ledger workspace:

- import first
- quick capture second
- transaction feed as the main truth source
- dashboard becomes secondary

Best for:

- users already motivated to keep records
- teams that want to maximize trust through transaction review first

Tradeoff:

- weaker emotional hook
- the app risks feeling like bookkeeping software instead of a personal finance guide

### 3. Planificador primero

Make the app feel like a planning studio:

- budgets
- debt payoff
- recurring obligations
- goals and scenario framing

Best for:

- disciplined planners with clean data and clear goals

Tradeoff:

- weakest first-run path
- too abstract before import or transaction history exists

## Recommendation

Choose **Estado y siguiente paso**.

Why:

1. It matches the stated product goal directly: "Am I on track?"
2. It uses the best current screens instead of requiring a product rewrite.
3. It creates one clear daily loop:
   open app -> read status -> do next action -> leave.

## Product rules that should not be compromised

- `Disponible para gastar` must be transaction-reactive.
- A completed expense or payment should reduce `Disponible`.
- A pending item that already reduced `Disponible` should not reduce it again once marked completed.
- `Actualizar saldo` must be an overwrite/reconcile action, not a redirect to import.
- That overwrite should create a temporary adjustment transaction that can be filled or replaced when the monthly import arrives.
- Home should expose that overwrite flow directly for the main cash or savings account and for credit cards.

## Ship-now product decision

If you want the app to feel usable now, the decision is:

**Stop exposing the internal system map as the product. Start exposing a guided operating model.**

That means:

- primary nav becomes `Inicio`, `Movimientos`, `Plan`, `Mas`
- `Inicio` owns status, action queue, risk, and momentum
- `Movimientos` owns import, quick capture, search, and review
- `Plan` groups budgets, debt, and recurring commitments around a single "what happens next" lens
- `Mas` holds accounts, categories, destinatarios, settings, analytics

## Suggested sequence if you later implement it

1. Collapse top-level navigation before redesigning deeper pages.
2. Remove the onboarding tab-preview step and replace it with first-action activation.
3. Turn the dashboard into a status-plus-queue screen, not a gallery of modules.
4. Keep advanced nouns like `Destinatarios` out of first-run navigation.
5. Standardize Spanish-first labels before doing visual polish passes.

## Files

- `index.html` - overview and decision summary
- `01-estado-y-siguiente-paso.html` - recommended path
- `02-operador-de-movimientos.html` - ledger-first option
- `03-planificador-primero.html` - planning-first option
- `styles.css` - shared static showcase styles
