---
phase: 4
slug: dashboard-performance
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 04-01-01 | 01 | 1 | PERF-01 | manual-only | Code inspection — `Promise.all` in page.tsx contains exactly 2 tier-1 items | N/A | ⬜ pending |
| 04-01-02 | 01 | 1 | PERF-05 | manual-only | Visual inspection — Suspense fallbacks have card+content skeleton structure | N/A | ⬜ pending |
| 04-02-01 | 02 | 1 | PERF-02 | automated | `pnpm build` clean + no recharts in initial page chunk | N/A | ⬜ pending |
| 04-02-02 | 02 | 1 | PERF-04 | automated | `grep "recharts.*3\." webapp/package.json` returns match + `pnpm build` clean | N/A | ⬜ pending |
| 04-03-01 | 03 | 1 | PERF-03 | automated | `grep -r "framer-motion" webapp/package.json` returns nothing | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test files needed. The phase-level gate is `pnpm build` passing after each work stream.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tier 1 data renders before tier 2 | PERF-01 | Requires visual timing verification | Open dashboard in dev; tier 1 (hero, health) renders immediately; tier 2 shows skeletons then streams in |
| Content-shaped skeletons match layout | PERF-05 | Visual/structural check | Each Suspense fallback has structured card+content skeleton (not a generic spinner or single div) |
| Recharts not in initial JS chunk | PERF-02 | Bundle analysis | Run `pnpm build`, inspect `.next/static/chunks/` — no recharts module in page-level chunk |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
