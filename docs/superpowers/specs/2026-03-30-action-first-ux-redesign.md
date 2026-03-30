# Action-First UX Redesign

**Date:** 2026-03-30
**Branch:** `codex/action-first-ux`
**Preserves:** Current verbose design on `codex/redesign-management-surfaces` (PR #62)

## Problem

The current management surfaces look great — rich card layouts, brass/olive/sage palette, structured sections — but are too verbose. Every page opens with a PageHero paragraph, 4 StatCards with descriptions, helper/guidance cards ("Vista actual", "Atención operativa", "Siguiente paso"), and eyebrow labels. The user has to scroll past explanation to reach the actual content. The app explains instead of enabling.

## Design Principles

1. **Metrics are the story** — numbers speak for themselves, no paragraphs needed
2. **Attention before explanation** — surface what needs action, not what the page does
3. **Content immediately** — the thing the user came for should be visible without scrolling
4. **Consistent structure** — every management page follows the same anatomy
5. **Visual richness preserved** — same card language, colors, and premium feel

## Page Anatomy (all management pages)

Every management page follows this structure top-to-bottom:

### 1. Header Row

- **Left:** Bold page title (22px, font-weight 700) + subtitle with key context (period, count)
- **Right:** Action buttons (month navigator, primary CTA)
- No eyebrow labels, no hero paragraphs, no multi-sentence descriptions

### 2. Two-Card Zone

Always two cards side by side. Both always present for layout consistency.

**Left card — "Resumen del período"**
- Section label (uppercase, 10px, olive color)
- 3 compact metric boxes in a row
- Each metric: uppercase label + large number (22px) + one short context line
- Context lines are data, not explanations: "4 fuentes", "21% del ingreso", "en esta vista"

**Right card — "Necesita atención"**
- Section label (uppercase, 10px, brass color)
- Attention items as compact rows: number + label + action link ("Resolver →")
- When nothing needs attention: positive "Al día" state with checkmark (olive border instead of brass)
- Items are computed server-side from real data

### 3. Filter/Toolbar Bar

- Thin separator line
- Filter chips in a row (search, account, type, tags, date range)
- Same as current, no changes

### 4. Content Zone (list-based pages)

- **Left (~60-65%):** List or table, constrained width for readability
- **Right (~35-40%):** Detail panel — click a row to view/edit inline
- When nothing is selected, panel shows empty state or contextual summary
- Replaces full-width stretching and reduces need for full-page dialogs
- Pattern available for all list pages, evaluated per-page during implementation

## Per-Page Specification

### Transactions (`/transactions`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Movimientos, Ingresos, Gastos | Sin categoría count, posibles duplicados | List + detail panel |

- Quick capture bar stays below filters
- Month navigator in header row

### Accounts (`/accounts`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Patrimonio neto, Cuentas activas, Presión de deuda | Saldos desactualizados | Account cards grouped by type |

- No detail panel — account cards are self-contained
- Grouped sections (Liquidez, Crédito) keep their titles but lose descriptions

### Categories/Presupuesto (`/categories`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Días restantes, Con límite, Sin categoría | Categorías sobre límite | Budget grid + detail panel |

- Tab interface stays (Presupuesto, Tendencias, Gestionar)
- MonthEndInsight card removed — its data moves to attention card

### Destinatarios (`/destinatarios`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Total, Con reglas, Sugerencias | Sugerencias pendientes | List + detail panel |

- Tab interface stays (Mis destinatarios, Sugerencias)
- All explanatory cards removed

### Recurrentes (`/recurrentes`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Plantillas activas, Salidas/mes, Entradas/mes | Pagos vencidos, próximos 7 días | Timeline + detail panel |

- Timeline and template list lose their wrapper cards with descriptions
- Content is the timeline and list directly

### Deudas (`/deudas`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Deuda total, Utilización, Interés mensual | Pagos mínimos próximos | Debt cards grouped by type |

- No detail panel — debt cards are self-contained
- DebtHeroCard, UtilizationGauge, InterestCostCard stay but lose wrapper descriptions
- Streaming architecture preserved (header instant, content streams)

### Settings (`/settings`)

| Metrics (left card) | Attention (right card) | Content zone |
|---|---|---|
| Perfil activo, Correo, Miembro desde | — (no attention signals) | Section cards |

- Right card shows "Al día" or can be omitted (only page without attention signals)
- Section cards (Perfil, Integrations, Email, etc.) keep their structure but lose subtitle descriptions

## Attention Hub (replaces Gestionar)

### Desktop

- Route stays at `/gestionar`, page becomes "Bandeja"
- Full-width attention hub — no navigation cards (sidebar covers navigation)
- Groups items by priority:
  - **Requiere acción** — uncategorized transactions, overdue recurring, unmatched rules
  - **Sugerencias** — new destinatario rules, budget adjustments
- Each item: count badge + description + direct action link
- When everything is clear: positive "Al día" full-page state

### Mobile

- "Más" bottom tab becomes "Bandeja"
- Top section: Attention Hub (same as desktop)
- Below: Compact link grid to pages not in primary mobile tabs
  - Categorizar, Destinatarios, Importar, Cuentas, Presupuesto, Deudas, Recurrentes, Ajustes
  - Icon + label only, no descriptions, no cards
  - Simple 2-column or 3-column grid

## Sidebar Evolution

- Rename "Más" to "Bandeja" in `PRIMARY_NAV`
- Extend badge system beyond "uncategorized":
  - Bandeja shows total attention count (brass accent)
  - Individual nav items show their page's pending count (subtle muted badges)
- Sidebar header subtitle removed ("Estado y siguiente paso" → just branding)

## Components Removed

- `PageHero` descriptions (all pages) — title and subtitle stay, paragraphs die
- `StatCard` descriptions — value + label only, plus one short context line
- Helper/guidance cards — "Vista actual", "Atención operativa", "Siguiente paso" wrapper cards
- Eyebrow labels on content sections
- Gestionar action cards with descriptions
- `MonthEndInsight` card (data moves to attention system)
- Contextual multi-sentence explanation cards

## Components Preserved

- Card-based visual language (borders, subtle backgrounds, border-radius)
- Brass/olive/sage color system with semantic meaning
- Mobile/desktop responsive split (`lg:hidden` / `hidden lg:block`)
- Filter bars and quick capture
- Dialog-based forms for creating new items
- Streaming architecture on deudas page
- Dashboard page (not part of this redesign)

## Components New

- **AttentionCard** — right-side card with pending items and action links
- **AttentionHub** — full page aggregating all pending items (replaces Gestionar)
- **DetailPanel** — right-side panel for list pages, shows selected item detail/edit
- **CompactMetricCard** — metric box with label + value + short context (replaces StatCard)
- **MobileLinkGrid** — compact icon+label grid for mobile Bandeja navigation
- **SidebarBadge** — per-nav-item attention count badge

## Attention Signal Sources

Server-side computed, per page:

| Page | Signals |
|---|---|
| Transactions | Uncategorized count, possible duplicates |
| Accounts | Stale balances (no import in >30 days) |
| Categories | Over-budget categories this month |
| Destinatarios | Pending rule suggestions |
| Recurrentes | Overdue payments, upcoming 7-day payments |
| Deudas | Minimum payments due soon |

## Not Changing

- Color system (brass, olive, sage, ink)
- Dark theme
- Dashboard page
- Import wizard
- Authentication flow
- PDF parser integration
- Mobile bottom tab count (4 tabs)
- Supabase/RLS patterns
