# Phase 1: Security Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 01-security-foundation
**Areas discussed:** middleware strategy, error boundary UX, 404 page, admin client behavior
**Mode:** Auto (all recommended defaults selected)

---

## Middleware Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Blacklist (protect all, whitelist public) | Safer — new routes auto-protected | ✓ |
| Whitelist (list protected routes) | Current approach — requires manual updates for new routes | |

**User's choice:** Blacklist (auto-selected recommended default)
**Notes:** Current whitelist only covers 6 of 13+ dashboard routes. Blacklist approach prevents future security gaps.

---

## Error Boundary UX

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal recovery (message + back button) | Clean, no error details exposed | ✓ |
| Detailed (show error message in dev) | More debugging info but more complex | |
| Retry-focused (reset + retry button) | Good for transient errors | |

**User's choice:** Minimal recovery (auto-selected recommended default)
**Notes:** Spanish copy. Log error server-side only.

---

## 404 Page

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly with navigation | Dashboard + login links | ✓ |
| Minimal redirect | Auto-redirect to dashboard | |

**User's choice:** Friendly with navigation (auto-selected recommended default)
**Notes:** Spanish copy, consistent with app styling.

---

## Admin Client Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Throw descriptive error | Explicit failure, remove 37 `!` assertions | ✓ |
| Return null with guard pattern | Keep current, add explicit null checks at call sites | |

**User's choice:** Throw descriptive error (auto-selected recommended default)
**Notes:** After change, all 37 call sites can remove `!` non-null assertion.

---

## Claude's Discretion

- Error boundary reset mechanism (retry vs navigate)
- Whether to add global error.tsx in addition to dashboard-scoped one
- Exact middleware path matching logic

## Deferred Ideas

None.
