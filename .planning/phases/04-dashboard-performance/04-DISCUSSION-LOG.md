# Phase 4: Dashboard Performance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 04-dashboard-performance
**Areas discussed:** Streaming tier split, Skeleton fidelity, Recharts upgrade, Animation replacement

---

## Streaming Tier Split

### Q1: What should render instantly (tier 1)?

| Option | Description | Selected |
|--------|-------------|----------|
| Hero (balance + available) | getDashboardHeroData — the "Am I on track?" headline number | ✓ |
| Health meters | getHealthMeters — health levels (spending ratio, savings, debt) | ✓ |
| Cash flow strip | getMonthlyCashflow — income → fixed → variable → remaining strip | |
| Burn rate | getBurnRate — days of runway remaining | |

**User's choice:** Hero + Health meters
**Notes:** These are the two "Am I on track?" signals. Everything else is tier 2.

### Q2: Mobile streaming

| Option | Description | Selected |
|--------|-------------|----------|
| Stream both (Recommended) | Apply same tier split to MobileDashboard, refactor to Suspense sub-components | ✓ |
| Desktop only for now | Keep MobileDashboard prop-passing as-is | |

**User's choice:** Stream both
**Notes:** None

### Q3: Tier 2 granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Per section (Recommended) | One Suspense boundary per dashboard section | ✓ |
| Per widget | Each widget has its own Suspense | |

**User's choice:** Per section
**Notes:** Fewer loading states, simpler layout shifts.

---

## Skeleton Fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| Content-shaped (Recommended) | Skeletons mirror real layout: card headers, chart-height boxes, list rows | ✓ |
| Simple themed blocks | Rounded pulse boxes sized to match content height | |
| You decide | Claude picks fidelity per section | |

**User's choice:** Content-shaped
**Notes:** Prevents layout shift and looks polished.

---

## Recharts v2 → v3 Upgrade

| Option | Description | Selected |
|--------|-------------|----------|
| Upgrade + lazy-load together (Recommended) | Single pass across all 17 files | ✓ |
| Lazy-load v2 first, upgrade later | Safer, defer v3 to future phase | |
| You decide | Claude evaluates v3 changelog | |

**User's choice:** Upgrade + lazy-load together
**Notes:** Since all 17 files are being touched for lazy-loading, avoids double migration.

---

## Animation Replacement

| Option | Description | Selected |
|--------|-------------|----------|
| CSS transitions (Recommended) | Tailwind classes + tw-animate-css, zero JS cost | ✓ |
| No animation | Remove transitions entirely | |
| You decide | Claude picks lightest replacement | |

**User's choice:** CSS transitions
**Notes:** tw-animate-css already installed.

## Claude's Discretion

- Exact skeleton layout per dashboard section
- Whether to create shared Skeleton component or keep inline
- recharts v3 migration specifics based on changelog
- Mobile dashboard data flow restructuring

## Deferred Ideas

None — discussion stayed within phase scope.
