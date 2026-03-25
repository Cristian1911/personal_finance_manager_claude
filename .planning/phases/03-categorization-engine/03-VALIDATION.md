---
phase: 3
slug: categorization-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | `packages/shared/vitest.config.ts` |
| **Quick run command** | `cd packages/shared && pnpm test` |
| **Full suite command** | `cd packages/shared && pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/shared && pnpm test`
- **After every plan wave:** Run `cd packages/shared && pnpm test && cd webapp && pnpm build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 0 | CAT-01..04 | unit | `cd packages/shared && pnpm test` | Wave 0 | pending |
| 03-02-01 | 02 | 1 | CAT-01 | unit | `cd packages/shared && pnpm test` | Wave 0 | pending |
| 03-02-02 | 02 | 1 | CAT-02 | unit | `cd packages/shared && pnpm test` | Wave 0 | pending |
| 03-02-03 | 02 | 1 | CAT-03 | unit | `cd packages/shared && pnpm test` | Wave 0 | pending |
| 03-02-04 | 02 | 1 | CAT-04 | unit | `cd packages/shared && pnpm test` | Wave 0 | pending |
| 03-03-01 | 03 | 2 | CAT-05 | manual | visual inspection in dev | -- | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `packages/shared/src/utils/__tests__/auto-categorize.test.ts` — test stubs for CAT-01 through CAT-04
- [ ] No framework install needed — Vitest already in `packages/shared/package.json`

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| USER_OVERRIDE transactions skipped in category inbox suggestions | CAT-05 | Requires UI interaction + DB state | 1. Manually categorize a tx, 2. Open category inbox, 3. Verify tx not in suggestions |
| categorization_source enum confirmed in DB types | CAT-06 | Schema verification | Verify `webapp/src/types/database.ts` contains `categorization_source` enum with expected values |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
