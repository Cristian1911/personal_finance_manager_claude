---
phase: 04-dashboard-performance
plan: 03
subsystem: webapp/charts
tags: [recharts, typescript, bundle, upgrade]
requirements: [PERF-04]
dependency_graph:
  requires: [04-01]
  provides: [recharts@3.x, type-safe-chart-wrapper]
  affects: [webapp/src/components/ui/chart.tsx, webapp/src/components/charts/*, webapp/src/components/debt/*]
tech_stack:
  added: ["recharts@3.8.1"]
  patterns: ["TooltipContentProps for custom tooltip typing", "LegendPayload array for legend content"]
key_files:
  created: []
  modified:
    - webapp/package.json
    - webapp/src/components/ui/chart.tsx
    - webapp/src/components/debt/salary-timeline-chart.tsx
    - pnpm-lock.yaml
decisions:
  - "Used TooltipContentProps (not TooltipProps) for ChartTooltipContent — v3 removed active/payload from TooltipProps (they're now in context)"
  - "Made ChartTooltipContent props Partial<TooltipContentProps> so JSX can pass empty props (recharts injects at render time)"
  - "Used RechartsPrimitive.LegendPayload array for ChartLegendContent instead of LegendProps['payload'] (LegendProps omits payload in v3)"
  - "Coerced p.dataKey to String() in key props — v3 dataKey type union now includes function signatures"
  - "Color format audit confirmed no hsl(var(--chart-N)) patterns — codebase already correct"
metrics:
  duration_minutes: 9
  completed_date: "2026-03-26"
  tasks_completed: 1
  files_modified: 4
---

# Phase 04 Plan 03: Recharts v3 Upgrade Summary

Upgraded recharts from v2.15.4 to v3.8.1 and resolved all TypeScript type errors introduced by the v3 breaking changes. Build passes clean.

## What Was Done

Upgraded recharts and resolved 4 TypeScript type errors:

1. `ChartTooltipContent` in `chart.tsx`: The `TooltipProps` type in recharts v3 omits `active`, `payload`, `coordinate`, `label`, and `accessibilityLayer` from the public component props (they're injected by recharts internally via context). Fixed by using `Partial<TooltipContentProps>` as the base type.

2. `ChartLegendContent` in `chart.tsx`: `LegendProps` in v3 also omits `payload` and `verticalAlign`. Fixed by using `ReadonlyArray<RechartsPrimitive.LegendPayload>` directly instead of `LegendProps["payload"]`.

3. `chart.tsx` item key: `dataKey` in v3 can be a function `(obj: any) => any`, not just `string | number`. Fixed `key={item.dataKey}` → `key={String(item.dataKey)}`.

4. `salary-timeline-chart.tsx`: Same `dataKey` function issue in a tooltip payload map. Fixed both the `key` prop and the label display fallback with `String(p.dataKey)`.

## Acceptance Criteria Verification

- `webapp/package.json` contains `"recharts": "3.8.1"` ✓
- `pnpm build` passes clean (exit code 0) ✓
- `grep -r "hsl(var(--chart" webapp/src/` returns zero results ✓
- No `as any` casts added ✓
- `chart.tsx` compiles without TypeScript errors ✓

## Deviations from Plan

None — plan executed exactly as written. The 4 breaking changes encountered match what RESEARCH.md predicted (TooltipProps type changes, dataKey union type). All fixes applied per the "Don't Hand-Roll" guidance (no `as any` casts; fixed actual types).

## Commits

| Hash | Description |
|------|-------------|
| d60909e | feat(04-03): upgrade recharts v2 -> v3.8.1 and fix TypeScript type errors |

## Self-Check: PASSED

- `webapp/package.json` exists with recharts 3.8.1: ✓
- `webapp/src/components/ui/chart.tsx` modified: ✓
- `webapp/src/components/debt/salary-timeline-chart.tsx` modified: ✓
- Commit d60909e exists: ✓
