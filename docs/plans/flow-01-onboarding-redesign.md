# Flow 01 · Onboarding redesign (webapp mobile)

## Goal
Shorten the time-to-dashboard. Drop the email-confirmation dance and collect
the user's context with chips instead of form-dense cards. Match the mobile-
first tone in `claude-ai-design/Zeta Wireframes.html` (Flow 01, frames F1–F6).

## Decisions locked

1. **Email confirmation is disabled on signup.**
   The code path is already wired: if the Supabase session is returned from
   `signUp()`, we redirect straight to `/onboarding`. If the project-level
   "Confirm email" toggle is still ON, we fall back to the existing
   "revisa tu correo" message. Required operator action — flip
   **Supabase dashboard → Auth → Providers → Email → "Confirm email" OFF**.

2. **Full name moves from signup to onboarding step 2.**
   Signup is now email + password only. One less field before the app opens,
   and we gain the chance to collect it alongside currency on the first
   post-signup screen.

3. **PIN from wireframe F2 is deferred.**
   Supabase Auth has no 6-digit PIN primitive; we keep email + password. PIN
   remains a future surface (would need a custom table + RPC + rate-limit).

4. **Cadence + partner tracking from wireframe F3 are deferred.**
   Requires new profile columns and downstream consumers. Scoped to a
   follow-up so this PR stays shippable.

5. **`/auth/callback` stays.**
   Password reset links still flow through it.

## Files changed

- `webapp/src/lib/validators/auth.ts` — drop `fullName` from `signupSchema`.
- `webapp/src/actions/auth.ts` — `signUp` redirects to `/onboarding` when
  a session is returned; otherwise falls back to the old success shape.
- `webapp/src/components/auth/signup-form.tsx` — no full-name field.
- `webapp/src/app/(auth)/layout.tsx` — mobile-first Zeta header shell.
- `webapp/src/app/(auth)/signup/page.tsx` + `login/page.tsx` — Obsidian &
  Brass card treatment, Spanish copy that matches the wireframe voice.
- `webapp/src/app/onboarding/layout.tsx` — mobile shell mirroring auth.
- `webapp/src/app/onboarding/page.tsx` — chip-style pickers (purpose,
  currency, account type), tighter mobile layout, full-name collected here.

## Follow-ups

- Embed the "importa un extracto" flow inside onboarding step 4 so a
  first-time user lands on a populated dashboard (wireframe F5).
- Add an "ask for verified email" prompt on features that need it (email
  auto-forward, possibly partner invites).
- Revisit cadence + partner chips once the schema is extended.
