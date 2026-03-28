---
name: frontend-audit
description: Audit frontend code against Zeta's standards — design tokens, component patterns, performance, accessibility, responsive, localization. Use after implementing features, during code review, or to find frontend tech debt.
---

# Frontend Audit

Systematic review of frontend code against the Zeta Frontend Standards.

## When to Use

- After implementing a new feature or page
- Before creating a PR with UI changes
- When cleaning up frontend tech debt
- When onboarding to an unfamiliar part of the codebase
- Periodically (monthly) as a full codebase health check

## How to Run

### Quick Audit (single feature or recent changes)

Launch the `frontend-auditor` agent with a focused scope:

```
Audit the frontend code in components/debt/ against docs/FRONTEND_STANDARDS.md
```

Or audit recent changes:

```
Audit all .tsx files changed in the last 3 commits against docs/FRONTEND_STANDARDS.md
```

### Full Audit

Launch the `frontend-auditor` agent for a comprehensive review:

```
Run a full frontend audit of the entire webapp/src/ directory against docs/FRONTEND_STANDARDS.md
```

For large audits, consider splitting into parallel sub-agents by category:

1. **Architecture + Performance agent** — Component structure, RSC usage, caching, bundle analysis
2. **Design + Accessibility agent** — Token compliance, WCAG, responsive, localization
3. **Forms + Security agent** — Validation patterns, auth checks, server action patterns

### Fix Mode

After receiving an audit report, you can ask the agent to fix issues:

```
Fix all critical issues from the audit report, starting with performance violations
```

## Audit Categories

| Category | Weight | Key Checks |
|---|---|---|
| Component Architecture | HIGH | `"use client"` necessity, composition, size, exports |
| Design Token Compliance | HIGH | CSS variables, semantic colors, no hardcoded hex |
| Performance | HIGH | No chart animation, no waterfalls, server components, caching |
| Forms & Validation | MEDIUM | RHF + Zod pattern, auth checks, defense in depth |
| Accessibility | MEDIUM | Focus rings, ARIA labels, semantic HTML, keyboard nav |
| Responsive Design | MEDIUM | Mobile-first, touch targets, safe dialog sizing |
| Localization | MEDIUM | Spanish text, formatCurrency, formatDate |
| Code Quality | LOW | No any, no ts-ignore, naming conventions |

## Output

The agent produces a scored report (0-100) with:
- Summary table by category
- Critical issues (fix immediately)
- Warnings (fix soon)
- Suggestions (nice to have)
- Positive findings (what's done well)

Each issue includes file path, line number, standard reference, and a concrete fix suggestion.

## Reference

- Standards document: `docs/FRONTEND_STANDARDS.md`
- Agent definition: `.Codex/agents/frontend-auditor.md`
- Design tokens: `webapp/src/app/globals.css`
- Component library: `webapp/src/components/ui/`
