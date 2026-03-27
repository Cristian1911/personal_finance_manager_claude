---
phase: 5
slug: onboarding-audit
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual browser verification (static HTML output) |
| **Config file** | none — static HTML file opened in browser |
| **Quick run command** | `open ui-showcases/onboarding-walkthrough.html` |
| **Full suite command** | `open ui-showcases/onboarding-walkthrough.html` |
| **Estimated runtime** | ~5 seconds (manual visual check) |

---

## Sampling Rate

- **After every task commit:** Open HTML file in browser, verify rendering
- **After every plan wave:** Full visual walkthrough of all steps
- **Before `/gsd:verify-work`:** All steps render, all annotations present, all navigation works
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | ONB-01 | manual | `open ui-showcases/onboarding-walkthrough.html` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ui-showcases/` directory exists
- [ ] Basic HTML file structure validated (opens in browser without errors)

*Existing infrastructure covers all phase requirements — no test framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| All 6 onboarding steps render correctly | ONB-01 | Static HTML visual output — no programmatic assertion possible | Open file in browser, click through each step, verify content matches source code |
| Annotations display on each step | ONB-01 | Visual UX audit annotations require human review | Verify each step has 2-4 annotation callouts with findings from source audit |
| Navigation between steps works | ONB-01 | Click interaction in static HTML | Click next/prev on each step, verify correct step loads |
| Self-contained (no server needed) | ONB-01 | Protocol constraint: file:// must work | Open via file:// protocol, verify all styles and interactions load |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
