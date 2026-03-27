# Phase 6: Dashboard Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 06-dashboard-redesign
**Areas discussed:** Health headline & hero, Composite health grade, Information hierarchy, Section narratives

---

## Health Headline & Hero

### Headline placement

| Option | Description | Selected |
|--------|-------------|----------|
| Above the big number | "Vas bien" as the very first thing you read, then "Disponible" below | |
| Replace the big number | Headline becomes primary element, "Disponible" moves to KPI cards | |
| Below the KPI cards | Hero stays as-is, headline appears as summary sentence below | ✓ |

**User's choice:** Below the KPI cards
**Notes:** Numbers first, then narrative interpretation. User prefers data before editorial.

### Headline data source

| Option | Description | Selected |
|--------|-------------|----------|
| Budget spending pace | Based on spent vs budgeted. Under/near/over budget thresholds. | ✓ |
| Composite health score | Synthesizes savings, debt, spending, emergency fund. Richer but complex. | |
| Available-to-spend ratio | % of month left vs % of budget left. | |

**User's choice:** Budget spending pace
**Notes:** Simple and direct — answers "Am I on track?" with one clear metric.

### Debt-free date placement

| Option | Description | Selected |
|--------|-------------|----------|
| 4th KPI card in the row | Add "Libre de deudas" card alongside existing 3 | |
| Inline in the headline | Weave into status sentence when relevant | |
| Separate banner below headline | Dedicated colored banner below status sentence | ✓ |

**User's choice:** Separate banner below headline
**Notes:** Visually distinct from the status headline. Dedicated strip.

### No-debt state

| Option | Description | Selected |
|--------|-------------|----------|
| Just disappear | No banner when debt-free. Hero stays clean. | ✓ |
| Celebrate it | Show positive banner: "Sin deudas — todo tu ingreso es tuyo" | |
| You decide | Claude picks the best approach | |

**User's choice:** Just disappear
**Notes:** Clean layout, no unnecessary elements when state doesn't apply.

---

## Composite Health Grade

### Score location

| Option | Description | Selected |
|--------|-------------|----------|
| Top of health meters card | Composite grade header on existing card | |
| Its own dedicated section | Standalone section between hero and rest | ✓ |
| Sidebar/aside on desktop | Narrow sidebar on desktop, compact strip on mobile | |

**User's choice:** Its own dedicated section
**Notes:** More prominent, positioned as second section after hero.

### Grade format

| Option | Description | Selected |
|--------|-------------|----------|
| Letter grade A-D | Familiar report card style | |
| 0-100 numeric score | Precise, credit-score feel | ✓ |
| Emoji-based levels | Traffic light: green/yellow/orange/red circles | |

**User's choice:** 0-100 numeric score
**Notes:** User prefers precision of numeric score over letter grades.

### Score visualization

| Option | Description | Selected |
|--------|-------------|----------|
| Speedometer gauge | Half-circle with score in center, colored zones | ✓ |
| Progress ring | Apple Watch-style circular ring | |
| Big number only | Minimalist large colored number | |

**User's choice:** Speedometer gauge
**Notes:** Matches prior decision for gamified health visualization.

### Score computation

| Option | Description | Selected |
|--------|-------------|----------|
| Equal weights | Each of 4 meters contributes 25% | ✓ |
| Worst-of with floor | Average floored by worst individual meter | |
| You decide | Claude picks best formula | |

**User's choice:** Equal weights
**Notes:** Simple, transparent. Matches STATE.md research flag recommendation.

---

## Information Hierarchy

### Tier breakdown

| Option | Description | Selected |
|--------|-------------|----------|
| Hero + Health = primary, rest = equal | Two tiers: primary (hero+health) and secondary (all others) | ✓ |
| Three distinct visual tiers | Primary/secondary/tertiary with different sizes | |
| You decide | Claude determines best tier assignment | |

**User's choice:** Hero + Health = primary, rest = equal
**Notes:** Tertiary = hidden sections via WidgetSlot config.

### Visual weight expression

| Option | Description | Selected |
|--------|-------------|----------|
| Size + border treatment | Primary: no card border, larger fonts, bg tint. Secondary: card borders, normal fonts. | ✓ |
| Spacing only | Same card treatment, different vertical margins | |
| You decide | Claude picks best visual treatment | |

**User's choice:** Size + border treatment
**Notes:** Clear visual distinction between primary floating content and secondary card-bordered sections.

### Section order

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed order | Always same narrative order, no configuration | |
| Soft configuration | Fixed default, hide/show via dashboard_config | ✓ |

**User's choice:** Soft configuration
**Notes:** Leverages existing WidgetSlot system. No drag-drop.

---

## Section Narratives

### Subtitle format

| Option | Description | Selected |
|--------|-------------|----------|
| Dynamic subtitle sentence | Data-driven sentence below title, changes monthly | ✓ |
| Static purpose labels | Fixed explanatory subtitle | |
| Both — static + dynamic | Static always visible + dynamic insight when available | |

**User's choice:** Dynamic subtitle sentence
**Notes:** Every section interprets its data in a single sentence.

### Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly coach | Second person, encouraging, never guilt-inducing | ✓ |
| Neutral factual | Just facts, no editorial | |
| You decide | Claude picks per section | |

**User's choice:** Friendly coach
**Notes:** Aligns with UX-03. "Vas bien" / "Cuidado" / "Excelente". Never "MAL" or "Fallaste".

### No-data fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt to action | Guide user to fix data gap: "Importa tu extracto..." | ✓ |
| Hide the subtitle | Section title only, no subtitle | |
| Static fallback | Generic purpose label when no data | |

**User's choice:** Prompt to action
**Notes:** Empty states guide user toward resolving data gaps.

---

## Claude's Discretion

- Exact copy per section's dynamic subtitle
- Speedometer SVG implementation approach
- Color zone thresholds on gauge
- 0-100 scoring formulas per health dimension
- Mobile layout for speedometer section
- DashboardSection subtitle prop design
- New skeleton designs for health score section

## Deferred Ideas

None — discussion stayed within phase scope.
