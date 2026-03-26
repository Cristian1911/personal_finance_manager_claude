---
phase: 4
slug: dashboard-performance
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.18 |
| **Config file** | None detected (build-gate only — no unit tests for this phase) |
| **Quick run command** | `cd webapp && pnpm build` |
| **Full suite command** | `cd webapp && pnpm build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd webapp && pnpm build`
- **After every plan wave:** Run `cd webapp && pnpm build`
- **Before `/gsd:verify-work`:** Full build must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PERF-05 | automated | `cd webapp && npx tsc --noEmit --pretty 2>&1 \| head -20` | N/A | pending |
| 04-01-02 | 01 | 1 | PERF-01 | automated | `cd webapp && pnpm build 2>&1 \| tail -5` | N/A | pending |
| 04-02-01 | 02 | 1 | PERF-03 | automated | `grep 'framer-motion' webapp/package.json \|\| echo 'absent'; cd webapp && pnpm build 2>&1 \| tail -5` | N/A | pending |
| 04-03-01 | 03 | 2 | PERF-04 | automated | `cd webapp && pnpm build 2>&1 \| tail -5` | N/A | pending |
| 04-04-01 | 04 | 3 | PERF-02 | automated | `cd webapp && pnpm build 2>&1 \| tail -10` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed. The phase-level gate is `pnpm build` passing after each work stream. All tasks have `<automated>` verify commands — no Wave 0 test scaffolding is required.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tier 1 data renders before tier 2 | PERF-01 | Requires visual timing verification | Open dashboard in dev; tier 1 (hero, health) renders immediately; tier 2 shows skeletons then streams in |
| Content-shaped skeletons match layout | PERF-05 | Visual/structural check | Each Suspense fallback has structured card+content skeleton (not a generic spinner or single div) |
| Recharts not in initial JS chunk | PERF-02 | Bundle analysis | Run `pnpm build`, inspect `.next/static/chunks/` — no recharts module in page-level chunk |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
