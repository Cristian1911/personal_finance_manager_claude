# Zeta — Project Status

**Codename:** Zeta (personal_finance_manager)
**Type:** Personal Finance Manager (PFM) — Colombian fintech
**Stack:** Next.js 15, Supabase, Tailwind v4, shadcn/ui, FastAPI (PDF parser), Docker
**Status:** 🟢 Active Development (most mature)
**Last updated:** 2026-03-06

## Summary

Full-stack personal finance manager for Colombian users. Core features: bank PDF import (Bancolombia, Nu, Lulo), auto-categorization, debt tracking, account reconciliation, statement snapshot history. Spanish UI. Monorepo with Next.js webapp + Python PDF parser service.

## Current Sprint Focus

- Balance reconciliation per account — recently shipped
- Auto-exclude balance adjustments on PDF import — recently shipped
- Nu Colombia credit card parser — recently built (needs E2E testing)
- Lulo Bank loan parser — recently built (needs E2E testing)

## Key Links

- Repo: local (current-projects/zeta)
- System analysis: `PFM_system_analysis.md` (comprehensive architecture doc)
- UX evolution roadmap: `improvements_and_ux_evolutions.md`
- Dashboard & gamification research: `dashboard_and_gamification.md`
- Session handover: `HANDOVER.md`
