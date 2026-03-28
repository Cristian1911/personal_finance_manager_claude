---
name: perf-audit
description: Audit a web application for performance issues — database queries, rendering strategy, caching, bundle size, and Vercel React best practices. Use when user asks to audit, analyze, profile, or improve webapp performance.
---

## Performance Audit Skill

Run a comprehensive performance audit of the current web application codebase. This skill orchestrates the `perf-auditor` agent to analyze 6 dimensions of webapp performance.

### When to Use

- User asks to "audit performance", "check for bad practices", "optimize the app"
- Before a major release or after significant feature work
- When users report slowness or high load times
- Periodically as part of engineering hygiene

### How to Run

Spawn the `perf-auditor` agent with context about the current project:

```
Use the Agent tool with subagent_type: "perf-auditor" (or reference .Codex/agents/perf-auditor.md)
```

The agent will:
1. Scan all database migrations for RLS and index issues
2. Audit every page component for rendering strategy problems
3. Check caching patterns for overly broad invalidation
4. Analyze bundle size and code splitting opportunities
5. Verify adherence to Vercel's 62 React optimization rules
6. Check middleware, loading states, and image optimization

### Parallel Audit Strategy

For faster results, spawn 3 agents in parallel covering different dimensions:

**Agent 1 — Database & RLS:**
> Audit this codebase for database performance issues. Check: RLS policies in supabase/migrations/ for bare auth.uid() and subqueries. N+1 queries in server actions. Missing indexes by cross-referencing .eq()/.filter()/.order() columns with CREATE INDEX statements. Defense-in-depth (missing user_id filters). Report with severity, file:line, code snippet, and fix.

**Agent 2 — Rendering & Caching:**
> Audit this codebase for rendering and caching performance issues. Check: page.tsx/layout.tsx for unnecessary 'use client', missing Suspense boundaries, Suspense without fallbacks. Data fetching waterfalls (sequential awaits, .then() in Promise.all). Cache tag granularity (broad tags invalidating unrelated data). revalidateTag/revalidatePath scope. Report with severity, file:line, code snippet, and fix.

**Agent 3 — Bundle & Dependencies:**
> Audit this codebase for bundle size and dependency issues. Check: package.json for heavy/unused dependencies. Missing next/dynamic on components over 300 lines. 'use client' on purely presentational components. Animation overhead (framer-motion on navigation, recharts without isAnimationActive={false}). Image optimization (img vs next/image). Report with severity, file:line, code snippet, and fix.

### After the Audit

1. Review the findings report
2. Create a plan document in `docs/plans/` with the date prefix
3. Prioritize: CRITICAL → HIGH → MEDIUM → LOW
4. Always verify with `pnpm build` after changes
5. For database changes, use `pg_stat_statements` before/after to measure impact

### Reference: Vercel's 62 React Optimization Rules

Source: [vercel-labs/agent-skills/react-best-practices](https://github.com/vercel-labs/agent-skills)

**CRITICAL (10 rules):**
- Eliminating waterfalls: Promise.all, Suspense boundaries, defer await, dependency scheduling
- Bundle size: dynamic imports, barrel imports, defer third-party, conditional loading, preload on intent

**HIGH (8 rules):**
- Server: auth in actions, dedup serialization, LRU caching, hoist static I/O, minimize RSC serialization, parallel fetching, React.cache(), after() for non-blocking ops

**MEDIUM (28 rules):**
- Client data: event listeners, passive listeners, SWR dedup, localStorage versioning
- Re-renders: derived state, defer reads, memo, functional setState, transitions, useRef for transient values
- Rendering: content-visibility, hoist static JSX, hydration, Activity, script defer, resource hints

**LOW (16 rules):**
- JS micro-optimizations: batch DOM, index maps, cache property access, combine iterations, Set/Map lookups, flatMap, toSorted
- Advanced: init once, event handler refs, useEffectEvent
