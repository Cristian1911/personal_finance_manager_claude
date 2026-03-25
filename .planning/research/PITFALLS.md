# Domain Pitfalls

**Domain:** Personal finance app UX polish / incremental redesign
**Project:** Zeta — Polish & Refinement Milestone
**Researched:** 2026-03-25
**Confidence:** HIGH (grounded in actual codebase state + verified sources)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or regressions that users notice immediately.

---

### Pitfall 1: Breaking Existing Functionality During Visual Refactors

**What goes wrong:** A component is "cleaned up" or "simplified" during polish. The visual output looks identical, but server action wiring, form state, or optimistic update logic was quietly removed or broken. With 29 server actions and zero test coverage, there is no safety net.

**Why it happens:** Polish work feels low-risk. The developer focuses on spacing, typography, and color — not data flow. A `useActionState` binding or a `revalidatePath` call gets dropped when a component is restructured.

**Consequences:** Transactions stop saving. Categories don't persist. Import wizard silently drops steps. The breakage may not surface until the user tries to use the feature.

**Prevention:**
- Treat every server action as a contract. Before refactoring a component that calls one, note the action name and its expected side effects.
- For each phase, explicitly list which server actions the components under work touch, and manually verify they still fire after the change.
- Run `pnpm build` after every component change — TypeScript will catch missing props, but not behavioral regressions.
- Prioritize the most-used flows (import wizard, transaction form, categorize inbox) for manual smoke-testing after any polish to those screens.

**Warning signs:**
- A component was converted from `"use client"` to a Server Component (or vice versa) but its action wiring wasn't updated.
- A form's `action` prop was replaced with `onSubmit` (or removed) during cleanup.
- `revalidatePath` calls disappear from diff.

**Phase mapping:** Every phase that touches UI components carrying server actions (dashboard, import, transactions, onboarding, categories).

---

### Pitfall 2: Middleware Security Gap Widened During Route Reorganization

**What goes wrong:** The current middleware `protectedPaths` list is already incomplete. It protects `/dashboard`, `/transactions`, `/accounts`, `/categories`, `/destinatarios`, `/settings` — but routes like `/import`, `/categorizar`, `/deudas`, `/recurrentes`, `/gestionar` are unprotected. A polish phase that adds new routes or renames existing ones will not automatically inherit protection.

**Why it happens:** Route reorganization happens during polish (e.g., breaking a large page into sub-routes). The developer adds the new route but forgets to add it to the middleware allow-list.

**Consequences:** Unauthenticated users can access financial data pages. Server actions still enforce auth via `getAuthenticatedClient()`, so data won't leak — but the UX response is a null render or crash instead of a clean redirect to login.

**Prevention:**
- Fix the existing gap first (add `/import`, `/categorizar`, `/deudas`, `/recurrentes`, `/gestionar` to `protectedPaths`) as the very first security task.
- Consider switching from an explicit allow-list to a deny-except pattern: protect everything under `/(dashboard)/` by path prefix, then explicitly exclude public paths.
- After any route addition, grep for the new path in `middleware.ts` before merging.

**Warning signs:**
- A new `/dashboard/*` sub-route exists but isn't in `protectedPaths`.
- Visiting a new route while logged out renders a blank page instead of redirecting.

**Phase mapping:** Security hardening phase; also any phase that adds new routes.

---

### Pitfall 3: Performance Regression from Eager Animation/Chart Imports

**What goes wrong:** `framer-motion` (~150KB) appears in the onboarding page today, and `recharts` (~450KB) is imported in 18+ chart components. If the dashboard redesign adds new chart widgets without lazy-loading them, the already-heavy dashboard gets slower. The user's #1 stated priority is speed.

**Why it happens:** Adding a chart to a dashboard section is a two-line import. Lazy-loading requires `next/dynamic` with `ssr: false` and a Suspense fallback — it's more work and easy to defer.

**Consequences:** First meaningful paint of the dashboard degrades. On mobile (which is the design source of truth), this is immediately perceptible. The performance audit cited 10+ parallel queries on cache miss plus eager library loads — the combination is worse than either alone.

**Prevention:**
- Establish a rule: no chart component import is ever a static import at the page level. All chart components must use `next/dynamic({ ssr: false, loading: () => <Skeleton /> })`.
- Apply the same rule to `framer-motion` `AnimatePresence`/`motion.*` usage outside of already-client components.
- After any dashboard change, check bundle size with `pnpm build` output — Next.js prints first-load JS per route.
- For `recharts` specifically: the `ResponsiveContainer` causes a re-render on mount when it measures its parent. Wrap charts in a fixed-height container to prevent layout shift.

**Warning signs:**
- A new file has `import { AreaChart } from "recharts"` at the top level in a Server Component or page file.
- Dashboard first-load JS exceeds the pre-polish baseline.
- Lighthouse LCP score drops after adding a new section.

**Phase mapping:** Dashboard redesign phase; performance phase; any phase adding new visualizations.

---

### Pitfall 4: Onboarding Redesign That Asks More, Not Less

**What goes wrong:** The audit reveals the current onboarding has 6 steps and asks for: purpose, full name, currency, estimated income, estimated expenses, debt count, a tab preview, and account creation. The redesign impulse is to add more fields to power downstream features (health score, 50/30/20, debt countdown). The result is a longer, more intimidating flow.

**Why it happens:** The product genuinely needs income/goal data. The natural response is to add more questions. But each additional step compounds drop-off probability — even in a single-user app, a tedious onboarding degrades the quality of data collected because users rush through it.

**Consequences:** Estimated income/expense figures entered hastily are wrong. Health meters and 50/30/20 allocations then show misleading numbers from day one, eroding trust in the dashboard's "Am I on track?" narrative.

**Prevention:**
- Treat onboarding as minimum viable setup: capture only what is absolutely required for the dashboard to render meaningfully (income, currency, one account).
- Move "debt count", "tab preference", and "account type" to a post-onboarding setup prompt or settings page — surface these contextually when the user first visits the relevant section.
- Mark income/expenses fields as estimates with a visible note ("Puedes cambiarlo en ajustes") to reduce the psychological weight of getting it "right."
- Use progressive disclosure: one question per screen, not multiple fields per step.

**Warning signs:**
- The redesigned flow has more steps than the current 6-step flow.
- A screen requires more than 2 inputs.
- The onboarding collects data that isn't used until 3+ screens later in the app.

**Phase mapping:** Onboarding audit phase; onboarding redesign phase.

---

### Pitfall 5: Auto-Categorization Rules That Silence Manual Intent

**What goes wrong:** The rules engine is improved with more patterns. A rule catches "RAPPI*" and assigns it to "Comidas". But the user had previously manually categorized a Rappi pharmacy transaction to "Salud". After the rule engine improvement, re-imports or the categorize inbox auto-applies the new rule and overwrites the manual choice.

**Why it happens:** Rule engines typically don't distinguish between "user manually set this category" and "this was auto-assigned." When a better rule is added later, it overrides both.

**Consequences:** Trust in the categorization system collapses. The user starts manually reviewing every transaction again, defeating the purpose of automation.

**Prevention:**
- Never overwrite a `category_id` that was manually set by the user. Add a `manually_categorized: boolean` column (or infer it from a `categorized_by` enum field) and skip auto-categorization for those transactions.
- The categorize inbox is the right place to apply auto-categorization rules — not the import pipeline. Import should only apply rules to uncategorized transactions.
- When adding new rules, test them against the existing transaction corpus to measure precision (false positives matter more than recall for trust).
- Rule specificity: more-specific rules should win over generic ones. "RAPPI*FARMACIA" → Salud beats "RAPPI*" → Comidas.

**Warning signs:**
- Auto-categorize logic doesn't check for existing `category_id` before overwriting.
- Import pipeline applies categorization rules unconditionally.
- No distinction between `auto` and `manual` categorization in the data model.

**Phase mapping:** Auto-categorization improvement phase.

---

## Moderate Pitfalls

Mistakes that create UX debt, subtle inconsistencies, or bugs that are annoying but recoverable.

---

### Pitfall 6: Information Hierarchy "Redesign" That Just Rearranges Widgets

**What goes wrong:** The dashboard polish moves widgets around, changes colors, and adds a health score header — but doesn't actually answer "Am I on track?" any better. The result looks polished but communicates the same unclear story with better typography.

**Why it happens:** It's easier to style existing components than to rethink what data deserves to be primary vs. secondary. Component reordering feels like hierarchy work.

**Consequences:** The north star goal ("every screen should answer Am I on track? without requiring explanation") is not achieved. The milestone delivers visual polish but not narrative clarity.

**Prevention:**
- Before touching any dashboard component, write down the single sentence the dashboard should communicate on first glance. Use that as a test: can a new user read that sentence from the current layout?
- Demote rather than rearrange: explicitly decide what goes below the fold and put it there. Not everything on the current dashboard earns above-the-fold space.
- The health score / verdict widget should be the first thing rendered, not just present somewhere on the page.
- Resist adding new widgets to the dashboard during the polish phase — the constraint is clarity, not completeness.

**Warning signs:**
- The redesigned dashboard has the same number of distinct visual sections as before.
- The "health score" or "on track" signal is not visible without scrolling on a 1080p screen.
- The redesign primarily changed colors and spacing, not content hierarchy.

**Phase mapping:** Dashboard redesign phase.

---

### Pitfall 7: Financial Health Score With False Precision

**What goes wrong:** A health score of "73 / 100" feels authoritative. When income was entered as a rough estimate during onboarding, the score is computed from unreliable inputs. Users either over-trust it or, once they notice it doesn't match reality, dismiss the entire dashboard.

**Why it happens:** Displaying a precise number is technically straightforward. Displaying a number with calibrated uncertainty is design work.

**Consequences:** The "Am I on track?" narrative becomes untrustworthy. A user who is actually doing fine sees a misleadingly low score because their income estimate was 20% off, and becomes anxious.

**Prevention:**
- Display the health score as a band or label ("En forma", "Atención", "Crítico") rather than a precise number when input data quality is low.
- Show the score's confidence level: if income was set during onboarding and hasn't been updated in 3+ months, show a "Actualiza tus ingresos" nudge rather than a degrading score.
- For the 50/30/20 allocation, display "~" prefixes on percentages when computed from estimated income.
- Surface what inputs are driving the score so the user can understand and trust it.

**Warning signs:**
- Health score displays as `X / 100` with no context about what `X` means.
- Score changes significantly when the user makes a trivial data change (highly sensitive to input variance).
- No indication when the score's underlying data is stale or estimated.

**Phase mapping:** Dashboard redesign phase; onboarding redesign phase.

---

### Pitfall 8: Hydration Mismatch When Adding Suspense Boundaries

**What goes wrong:** The dashboard currently uses minimal Suspense. When streaming is added (Suspense wrapping slow data fetches), adding client-side state or date/time calculations inside those boundaries causes hydration mismatches. The server renders one value; the client hydrates with a different value (e.g., "today" computed at different times, locale-dependent formatting).

**Why it happens:** Next.js App Router streaming only works correctly when async operations happen inside suspended components, not at the page level. Moving data fetching into Suspense boundaries is the right direction, but any non-deterministic output (dates, times, random keys) inside those boundaries will mismatch.

**Consequences:** React discards server-rendered HTML and re-renders on the client, causing visible flash. For a finance dashboard showing currency amounts, flashing numbers look like bugs.

**Prevention:**
- All date/time formatting that depends on `new Date()` (not a fixed DB timestamp) must be done in Client Components — not inside Suspense-wrapped Server Components.
- The existing `formatDate()` util from `date.ts` that uses Spanish locale is fine for fixed dates. Be cautious with "today", "hace X días", "en X días" relative calculations in SSR context.
- Test Suspense boundaries with `connection()` removed to verify hydration-free renders.
- Use `suppressHydrationWarning` only as a last resort on truly unavoidable time-dependent nodes.

**Warning signs:**
- Console shows `"Hydration failed because the initial UI does not match what was rendered on the server"` after adding a Suspense boundary.
- A dashboard section flashes blank on page load then re-renders.
- A relative date string ("ayer", "hace 3 días") is computed server-side inside a Suspense boundary.

**Phase mapping:** Performance / Suspense streaming phase.

---

### Pitfall 9: TypeScript `any` Cleanup That Introduces Runtime Crashes

**What goes wrong:** Replacing `any` with a proper type in `transactions.ts`, `exchange-rate.ts`, or `enhanced-cashflow-chart.tsx` is correct. But if the actual runtime data doesn't match the newly declared type (e.g., a Supabase join returns `null` where the type now says `string`), TypeScript accepts the code but the app crashes at runtime.

**Why it happens:** `any` was often used because the actual runtime shape was unknown or inconsistent. Replacing it with a stricter type doesn't change the runtime shape — it only changes what TypeScript believes.

**Consequences:** Silent runtime crashes in server actions. A `Cannot read properties of null` in the exchange rate action could break multi-currency display across the entire dashboard.

**Prevention:**
- When replacing `any`, first log/inspect what the value actually contains at runtime before writing the type. Don't infer from intent — infer from data.
- Use `unknown` as the intermediate step when unsure, then narrow with guards before the final type assignment.
- For Supabase query results: the generated types in `src/types/database.ts` are the source of truth. If a join can return `null`, the type must reflect that (use `| null`).
- Add Zod parse/safeParse at the boundary where external data enters (Supabase response → domain type) rather than just asserting the type.

**Warning signs:**
- A diff shows `as SomeType` assertion replacing `: any`.
- A Supabase `.select()` with joins is typed as a flat object rather than a nested one.
- No runtime validation added alongside the type change.

**Phase mapping:** Type safety cleanup phase; any phase touching server actions.

---

## Minor Pitfalls

Mistakes that create cosmetic issues or minor inconsistencies.

---

### Pitfall 10: Visual Polish That Breaks Mobile Layout

**What goes wrong:** Polish work is done on a desktop viewport. Spacing, grid layouts, or card heights look correct at 1280px. On the mobile viewport (the stated design source of truth), components overflow, stack awkwardly, or become unreadable.

**Prevention:**
- Test every changed component at 375px width before marking a task done.
- Tailwind v4 breakpoints default to mobile-first — utility classes without a prefix apply to all sizes. Don't add desktop-only styles that override mobile defaults.
- Check the mobile-specific components (`MobileDashboard`, `MobileTopbar`, `MobilePageHeader`) separately — they have parallel implementations that can fall out of sync with the desktop version.

**Warning signs:**
- A card has a fixed `h-[200px]` without responsive variant.
- A grid uses `grid-cols-3` without a `grid-cols-1` mobile base.
- The mobile nav (`mobile-nav.tsx`) is untouched but the page it links to was restructured.

**Phase mapping:** Visual polish phase; dashboard redesign phase.

---

### Pitfall 11: Tailwind v4 `@apply` and CSS Variable Specificity Surprises

**What goes wrong:** The project is already on Tailwind v4. The `@apply` directive has known breakage in v4, and CSS variable-based theming (used by shadcn/ui) can have unexpected specificity behavior with the cascade layers (`@layer utilities` always beats `@layer components`). Custom overrides using `@apply` in `globals.css` may silently stop working.

**Prevention:**
- Avoid `@apply` in new CSS. Prefer inline Tailwind classes or inline styles for one-off overrides (the codebase already uses inline styles for status surface colors on timeline components — this is correct).
- When a visual style isn't applying, check layer order before escalating to `!important`.
- For shadcn/ui component overrides: pass `className` props or use CSS variables at the `:root` level, not component-level `@apply`.

**Warning signs:**
- A style applied via `@apply` in a CSS file appears correct in dev but breaks in production build.
- A dark mode color doesn't apply even though the CSS variable is defined.

**Phase mapping:** Visual polish phase; any phase touching `globals.css`.

---

### Pitfall 12: Dead Code Removal That Deletes Live Code

**What goes wrong:** The reconciliation column fallback and `any`-typed wrappers are marked for removal. If a grep-and-delete is performed without tracing all call sites, a component that still uses the "dead" code will break silently (Server Components don't always crash at build time for missing exports if the call site has its own fallback).

**Prevention:**
- Use `trace_call_path` (codebase-memory-mcp) to confirm zero active callers before deleting any export.
- Delete dead code in its own commit, separate from visual changes — smaller diffs make breakage easier to isolate.
- Run `pnpm build` immediately after any deletion.

**Warning signs:**
- A function is "unused" according to TypeScript but is imported via dynamic string key (common in config-driven code like `ICON_MAP` in onboarding).
- Removing a type export causes a cascade of `any` fallbacks downstream.

**Phase mapping:** Dead code removal phase; type safety cleanup phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Dashboard redesign | Widget rearrangement mistaken for hierarchy work (P6) | Define the one-sentence communication goal before touching layout |
| Dashboard redesign | Performance regression from new chart widgets (P3) | All charts must use `next/dynamic` with skeleton fallback |
| Dashboard redesign | False precision in health score (P7) | Show bands/labels, not raw numbers; nudge to update stale income data |
| Performance / Suspense | Hydration mismatch on relative dates (P8) | Relative time calculations must be client-side only |
| Onboarding audit + redesign | Longer flow from adding more fields (P4) | Defer non-critical fields to post-onboarding contextual prompts |
| Auto-categorize improvement | Overwriting manual categorizations (P5) | Gate on `manually_categorized` flag; never overwrite user intent |
| Security hardening | New routes missing from middleware (P2) | Fix existing gaps first; switch to deny-by-default pattern |
| Visual polish | Desktop-only changes break mobile (P10) | Test at 375px; check parallel mobile components |
| Type safety cleanup | `any` → typed breaks runtime shape (P9) | Verify actual runtime data before writing type; use Zod at boundaries |
| Dead code removal | Deleting live code (P12) | Trace all callers with codebase-memory-mcp before deleting |
| Any component refactor | Server action wiring broken silently (P1) | Enumerate affected actions before refactoring; manual smoke test after |

---

## Sources

- [Top 10 UX Mistakes Fintech Apps Make — Pragmatic Coders](https://www.pragmaticcoders.com/blog/ux-mistakes-in-fintech-apps)
- [Fintech Onboarding Best Practices — UserGuiding](https://userguiding.com/blog/fintech-onboarding)
- [Why Transaction Categorization Is Hard — Triqai](https://www.triqai.com/article/why-transaction-categorization-is-hard)
- [Transaction Categorization Engine — Planky](https://planky.com/blog/product/transaction-categorization-engine-how-is-it-made/)
- [React Server Components Performance Pitfalls — LogRocket](https://blog.logrocket.com/react-server-components-performance-mistakes)
- [Next.js 15 Streaming Handbook — freeCodeCamp](https://www.freecodecamp.org/news/the-nextjs-15-streaming-handbook/)
- [Next.js Hydration Errors — Sentry](https://sentry.io/answers/hydration-error-nextjs/)
- [Tailwind v4 Migration Breaking Changes — designrevision](https://designrevision.com/blog/tailwind-4-migration)
- [Framer Motion + Next.js 15 compatibility discussion](https://github.com/vercel/next.js/discussions/72228)
- [shadcn/ui Chart Accessibility Review](https://ashleemboyer.com/blog/a-quick-ish-accessibility-review-shadcn-ui-charts)
- [UX Strategies for Real-Time Dashboards — Smashing Magazine](https://www.smashingmagazine.com/2025/09/ux-strategies-real-time-dashboards/)
- [Finance App Churn Mistakes — Netguru](https://www.netguru.com/blog/mistakes-in-creating-finance-app)
- Zeta codebase: `webapp/middleware.ts`, `webapp/src/app/onboarding/page.tsx`, `webapp/src/app/(dashboard)/dashboard/page.tsx` (direct inspection, 2026-03-25)
