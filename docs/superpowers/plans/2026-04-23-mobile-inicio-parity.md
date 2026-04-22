# Mobile Inicio — Webapp Parity (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `mobile/components/inicio/InicioRoot.tsx` to visual + interaction parity with `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` — a Pulse hero, a fixed `HERRAMIENTAS` 3-up row (Ritmo ring, Gasto hoy, Por resolver), a user-arrangeable `WIDGETS` row (Reciente, ¿Comprarlo?), and a centered `ORGANIZAR` pill.

**Architecture:**
- Extract webapp's dashboard layout primitives (size taxonomy, `packRows`, `SYSTEM_INSIGHTS`) to `@zeta/shared/dashboard-layout.ts` so both platforms import the same contract and the pure logic is unit-testable.
- Mobile widgets gain an `XS` size + row-packing to support the 3-up Herramientas row. `WidgetGrid` renders by packed rows instead of a fixed 2-col grid.
- Three new XS widget renderers for mobile (`ritmo`, `attention` → "Por resolver", `puedo_comprarlo`), reusing existing `RingChart` and `AnimatedAccordion` primitives.
- `InicioRoot` renders two grids separated by `SectionDivider`s, with `ORGANIZAR` moved below the arrangeable grid (matches webapp).

**Tech Stack:** React Native 0.83 + Expo 55 + NativeWind v4 (v3 classes) + @shopify/react-native-skia 2.4 + `@zeta/shared` workspace package + vitest 4 (shared tests only).

**Reference specs/sources:**
- Spec: `docs/superpowers/specs/2026-04-23-mobile-webapp-parity-pass-design.md`
- Canonical webapp impl: `webapp/src/components/mobile/v2/inicio/inicio-root.tsx` + `webapp/src/components/mobile/v2/inicio/widgets/*`
- Current mobile impl: `mobile/components/inicio/InicioRoot.tsx` + `mobile/components/inicio/widgets/*`
- Canonical widget catalog: `webapp/src/lib/dashboard/widgets.ts`
- Current mobile catalog: `mobile/lib/dashboard/widgets.ts`

---

### Task 1: Extract dashboard layout primitives into `@zeta/shared`

Move the pure layout logic (size taxonomy, row packing, system-insight identity) from the webapp file into the shared package. Webapp + mobile will re-export the types and helpers from there.

**Files:**
- Create: `packages/shared/src/utils/dashboard-layout.ts`
- Create: `packages/shared/src/utils/dashboard-layout.test.ts`
- Modify: `packages/shared/src/index.ts` (add export)

- [ ] **Step 1: Write failing tests for `packRows`**

Create `packages/shared/src/utils/dashboard-layout.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  packRows,
  rowKindFor,
  type WidgetInstance,
} from "./dashboard-layout";

const w = (id: string, size: "XS" | "S" | "M" | "L"): WidgetInstance => ({
  id,
  type: "recent",
  size,
});

describe("rowKindFor", () => {
  it("maps XS to xs", () => {
    expect(rowKindFor("XS")).toBe("xs");
  });
  it("maps S and M to s (shared 2-col row)", () => {
    expect(rowKindFor("S")).toBe("s");
    expect(rowKindFor("M")).toBe("s");
  });
  it("maps L to l", () => {
    expect(rowKindFor("L")).toBe("l");
  });
});

describe("packRows", () => {
  it("packs three XS widgets into a single row", () => {
    const rows = packRows([w("a", "XS"), w("b", "XS"), w("c", "XS")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(3);
  });

  it("packs two S widgets into a single row", () => {
    const rows = packRows([w("a", "S"), w("b", "S")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
  });

  it("opens a new row when kind changes", () => {
    const rows = packRows([w("a", "XS"), w("b", "S")]);
    expect(rows).toEqual([[w("a", "XS")], [w("b", "S")]]);
  });

  it("flushes when capacity reached", () => {
    const rows = packRows([w("a", "S"), w("b", "S"), w("c", "S")]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[1]).toHaveLength(1);
  });

  it("treats L as full row", () => {
    const rows = packRows([w("a", "L"), w("b", "S")]);
    expect(rows).toEqual([[w("a", "L")], [w("b", "S")]]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @zeta/shared exec vitest run src/utils/dashboard-layout.test.ts
```

Expected: FAIL — cannot resolve `./dashboard-layout`.

- [ ] **Step 3: Implement `packages/shared/src/utils/dashboard-layout.ts`**

```typescript
/**
 * Shared dashboard widget contract used by both the webapp mobile viewport
 * and the native mobile app. Pulse is always rendered first and is never
 * part of `DashboardLayout.widgets`.
 */

export type WidgetSize = "XS" | "S" | "M" | "L";

export type WidgetType =
  | "pulse"
  | "next_bill"
  | "next_income"
  | "accounts"
  | "where_today"
  | "recent"
  | "puedo_comprarlo"
  | "attention"
  | "import_strip"
  | "ritmo"
  | "goal"
  | "spending_by_category"
  | "cashflow_calendar"
  | "debt_progress"
  | "merchants_this_month"
  | "shared_with_partner";

export type WidgetInstance = {
  id: string;
  type: WidgetType;
  size: WidgetSize;
};

export type PulseRange = "weekly" | "monthly";

export type DashboardLayout = {
  pulseRange: PulseRange;
  widgets: WidgetInstance[];
};

/** Types that can legally live in the user-arrangeable widget zone. */
export const ARRANGEABLE_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "puedo_comprarlo",
  "recent",
]);

/** Types rendered by the fixed system-insights row (never arrangeable). */
export const SYSTEM_TYPES: ReadonlySet<WidgetType> = new Set<WidgetType>([
  "ritmo",
  "where_today",
  "attention",
]);

export const SYSTEM_INSIGHTS: WidgetInstance[] = [
  { id: "sys-ritmo", type: "ritmo", size: "XS" },
  { id: "sys-where-today", type: "where_today", size: "XS" },
  { id: "sys-attention", type: "attention", size: "XS" },
];

export const DEFAULT_LAYOUT: DashboardLayout = {
  pulseRange: "weekly",
  widgets: [
    { id: "puedo_comprarlo", type: "puedo_comprarlo", size: "S" },
    { id: "recent", type: "recent", size: "S" },
  ],
};

export type RowKind = "xs" | "s" | "l";

export function rowKindFor(size: WidgetSize): RowKind {
  if (size === "XS") return "xs";
  if (size === "L") return "l";
  return "s";
}

export const ROW_CAPACITY: Record<RowKind, number> = {
  xs: 3,
  s: 2,
  l: 1,
};

/**
 * Greedy row-packing. Widgets are placed in insertion order. A row's kind is
 * set by its first widget; subsequent widgets join if they match that kind
 * AND there is room; otherwise the row is flushed and a new row opens.
 */
export function packRows(widgets: WidgetInstance[]): WidgetInstance[][] {
  const rows: WidgetInstance[][] = [];
  let current: WidgetInstance[] = [];
  let kind: RowKind | null = null;

  const flush = () => {
    if (current.length > 0) {
      rows.push(current);
      current = [];
      kind = null;
    }
  };

  for (const widget of widgets) {
    const widgetKind = rowKindFor(widget.size);
    if (kind === null) {
      kind = widgetKind;
      current.push(widget);
    } else if (widgetKind === kind && current.length < ROW_CAPACITY[kind]) {
      current.push(widget);
    } else {
      flush();
      kind = widgetKind;
      current.push(widget);
    }
    if (current.length >= ROW_CAPACITY[widgetKind]) flush();
  }
  flush();
  return rows;
}
```

- [ ] **Step 4: Add barrel export in `packages/shared/src/index.ts`**

Append to the existing exports:

```typescript
export * from "./utils/dashboard-layout";
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @zeta/shared exec vitest run src/utils/dashboard-layout.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/dashboard-layout.ts packages/shared/src/utils/dashboard-layout.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): add dashboard-layout primitives with packRows"
```

---

### Task 2: Migrate webapp widgets.ts to re-export from `@zeta/shared`

Replace the canonical webapp file so both surfaces use the same source of truth. Behaviour is unchanged; this is a refactor.

**Files:**
- Modify: `webapp/src/lib/dashboard/widgets.ts` (reduce to re-export + CatalogEntry[])

- [ ] **Step 1: Rewrite `webapp/src/lib/dashboard/widgets.ts`**

Replace the whole file with:

```typescript
/**
 * Webapp mobile dashboard widget catalog. Pure layout primitives live in
 * `@zeta/shared/dashboard-layout`. This module only defines the catalog of
 * widgets the Add-widget sheet shows on the webapp.
 */

export {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  ROW_CAPACITY,
  SYSTEM_INSIGHTS,
  SYSTEM_TYPES,
  packRows,
  rowKindFor,
  type DashboardLayout,
  type PulseRange,
  type RowKind,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "@zeta/shared";

import type { WidgetSize, WidgetType } from "@zeta/shared";

export type CatalogEntry = {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  available: boolean;
};

export const WIDGET_CATALOG: CatalogEntry[] = [
  { type: "recent", label: "Movimientos recientes", description: "Tus últimas transacciones", defaultSize: "S", available: true },
  { type: "puedo_comprarlo", label: "¿Puedo comprarlo?", description: "Evalúa una compra contra el plan", defaultSize: "S", available: true },
  { type: "next_bill", label: "Próximo pago", description: "La siguiente obligación a pagar", defaultSize: "S", available: false },
  { type: "next_income", label: "Próximo ingreso", description: "Tu siguiente entrada de dinero", defaultSize: "S", available: false },
  { type: "accounts", label: "Cuentas", description: "Tus cuentas principales", defaultSize: "S", available: false },
  { type: "import_strip", label: "Recordatorio de importar", description: "Te avisa cuándo sincronizar extractos", defaultSize: "L", available: false },
  { type: "goal", label: "Meta de ahorro", description: "Progreso de tu objetivo", defaultSize: "S", available: false },
  { type: "spending_by_category", label: "Gasto por categoría", description: "Top categorías del mes", defaultSize: "M", available: false },
  { type: "cashflow_calendar", label: "Calendario de flujo", description: "Ingresos y pagos por día", defaultSize: "L", available: false },
  { type: "debt_progress", label: "Progreso de deudas", description: "Avance de payoff", defaultSize: "M", available: false },
  { type: "merchants_this_month", label: "Destinatarios del mes", description: "Top merchants", defaultSize: "M", available: false },
  { type: "shared_with_partner", label: "Compartido con pareja", description: "Gastos de pareja", defaultSize: "M", available: false },
];
```

- [ ] **Step 2: Verify webapp build**

```bash
cd webapp && pnpm build
```

Expected: build succeeds. All existing imports of `WIDGET_CATALOG` / `DEFAULT_LAYOUT` / `packRows` resolve via the re-export.

- [ ] **Step 3: Commit**

```bash
git add webapp/src/lib/dashboard/widgets.ts
git commit -m "refactor(webapp): re-export dashboard layout from @zeta/shared"
```

---

### Task 3: Align `mobile/lib/dashboard/widgets.ts` with the shared contract

Replace the mobile catalog so it re-exports the same primitives and adds its own catalog entries (system widgets live only in `SYSTEM_INSIGHTS`).

**Files:**
- Modify: `mobile/lib/dashboard/widgets.ts`
- Modify: `mobile/lib/dashboard/layout-storage.ts` (check for schema drift)

- [ ] **Step 1: Inspect current `layout-storage.ts` migration handling**

```bash
sed -n '1,80p' mobile/lib/dashboard/layout-storage.ts
```

Confirm it stores `{ pulseRange, widgets }` JSON. If it hard-codes old widget types (`accounts`, `next_bill`, `next_income`, `where_today`), keep the stored layout compatible by filtering unknown/non-arrangeable types at read time (same pattern as webapp's `normalizeLayout`).

- [ ] **Step 2: Rewrite `mobile/lib/dashboard/widgets.ts`**

Replace the whole file with:

```typescript
/**
 * Mobile dashboard widget catalog. Pure layout logic lives in
 * `@zeta/shared/dashboard-layout` so mobile and webapp share one contract.
 * System insights (ritmo / where_today / attention) render in the fixed
 * Herramientas row; only `ARRANGEABLE_TYPES` may live in the user zone.
 */

export {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  ROW_CAPACITY,
  SYSTEM_INSIGHTS,
  SYSTEM_TYPES,
  packRows,
  rowKindFor,
  type DashboardLayout,
  type PulseRange,
  type RowKind,
  type WidgetInstance,
  type WidgetSize,
  type WidgetType,
} from "@zeta/shared";

import type { WidgetSize, WidgetType } from "@zeta/shared";

export type CatalogEntry = {
  type: WidgetType;
  label: string;
  description: string;
  defaultSize: WidgetSize;
  available: boolean;
};

export const WIDGET_CATALOG: CatalogEntry[] = [
  { type: "recent", label: "Movimientos recientes", description: "Tus últimas transacciones", defaultSize: "S", available: true },
  { type: "puedo_comprarlo", label: "¿Puedo comprarlo?", description: "Evalúa una compra contra el plan", defaultSize: "S", available: true },
  { type: "next_bill", label: "Próximo pago", description: "La siguiente obligación a pagar", defaultSize: "S", available: false },
  { type: "next_income", label: "Próximo ingreso", description: "Tu siguiente entrada de dinero", defaultSize: "S", available: false },
  { type: "accounts", label: "Cuentas", description: "Tus cuentas principales", defaultSize: "S", available: false },
  { type: "goal", label: "Meta de ahorro", description: "Progreso de tu objetivo", defaultSize: "S", available: false },
  { type: "spending_by_category", label: "Gasto por categoría", description: "Top categorías del mes", defaultSize: "M", available: false },
  { type: "cashflow_calendar", label: "Calendario de flujo", description: "Ingresos y pagos por día", defaultSize: "L", available: false },
  { type: "debt_progress", label: "Progreso de deudas", description: "Avance de payoff", defaultSize: "M", available: false },
  { type: "merchants_this_month", label: "Destinatarios del mes", description: "Top merchants", defaultSize: "M", available: false },
  { type: "shared_with_partner", label: "Compartido con pareja", description: "Gastos de pareja", defaultSize: "M", available: false },
];
```

- [ ] **Step 3: Add `normalizeLayout` to `mobile/lib/dashboard/layout-storage.ts`**

Add this helper at module scope and use it in the read path so older stored layouts (which reference `accounts`, `next_bill`, `next_income`, `where_today`) are filtered on load:

```typescript
import {
  ARRANGEABLE_TYPES,
  DEFAULT_LAYOUT,
  type DashboardLayout,
  type WidgetInstance,
} from "@zeta/shared";

export function normalizeLayout(
  raw: Partial<DashboardLayout> | null | undefined,
): DashboardLayout {
  if (!raw) return DEFAULT_LAYOUT;
  const widgets = (raw.widgets ?? [])
    .filter((w): w is WidgetInstance => !!w && ARRANGEABLE_TYPES.has(w.type))
    .map((w) => ({ id: w.id, type: w.type, size: w.size }));
  if (widgets.length === 0) return DEFAULT_LAYOUT;
  return {
    pulseRange: raw.pulseRange ?? DEFAULT_LAYOUT.pulseRange,
    widgets,
  };
}
```

Wire the existing `loadDashboardLayout` to return `normalizeLayout(parsed)` before resolving.

- [ ] **Step 4: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors. If `InicioRoot.tsx` currently imports `where_today`/`accounts`/`next_bill`/`next_income` widget renderers from the old default layout, those renderers are still present — only the default catalog ordering changed. The RN screen compiles.

- [ ] **Step 5: Commit**

```bash
git add mobile/lib/dashboard/widgets.ts mobile/lib/dashboard/layout-storage.ts
git commit -m "refactor(mobile): align widget catalog with @zeta/shared + filter stale stored types"
```

---

### Task 4: Add `SectionDivider` primitive to mobile

**Files:**
- Create: `mobile/components/ui/SectionDivider.tsx`

- [ ] **Step 1: Create `mobile/components/ui/SectionDivider.tsx`**

```tsx
import { View, Text } from "react-native";

interface SectionDividerProps {
  label: string;
}

export function SectionDivider({ label }: SectionDividerProps) {
  return (
    <View className="flex-row items-center gap-2 px-0.5 py-1">
      <View className="h-px flex-1 bg-white/[0.06]" />
      <Text className="text-[9px] font-inter-semibold uppercase tracking-[4px] text-z-sage-dark">
        {label}
      </Text>
      <View className="h-px flex-1 bg-white/[0.06]" />
    </View>
  );
}
```

Note: NativeWind v3 does not support arbitrary-tracking `tracking-[0.18em]`; use the existing `tracking-[4px]` convention from `SECTION_EYEBROW_CLASS` in `mobile/lib/constants/styles.ts`.

- [ ] **Step 2: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ui/SectionDivider.tsx
git commit -m "feat(mobile): add SectionDivider primitive"
```

---

### Task 5: Teach `WidgetGrid` to render packed rows (XS/S/L)

Current `WidgetGrid` renders a 2-column flex grid. Update it to call `packRows` and render each row as a flex row whose child width depends on the row kind.

**Files:**
- Modify: `mobile/components/inicio/WidgetGrid.tsx`

- [ ] **Step 1: Read the current implementation**

```bash
sed -n '1,200p' mobile/components/inicio/WidgetGrid.tsx
```

Confirm the current prop shape: `{ widgets, activeId, onToggle, render, editing?, onRemove? }`.

- [ ] **Step 2: Update the render path to use `packRows`**

Replace the grid-rendering JSX with:

```tsx
import { packRows, rowKindFor, type WidgetInstance } from "@zeta/shared";

// ...inside the component, after layout computed:
const rows = packRows(widgets);

return (
  <View className="gap-2">
    {rows.map((row, rowIdx) => {
      const kind = rowKindFor(row[0].size);
      const flexBasisClass =
        kind === "xs"
          ? "flex-1"
          : kind === "s"
            ? "flex-1"
            : "w-full"; // l
      return (
        <View key={`row-${rowIdx}`} className="flex-row gap-2">
          {row.map((w) => (
            <View key={w.id} className={flexBasisClass}>
              {/* existing chip render */}
            </View>
          ))}
        </View>
      );
    })}
  </View>
);
```

Preserve the existing `activeId` / `onToggle` / `editing` / `onRemove` behavior by leaving each chip's existing wrapping logic intact — only the outer grid structure changes.

- [ ] **Step 3: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/inicio/WidgetGrid.tsx
git commit -m "feat(mobile): WidgetGrid packs XS/S/L rows per shared contract"
```

---

### Task 6: Port `ritmo` widget (XS) to mobile

**Files:**
- Create: `mobile/components/inicio/widgets/RitmoWidget.tsx`

- [ ] **Step 1: Create `mobile/components/inicio/widgets/RitmoWidget.tsx`**

Mirror `webapp/src/components/mobile/v2/inicio/widgets/ritmo-widget.tsx`. Reuse the existing `mobile/components/ui/RingChart.tsx` for the ring. Expanded `detail` panel shows average daily spend + `Ver plan completo` link (navigate via `useRouter().push("/plan")`).

```tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { RingChart } from "../../ui/RingChart";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import { formatCurrency } from "../../../lib/utils/currency";
import type { WidgetRender } from "../WidgetGrid";
import type { CurrencyCode } from "../../../lib/types";

interface RitmoWidgetProps {
  dayOfMonth: number;
  daysInMonth: number;
  dailyAverage: number | null;
  currency: CurrencyCode;
}

export function renderRitmoWidget(props: RitmoWidgetProps): WidgetRender {
  const { dayOfMonth, daysInMonth, dailyAverage, currency } = props;
  const percentage = Math.round((dayOfMonth / daysInMonth) * 100);

  return {
    tone: "brass",
    accessibilityLabel: `Ritmo: día ${dayOfMonth} de ${daysInMonth}`,
    chip: (
      <View className="h-full flex-col items-center gap-1">
        <ChipEyebrow tone="foreground">Ritmo</ChipEyebrow>
        <RingChart percentage={percentage} size={56} stroke={5} color={COLORS.income} label={`${percentage}%`} />
        <Text className="text-[10px] font-inter text-muted-foreground">
          día {dayOfMonth} de {daysInMonth}
        </Text>
      </View>
    ),
    detail: (
      <View className={`${PANEL_INSET_CLASS} p-3 gap-2`}>
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[11px] font-inter text-muted-foreground">Promedio diario</Text>
          <Text className="text-[11px] font-inter-semibold text-foreground">
            {dailyAverage !== null ? `${formatCurrency(dailyAverage, currency)}/día` : "—"}
          </Text>
        </View>
        <RitmoLink />
      </View>
    ),
  };
}

function RitmoLink() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/(tabs)/plan")}
      className="rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-2"
    >
      <Text className="text-center text-[11px] font-inter-semibold text-z-brass">
        Ver plan completo
      </Text>
    </Pressable>
  );
}
```

If `RingChart.tsx` does not support a `label` prop, extend its prop signature in this same task (center text rendered over the Skia ring).

- [ ] **Step 2: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/inicio/widgets/RitmoWidget.tsx mobile/components/ui/RingChart.tsx
git commit -m "feat(mobile): Ritmo XS widget with ring + daily average"
```

---

### Task 7: Port `attention` ("Por resolver") widget (XS) to mobile

**Files:**
- Create: `mobile/components/inicio/widgets/AttentionWidget.tsx`

- [ ] **Step 1: Create `mobile/components/inicio/widgets/AttentionWidget.tsx`**

```tsx
import { View, Text } from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { COLORS } from "../../../lib/constants/colors";
import type { WidgetRender } from "../WidgetGrid";

interface AttentionCounts {
  overdue: number;
  upcoming: number;
  pendingEmails: number;
}

export function renderAttentionWidget(props: AttentionCounts): WidgetRender {
  const { overdue, upcoming, pendingEmails } = props;
  const total = overdue + upcoming + pendingEmails;
  const tone: WidgetRender["tone"] =
    overdue > 0 ? "debt" : total > 0 ? "brass" : "foreground";

  return {
    tone,
    accessibilityLabel: total > 0 ? `Por resolver: ${total}` : "Sin pendientes",
    chip: (
      <View className="h-full flex-col items-center gap-1 text-center">
        <ChipEyebrow tone={overdue > 0 ? "debt" : "foreground"}>
          Por resolver
        </ChipEyebrow>
        {total === 0 ? (
          <View className="flex-1 flex-row items-center gap-1.5">
            <CheckCircle2 size={16} color={COLORS.income} />
            <Text className="text-[12px] font-inter-semibold text-foreground">
              Al día
            </Text>
          </View>
        ) : (
          <View className="flex-1 flex-row items-baseline gap-1.5">
            <Text className="text-[26px] font-inter-bold leading-none text-foreground">
              {total}
            </Text>
            <Text className="text-[10px] font-inter text-muted-foreground">
              {total === 1 ? "item" : "items"}
            </Text>
          </View>
        )}
        <Text numberOfLines={1} className="text-[10px] font-inter text-muted-foreground">
          {overdue > 0
            ? `${overdue} vencido${overdue === 1 ? "" : "s"}`
            : upcoming > 0
              ? `${upcoming} próximo${upcoming === 1 ? "" : "s"}`
              : pendingEmails > 0
                ? `${pendingEmails} correo${pendingEmails === 1 ? "" : "s"}`
                : "Sin pendientes"}
        </Text>
      </View>
    ),
    // Detail panel for slice 1: a simple summary strip. The full timeline is
    // deferred — mobile already has `mobile/app/categorizar.tsx` and
    // `mobile/app/recurrentes.tsx` as destinations.
    detail: null,
  };
}
```

- [ ] **Step 2: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/inicio/widgets/AttentionWidget.tsx
git commit -m "feat(mobile): Por resolver XS widget (attention counts)"
```

---

### Task 8: Adapt `WhereTodayWidget` to XS variant

The current `WhereTodayWidget.tsx` renders as an S-sized chip. Add an `XS` presentation branch for the Herramientas row.

**Files:**
- Modify: `mobile/components/inicio/widgets/WhereTodayWidget.tsx`

- [ ] **Step 1: Read current impl**

```bash
sed -n '1,120p' mobile/components/inicio/widgets/WhereTodayWidget.tsx
```

- [ ] **Step 2: Add XS layout**

Keep the existing exported `renderWhereTodayWidget(...)` signature but render the chip as a compact XS tile when called from `SYSTEM_INSIGHTS` context (the caller already passes `spentToday` + `currency`). The chip content should be:

```tsx
<View className="h-full flex-col items-center gap-1 text-center">
  <ChipEyebrow tone="foreground">Gasto de hoy</ChipEyebrow>
  <Text className="text-[22px] font-inter-bold leading-none text-foreground">
    {formatCurrency(spentToday, currency)}
  </Text>
  <Text numberOfLines={1} className="text-[10px] font-inter text-muted-foreground">
    {spentToday === 0 ? "Sin gastos hoy" : `Ayer ${formatCurrency(spentYesterday, currency)}`}
  </Text>
</View>
```

Leave the existing expanded `detail` panel (breakdown) untouched so the chip shrinks but the detail still tells the full story on expand.

- [ ] **Step 3: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add mobile/components/inicio/widgets/WhereTodayWidget.tsx
git commit -m "feat(mobile): WhereToday widget gains XS chip layout"
```

---

### Task 9: Port `puedo_comprarlo` widget (S) to mobile

**Files:**
- Create: `mobile/components/inicio/widgets/PuedoComprarloWidget.tsx`

- [ ] **Step 1: Create `mobile/components/inicio/widgets/PuedoComprarloWidget.tsx`**

```tsx
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowRight, Lightbulb } from "lucide-react-native";
import { ChipEyebrow } from "../../ui/ExpandableChip";
import { BRASS_BUTTON_CLASS, PANEL_INSET_CLASS } from "../../../lib/constants/styles";
import { COLORS } from "../../../lib/constants/colors";
import type { WidgetRender } from "../WidgetGrid";

export function renderPuedoComprarloWidget(): WidgetRender {
  return {
    tone: "brass",
    accessibilityLabel: "¿Puedo comprarlo? — evaluar una compra",
    chip: (
      <View className="h-full flex-col items-center gap-1 text-center">
        <ChipEyebrow tone="brass">¿Comprarlo?</ChipEyebrow>
        <View className="flex-1 items-center justify-center">
          <View className="size-10 items-center justify-center rounded-xl bg-z-brass-12">
            <Lightbulb size={20} color={COLORS.brass} />
          </View>
        </View>
        <Text className="text-[10px] font-inter text-muted-foreground">
          Evaluar
        </Text>
      </View>
    ),
    detail: <PuedoComprarloDetail />,
  };
}

function PuedoComprarloDetail() {
  const router = useRouter();
  return (
    <View className={`${PANEL_INSET_CLASS} p-3 gap-3`}>
      <View className="gap-1">
        <Text className="text-sm font-inter-semibold text-foreground">
          Decidí sin culpa
        </Text>
        <Text className="text-xs leading-relaxed font-inter text-muted-foreground">
          Cuéntale a Zeta qué quieres comprar y cuánto cuesta. Revisamos tu
          liquidez, pagos próximos y presupuesto para darte una respuesta
          honesta: sí, espera o no recomendado.
        </Text>
      </View>
      <Pressable
        onPress={() => router.push("/purchase-decision")}
        className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-xl px-4 py-2.5`}
      >
        <Text className="text-sm font-inter-semibold text-z-ink">
          Abrir analizador
        </Text>
        <ArrowRight size={16} color={COLORS.ink} />
      </Pressable>
    </View>
  );
}
```

Route destination is `/purchase-decision` — confirm by reading `mobile/app/purchase-decision.tsx` exists (it does, per backlog Afford slice-5). If the route is different, adjust the `router.push` string.

- [ ] **Step 2: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/inicio/widgets/PuedoComprarloWidget.tsx
git commit -m "feat(mobile): ¿Comprarlo? widget (navigates to analizador)"
```

---

### Task 10: Rewrite `InicioRoot` with SYSTEM_INSIGHTS + arrangeable grid + Organizar pill

**Files:**
- Modify: `mobile/components/inicio/InicioRoot.tsx`
- Modify: `mobile/lib/dashboard/useDashboardData.ts` (if it doesn't already expose `dayOfMonth`, `daysInMonth`, `spentYesterday`, attention counts)

- [ ] **Step 1: Audit `useDashboardData.ts` return shape**

```bash
sed -n '1,120p' mobile/lib/dashboard/useDashboardData.ts
```

Confirm the summary exposes:
- `dayOfMonth`, `daysInMonth` (for Ritmo) — if missing, compute inline from current date in the hook.
- `spentToday`, `spentYesterday`, `spentLast7`, `daysRemaining` (already used by Pulse).
- `attention`: `{ overdue: number; upcoming: number; pendingEmails: number }` — add it. Pull `overdue` from overdue occurrences count in the existing repo, `upcoming` from upcoming occurrences + upcoming incomes count, `pendingEmails` from email-ingest queue count.

If `attention` is missing, extend `useDashboardData` in this task to include it. Do not add a new server call — reuse existing repository reads already done during sync.

- [ ] **Step 2: Rewrite `mobile/components/inicio/InicioRoot.tsx`**

Replace the `return (...)` body with this structure (keep the top-of-file hooks and existing handlers unchanged):

```tsx
import { SectionDivider } from "../ui/SectionDivider";
import { SYSTEM_INSIGHTS, type WidgetInstance } from "@zeta/shared";
import { renderRitmoWidget } from "./widgets/RitmoWidget";
import { renderAttentionWidget } from "./widgets/AttentionWidget";
import { renderWhereTodayWidget } from "./widgets/WhereTodayWidget";
import { renderRecentWidget } from "./widgets/RecentWidget";
import { renderPuedoComprarloWidget } from "./widgets/PuedoComprarloWidget";
import { Settings2 } from "lucide-react-native";
import { GHOST_BUTTON_CLASS } from "../../lib/constants/styles";

// ...existing hooks...

const renderWidget = useCallback(
  (w: WidgetInstance): WidgetRender => {
    switch (w.type) {
      case "ritmo":
        return renderRitmoWidget({
          dayOfMonth: summary.dayOfMonth,
          daysInMonth: summary.daysInMonth,
          dailyAverage: summary.avgLast7 ?? null,
          currency: summary.currency,
        });
      case "attention":
        return renderAttentionWidget({
          overdue: summary.attention.overdue,
          upcoming: summary.attention.upcoming,
          pendingEmails: summary.attention.pendingEmails,
        });
      case "where_today":
        return renderWhereTodayWidget({
          spentToday: summary.spentToday,
          spentYesterday: summary.spentYesterday,
          currency: summary.currency,
          // keep existing expanded-detail props
          transactions: summary.transactions,
          today,
        });
      case "recent":
        return renderRecentWidget({ transactions: summary.transactions });
      case "puedo_comprarlo":
        return renderPuedoComprarloWidget();
      default:
        return UNKNOWN_RENDER;
    }
  },
  [summary, today]
);

return (
  <View className="flex-1 bg-background">
    <MobileHeader
      variant="main"
      title="Zeta"
      titleFont="narrator"
      subtitle={dateLabel}
      right={<AvatarMenuTrigger />}
    />

    <ScrollView
      className="flex-1"
      contentContainerStyle={{
        padding: 16,
        gap: 12,
        paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
      }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
      }
    >
      <PulseWidget
        availablePerDay={pulseValue}
        daysRemaining={pulseDays}
        currency={summary.currency}
        onTrack={summary.onTrack}
        range={layout.pulseRange}
        onRangeChange={handlePulseRangeChange}
        trend={pulseTrend}
      />

      <SectionDivider label="Herramientas" />
      <WidgetGrid
        widgets={SYSTEM_INSIGHTS}
        activeId={activeZone}
        onToggle={toggle}
        render={renderWidget}
      />

      <SectionDivider label="Widgets" />
      <WidgetGrid
        widgets={layout.widgets}
        activeId={editing ? null : activeZone}
        onToggle={toggle}
        render={renderWidget}
        editing={editing}
        onRemove={handleRemove}
      />

      {editing && (
        <Pressable
          onPress={() => setCatalogOpen(true)}
          accessibilityLabel="Añadir widget"
          className="mt-1 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-z-brass-30 bg-z-brass-8 py-3"
        >
          <Plus size={14} color={COLORS.brass} />
          <Text className="text-[12px] font-inter-semibold text-z-brass">Añadir widget</Text>
        </Pressable>
      )}

      <View className="pt-1 flex-row justify-center">
        <Pressable
          onPress={() => setEditing((v) => !v)}
          accessibilityLabel={editing ? "Terminar de organizar" : "Organizar widgets"}
          className={`${GHOST_BUTTON_CLASS} flex-row items-center gap-1.5 rounded-full px-3 py-1.5`}
        >
          <Settings2 size={12} color={editing ? COLORS.brass : COLORS.sageDark} />
          <Text className={`text-[10px] font-inter-semibold uppercase tracking-[4px] ${editing ? "text-z-brass" : "text-muted-foreground"}`}>
            {editing ? "Listo" : "Organizar"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>

    <AddWidgetSheet
      open={catalogOpen}
      onClose={() => setCatalogOpen(false)}
      onAdd={handleAdd}
      existingTypes={existingTypes}
    />
  </View>
);
```

Key changes:
- Drops the `Organizar` chip from `MobileHeader.action` (moved to a pill below the grid).
- Adds two `SectionDivider`s around the `SYSTEM_INSIGHTS` grid and the arrangeable grid.
- `SYSTEM_INSIGHTS` grid is never editable (`editing` flag not passed).

- [ ] **Step 2: Mobile typecheck**

```bash
cd mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run iOS simulator smoke test**

```bash
cd mobile && pnpm ios
```

Expected:
- Inicio screen renders: Pulse hero, `HERRAMIENTAS` divider, 3-up row (Ritmo ring / Gasto hoy / Por resolver), `WIDGETS` divider, 2-up row (Reciente / ¿Comprarlo?), `ORGANIZAR` ghost pill centered below.
- Tapping a Herramientas tile expands its detail panel inline.
- Tapping `ORGANIZAR` enters edit mode; add-widget sheet opens via `Añadir widget`.
- No content clipped under the notch (safe-area preserved by `MobileHeader`).

- [ ] **Step 4: Commit**

```bash
git add mobile/components/inicio/InicioRoot.tsx mobile/lib/dashboard/useDashboardData.ts
git commit -m "feat(mobile): InicioRoot mirrors webapp Herramientas + Widgets layout"
```

---

### Task 11: Gate pass + PR

**Files:** none (verification only)

- [ ] **Step 1: Full build gates**

```bash
pnpm install
pnpm build
pnpm --filter @zeta/shared test
cd mobile && npx tsc --noEmit
```

Expected: all green. If `pnpm install` modifies the lockfile, commit the lockfile changes on a separate commit before proceeding.

- [ ] **Step 2: Spawn review agents (foreground, in parallel)**

From the main conversation:

```
Agent → zetas-front-guy
Agent → frontend-auditor
Agent → mobile-webapp-parity
```

Each receives the branch diff + a prompt summarizing this slice. Apply blocking findings; park non-blocking in BACKLOG.md under a new "Mobile Inicio parity — follow-ups" entry.

- [ ] **Step 3: Open PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(mobile): Inicio parity — Herramientas + Widgets + Organizar" --body "$(cat <<'EOF'
## Summary
- Mobile `InicioRoot` mirrors webapp mobile viewport: Pulse hero, `HERRAMIENTAS` 3-up system row, `WIDGETS` arrangeable row, `ORGANIZAR` pill below.
- Dashboard layout primitives extracted to `@zeta/shared/dashboard-layout` with vitest coverage.
- Webapp and mobile widget catalogs now re-export the shared contract.

## Test plan
- [ ] `pnpm --filter @zeta/shared test` passes (packRows + rowKindFor).
- [ ] `pnpm build` passes.
- [ ] iOS simulator: Inicio shows Pulse → Herramientas row → Widgets row → Organizar pill.
- [ ] Tapping each Herramientas tile expands its detail.
- [ ] Organizar → edit mode → add widget sheet.
- [ ] No clipping under the iOS notch.
- [ ] zetas-front-guy, frontend-auditor, mobile-webapp-parity all PASS.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Update BACKLOG.md + memory**

Remove the "Mobile parity pass slice 1" from the upcoming-work list (if tracked) and append any new follow-ups surfaced by review agents. Update the `MEMORY.md` index if a new memory file was created during the slice.

---

## Self-review notes

- **Spec coverage:** Slice 1 scope (Pulse hero unchanged, Herramientas 3-up row with Ritmo/Gasto hoy/Por resolver, Widgets row with Reciente + ¿Comprarlo?, centered Organizar pill) is fully covered by Tasks 4–10. Shared primitive extraction (Tasks 1–3) is a prerequisite. Review gates + PR are Task 11.
- **Placeholder scan:** No TBDs. Every code block is complete. Route destinations (`/plan`, `/purchase-decision`) are explicit; Task 9 notes a fallback check.
- **Type consistency:** `WidgetInstance`, `WidgetSize`, `WidgetType`, `DashboardLayout`, `packRows`, `rowKindFor` are defined once in Task 1 and re-exported in Tasks 2–3. `WidgetRender` is the existing mobile type (unchanged). Widget renderer functions follow the `render<Type>Widget` convention used by the existing codebase.
- **No unrelated refactors:** `useDashboardData` is touched only to expose the `attention` counts + `dayOfMonth`/`daysInMonth` — the minimum needed by the new system widgets. No other hooks are modified.

---

## Follow-up (out of this slice)

- Slice 2 — Movimientos (separate plan).
- Slice 3 — Plan expandable hero (separate plan).
- Slices 4–6 — separate plans each.
- Any zetas-front-guy/frontend-auditor findings deferred to BACKLOG.md.
