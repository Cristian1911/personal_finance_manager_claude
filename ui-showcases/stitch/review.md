# Review — Current Showcase and Product Direction

## Executive read

The app is not weak because it lacks capability. It is weak because it keeps showing the internal system map instead of one clear operating model.

The current showcase has the same problem:

- it inventories everything
- it gives every page the same visual priority
- it does not tell a redesign tool what matters most

The strongest direction is still `Estado y siguiente paso`: open the app, understand your status fast, do the next meaningful action, leave.

## What works

- The product already has real depth. This does not read like a fake prototype.
- Dashboard, transactions, import, debt, and recurring flows already contain the building blocks of a strong product.
- The dark visual system is coherent enough to refine instead of replace.
- Mobile and desktop broadly share the same mental model.

## What is not working

### 1. Too many first-class nouns

The primary experience still exposes too many separate domains:

- dashboard
- transactions
- categorization
- payees
- import
- accounts
- debt
- recurring
- budget
- manage
- analytics

That breadth is real, but it should not be the first thing the product teaches.

### 2. No dominant story on the main surfaces

The dashboard has many useful blocks, but they compete as peers. It feels like a gallery of modules rather than a point of view.

The result is:

- weak focal hierarchy
- no single daily question answered immediately
- too much scanning before the user knows what to do next

### 3. Plan features are split by storage model, not by user intent

Debt, budgets, recurring payments, and obligations all belong to the same mental space: “what pressure is coming and what should I do next?”

Right now they feel separated by implementation nouns.

### 4. Mobile inherits the same sprawl, but stacked

On mobile, the issue gets worse because every module becomes a vertical block. The user scrolls through many competing summaries before getting a clear action queue.

### 5. The showcase is not a good redesign prompt

The current showcase pages are clean enough for archival viewing, but weak for design refinement:

- they are static screenshot dumps
- they do not flag critical screens versus secondary screens
- they include extremely tall captures like `categorizar` that are poor inputs for quick iteration
- the mobile showcase layout itself is not truly responsive

## Showcase-specific issues

### Desktop showcase

- [`desktop-showcase.html`](/Users/cristian/Documents/developing/current-projects/zeta/ui-showcases/desktop-showcase.html#L65) uses a fixed three-column table of contents with no adaptation for smaller browser widths.
- [`desktop-showcase.html`](/Users/cristian/Documents/developing/current-projects/zeta/ui-showcases/desktop-showcase.html#L116) renders every page sequentially as a full-width dump, so there is no curation or emphasis.

### Mobile showcase

- [`mobile-showcase.html`](/Users/cristian/Documents/developing/current-projects/zeta/ui-showcases/mobile-showcase.html#L36) forces `minmax(420px, 1fr)` even though the underlying screen width is `390px`, which makes the showcase itself awkward on smaller windows.
- [`mobile-showcase.html`](/Users/cristian/Documents/developing/current-projects/zeta/ui-showcases/mobile-showcase.html#L130) still presents the entire app as a flat archive instead of a guided review.

## Recommended product changes

### 1. Compress the top-level product story

Use four top-level places:

- `Inicio`
- `Movimientos`
- `Plan`
- `Más`

Move advanced nouns like categories, payees, analytics, and settings behind `Más`.

### 2. Make `Inicio` answer one question first

The home screen should answer:

`¿Voy bien esta semana y qué debo hacer ahora?`

That means the top of the screen should prioritize:

- status / “available to spend”
- one confidence or health signal
- the next two or three actions
- near-term pressure like payments due soon

Anything else is secondary.

### 3. Rebuild `Movimientos` around flow, not tools

Transactions, import, and quick capture should feel like one operating loop:

- import or capture
- review
- fix classification
- move on

The screen should feel like a working inbox, not a utility shelf.

### 4. Merge planning surfaces conceptually

Debt, budgets, and recurring commitments should all contribute to a single plan lens:

- what is fixed
- what is flexible
- what is risky
- what decision improves the month

Even if routes stay separate internally, the visual language should make them feel related.

### 5. Standardize visual hierarchy harder

Today too many cards use similar weight. Tighten the system:

- one hero zone per page
- one secondary insight band
- one work area
- keep tertiary admin controls out of the primary reading path

### 6. Treat `Gestionar` as a support surface

`Gestionar` is useful, but it should not read like a top-tier product destination. It belongs under `Más` as a utilities and setup space.

## Best screens to keep as redesign anchors

- Dashboard
- Transactions
- Import
- Debt
- Budget
- Manage / More

These screens are enough to define the system without dragging every edge case into the first pass.

## Screens to demote during redesign exploration

- Transaction detail
- Account detail
- Categorize
- Destinatarios
- Analytics
- Auth pages

They still matter, but they should not drive the first redesign loop.
