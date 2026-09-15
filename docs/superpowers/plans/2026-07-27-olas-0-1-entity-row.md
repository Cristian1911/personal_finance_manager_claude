# Olas 0 y 1 — EntityRow y /accounts en filas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir la grilla de tarjetas de `/accounts` por filas expandibles reutilizables, y sacar el archivado de obligaciones saldadas del menú de overflow donde está enterrado.

**Architecture:** Una primitiva `<EntityRow>` en `src/components/ui/`, generalizada desde la fila de `/deudas`, con medidor y línea meta opcionales. La lógica de derivación (qué medidor, qué tono, qué acción primaria) vive en un módulo puro testeable aparte del componente. `/accounts` la consume mediante un adaptador que traduce `Account` a props de fila.

**Tech Stack:** Next.js 16.2.11 (App Router, RSC), React 19, TypeScript, Tailwind v4, Storybook 8, Vitest (solo node — sin jsdom), Playwright.

## Global Constraints

- **Idioma:** todas las cadenas visibles al usuario en español.
- **Gestor de paquetes:** `pnpm`. Build: `pnpm build:web`. Tests: `pnpm --dir webapp exec vitest run`.
- **Sin dependencias nuevas.** Si una tarea parece necesitar una, para y pregunta.
- **Las primitivas viven en `src/components/ui/`**, nunca en `src/components/mobile/v2/`. Ese árbol paralelo es el origen de la divergencia que este trabajo corrige.
- **`<EntityRow>` no hace fetching y no define acciones.** Las acciones van en `children`, decididas por cada pantalla.
- **Toda la fila expande.** La navegación es una acción explícita dentro de la expansión, nunca un segundo blanco táctil en la fila colapsada.
- **Cero elementos interactivos sin nombre accesible** en las pantallas tocadas.
- **No hay jsdom ni testing-library.** Vitest corre en entorno node. Los tests unitarios cubren funciones puras; el comportamiento de UI se cubre con Playwright (`webapp/e2e/`) y el contrato visual con stories de Storybook. **No escribas tests que rendericen componentes React con Vitest — no funcionarán.**
- **Regla de lint activa:** `react-hooks/set-state-in-effect` es error. Evita `setState` dentro de efectos; si es inevitable, la directiva `eslint-disable-next-line` debe ir en la línea inmediatamente anterior a la llamada, no antes del `useEffect` ni separada por más comentarios.

## Desviación deliberada respecto al spec

El spec pone cuatro primitivas en la ola 0: `EntityRow`, `FormShell`, `FieldSection` y `Field`. **Este plan solo construye `EntityRow`.**

Las tres de formulario no tienen consumidor hasta la ola 2. Construirlas ahora significa congelar su API contra un uso imaginado en vez de uno real, que es exactamente cómo se obtienen abstracciones equivocadas. Se construirán al abrir la ola 2, cuando `mobile-transaction-form.tsx` y `transaction-detail-client.tsx` dicten su forma.

Si prefieres las cuatro por adelantado, dilo y se amplía el plan.

## Estructura de archivos

**Nuevos**

| Archivo | Responsabilidad |
|---|---|
| `webapp/src/lib/utils/entity-row-model.ts` | Derivación pura: de una `Account` a medidor, tono, línea meta y acción primaria. Sin React. |
| `webapp/src/lib/utils/entity-row-model.test.ts` | Tests de lo anterior. |
| `webapp/src/components/ui/entity-row.tsx` | La primitiva: fila colapsada + expansión. Sin fetching, sin acciones propias. |
| `webapp/src/components/ui/entity-row.stories.tsx` | Contrato visual: las tres formas reales. |
| `webapp/src/components/accounts/account-entity-row.tsx` | Adaptador cliente: `Account` → `<EntityRow>`, con las acciones de `/accounts` en la expansión. |
| `webapp/e2e/accounts-rows.spec.ts` | E2E: expandir, navegar, archivar. |

**Modificados**

| Archivo | Cambio |
|---|---|
| `webapp/src/app/(dashboard)/accounts/page.tsx:220` | La grilla `grid gap-3 sm:grid-cols-2 …` pasa a lista de `<AccountEntityRow>`. |
| `webapp/src/components/accounts/accounts-section.tsx:55-60` | Misma sustitución en el bloque reutilizable. |
| `webapp/src/types/attention.ts:3` | Añadir `"cuentas"` a `AttentionPage`. |
| `webapp/src/actions/attention.ts` | Nueva señal `obligaciones-saldadas`. |

`AccountCard` **no se borra** en este plan: sigue en uso en otros sitios hasta que la ola 3 los migre. Se queda como está.

---

### Task 1: Modelo puro de la fila

**Files:**
- Create: `webapp/src/lib/utils/entity-row-model.ts`
- Test: `webapp/src/lib/utils/entity-row-model.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `deriveAccountRow(account, opts)` → `AccountRowModel`; los tipos `AccountRowModel`, `RowGauge`, `RowTone`. Las tareas 3 y 4 los consumen.

- [ ] **Step 1: Escribe el test que falla**

Crea `webapp/src/lib/utils/entity-row-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveAccountRow } from "./entity-row-model";

const base = {
  id: "a1",
  name: "Bancolombia Ahorros ****4398",
  account_type: "SAVINGS" as const,
  currency_code: "COP" as const,
  current_balance: 180296,
  credit_limit: null,
  monthly_payment: null,
  interest_rate: null,
  last_synced_at: null,
};

describe("deriveAccountRow", () => {
  it("una cuenta de ahorro no lleva medidor", () => {
    const row = deriveAccountRow(base, { today: "2026-07-27" });
    expect(row.gauge).toBeNull();
    expect(row.trailing.tone).toBe("neutral");
    expect(row.primaryAction).toBe("none");
  });

  it("una tarjeta usa el cupo como medidor y avisa a partir del 75%", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "CREDIT_CARD", current_balance: 5665822, credit_limit: 5400000 },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.label).toBe("uso");
    expect(Math.round(row.gauge!.pct)).toBe(105);
    expect(row.gauge?.tone).toBe("alert");
    expect(row.trailing.tone).toBe("debt");
  });

  it("una tarjeta por debajo del 75% usa el tono neutro de marca", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "CREDIT_CARD", current_balance: 1000000, credit_limit: 5400000 },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.tone).toBe("brass");
  });

  it("un préstamo mide lo pagado, no lo usado", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "LOAN",
        current_balance: 330339,
        credit_limit: 1000000,
        monthly_payment: 159477,
        interest_rate: 10.3,
      },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.label).toBe("pagado");
    expect(row.gauge?.tone).toBe("income");
    expect(row.meta).toEqual(["cuota $ 159.477", "10.3% EA"]);
  });

  it("una obligación en cero ofrece archivar en vez de abonar", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "LOAN", current_balance: 0, credit_limit: 1000000 },
      { today: "2026-07-27" },
    );
    expect(row.primaryAction).toBe("archive");
    expect(row.trailing.tone).toBe("income");
  });

  it("una obligación con saldo ofrece abonar", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "CREDIT_CARD", current_balance: 500, credit_limit: 1000 },
      { today: "2026-07-27" },
    );
    expect(row.primaryAction).toBe("abonar");
  });

  it("marca el saldo como desactualizado a partir de 10 días", () => {
    const row = deriveAccountRow(
      { ...base, last_synced_at: "2026-07-07T00:00:00Z" },
      { today: "2026-07-27" },
    );
    expect(row.meta).toEqual(["sin actualizar 20d"]);
  });

  it("sin cupo registrado, un préstamo no inventa medidor", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "LOAN", current_balance: 500000, credit_limit: null },
      { today: "2026-07-27" },
    );
    expect(row.gauge).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecútalo y comprueba que falla**

Run: `pnpm --dir webapp exec vitest run src/lib/utils/entity-row-model.test.ts`
Expected: FAIL — `Failed to resolve import "./entity-row-model"`.

- [ ] **Step 3: Implementa el módulo**

Crea `webapp/src/lib/utils/entity-row-model.ts`:

```ts
import { differenceInCalendarDays } from "date-fns";
import { formatCurrency } from "@/lib/utils/currency";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type { AccountType, CurrencyCode } from "@/types/domain";

/** Utilización de cupo a partir de la cual la fila pide atención. */
const UTILIZATION_ALERT_THRESHOLD = 0.75;
/** Días sin sincronizar antes de marcar el saldo como viejo. */
const STALE_BALANCE_DAYS = 10;

export type RowTone = "brass" | "alert" | "income";
export type TrailingTone = "debt" | "income" | "neutral";
/** Qué ofrece la expansión como acción principal. */
export type RowPrimaryAction = "none" | "abonar" | "archive";

export interface RowGauge {
  /** 0–100+. La barra recorta a 100 al pintar; el número puede pasarse. */
  pct: number;
  label: string;
  tone: RowTone;
}

export interface AccountRowModel {
  gauge: RowGauge | null;
  /** Partes que se unen con " · " bajo el título. */
  meta: string[];
  trailing: { value: string; caption: string; tone: TrailingTone };
  primaryAction: RowPrimaryAction;
}

/** Subconjunto de `Account` del que depende la derivación. */
export interface DerivableAccount {
  account_type: AccountType;
  currency_code: CurrencyCode;
  current_balance: number;
  credit_limit: number | null;
  monthly_payment?: number | null;
  interest_rate?: number | null;
  last_synced_at?: string | null;
}

/**
 * Traduce una cuenta a lo que la fila necesita pintar. Puro a propósito: la
 * decisión de qué medidor y qué acción mostrar es la parte con reglas, y
 * separarla del componente es lo que la hace testeable sin jsdom.
 *
 * `today` se inyecta en vez de leer el reloj — leerlo aquí lo haría no
 * determinista en tests, y en un componente rompería la hidratación.
 */
export function deriveAccountRow(
  account: DerivableAccount,
  opts: { today: string },
): AccountRowModel {
  const isDebt = isDebtAccountType(account.account_type);
  const isCreditCard = account.account_type === "CREDIT_CARD";
  const hasLimit = account.credit_limit != null && account.credit_limit > 0;

  let gauge: RowGauge | null = null;
  if (isDebt && hasLimit) {
    const limit = account.credit_limit as number;
    if (isCreditCard) {
      const pct = (account.current_balance / limit) * 100;
      gauge = {
        pct,
        label: "uso",
        tone: pct >= UTILIZATION_ALERT_THRESHOLD * 100 ? "alert" : "brass",
      };
    } else {
      const paid = Math.max(0, limit - account.current_balance);
      gauge = { pct: (paid / limit) * 100, label: "pagado", tone: "income" };
    }
  }

  const meta: string[] = [];
  if (account.monthly_payment != null && account.monthly_payment > 0) {
    meta.push(`cuota ${formatCurrency(account.monthly_payment, account.currency_code)}`);
  }
  if (account.interest_rate != null && account.interest_rate > 0) {
    meta.push(`${account.interest_rate.toFixed(1)}% EA`);
  }
  if (account.last_synced_at) {
    const days = differenceInCalendarDays(
      new Date(`${opts.today}T12:00:00`),
      new Date(account.last_synced_at),
    );
    if (days >= STALE_BALANCE_DAYS) meta.push(`sin actualizar ${days}d`);
  }

  const settled = isDebt && account.current_balance === 0;
  const trailingTone: TrailingTone = !isDebt
    ? "neutral"
    : settled
      ? "income"
      : "debt";

  return {
    gauge,
    meta,
    trailing: {
      value: formatCurrency(account.current_balance, account.currency_code),
      caption: isDebt ? (isCreditCard ? "usado" : "saldo") : "disponible",
      tone: trailingTone,
    },
    primaryAction: !isDebt ? "none" : settled ? "archive" : "abonar",
  };
}
```

- [ ] **Step 4: Ejecuta los tests y comprueba que pasan**

Run: `pnpm --dir webapp exec vitest run src/lib/utils/entity-row-model.test.ts`
Expected: PASS — 8 tests.

Si `meta` falla por el formato de moneda, imprime el valor real: `formatCurrency` usa `es-CO` con espacio duro (U+00A0) entre `$` y el número. Ajusta el literal esperado del test a lo que realmente produce, no al revés.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/entity-row-model.ts webapp/src/lib/utils/entity-row-model.test.ts
git commit -m "feat(ui): modelo puro de fila de entidad para cuentas"
```

---

### Task 2: La primitiva `<EntityRow>`

**Files:**
- Create: `webapp/src/components/ui/entity-row.tsx`
- Create: `webapp/src/components/ui/entity-row.stories.tsx`

**Interfaces:**
- Consumes: `RowGauge`, `RowTone` de `@/lib/utils/entity-row-model` (Task 1).
- Produces: `<EntityRow>` con `EntityRowProps`. La tarea 3 la consume.

- [ ] **Step 1: Crea el componente**

Crea `webapp/src/components/ui/entity-row.tsx`:

```tsx
"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RowGauge } from "@/lib/utils/entity-row-model";

/** Número de tics de la barra. Igual que la fila de /deudas, para que las dos
 *  pantallas se vean como la misma cosa cuando la ola 4 las unifique. */
const TICK_COUNT = 14;

const GAUGE_FILL: Record<RowGauge["tone"], string> = {
  brass: "bg-z-brass",
  alert: "bg-z-alert",
  income: "bg-z-income",
};

const TRAILING_COLOR = {
  debt: "text-z-debt",
  income: "text-z-income",
  neutral: "text-z-sage-light",
} as const;

function TickGauge({ gauge }: { gauge: RowGauge }) {
  const filled = Math.round((Math.min(100, gauge.pct) / 100) * TICK_COUNT);
  return (
    <div className="flex flex-1 items-center gap-0.5" aria-hidden>
      {Array.from({ length: TICK_COUNT }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 flex-1 rounded-[1.5px]",
            i < filled ? GAUGE_FILL[gauge.tone] : "bg-white/8",
          )}
        />
      ))}
    </div>
  );
}

export interface EntityRowProps {
  /** Insignia o avatar. La pantalla decide qué es. */
  leading: React.ReactNode;
  title: string;
  gauge?: RowGauge | null;
  /** Partes que se unen con " · ". */
  meta?: string[];
  trailing: {
    value: string;
    caption?: string;
    tone?: keyof typeof TRAILING_COLOR;
  };
  /** Contenido de la expansión. Sin esto la fila no expande. */
  children?: React.ReactNode;
  /** Abierto controlado. Omítelo para que la fila gestione el suyo. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Fila de entidad: colapsada muestra identidad + progreso + cifra; expandida
 * muestra lo que le pases. TODA la fila es el disparador — nada de un segundo
 * blanco táctil dentro de la fila colapsada.
 *
 * No hace fetching y no define acciones: eso vive en `children`, para que
 * /accounts pueda ofrecer "Archivar" donde /deudas ofrece "Abonar" sin que
 * esta primitiva sepa qué es una obligación.
 */
export function EntityRow({
  leading,
  title,
  gauge,
  meta,
  trailing,
  children,
  open,
  onOpenChange,
  className,
}: EntityRowProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const expandable = Boolean(children);

  function toggle() {
    const next = !isOpen;
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  const header = (
    <>
      <span className="shrink-0">{leading}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-semibold text-z-sage-light">
          {title}
        </span>
        {gauge && (
          <span className="mt-1.5 flex items-center gap-2">
            <TickGauge gauge={gauge} />
            <span
              className={cn(
                "shrink-0 text-[10px] font-bold tabular-nums",
                gauge.tone === "alert"
                  ? "text-z-alert"
                  : gauge.tone === "income"
                    ? "text-z-income"
                    : "text-z-brass",
              )}
            >
              {gauge.pct.toFixed(0)}%
            </span>
            <span className="shrink-0 text-[9px] text-muted-foreground">
              {gauge.label}
            </span>
          </span>
        )}
        {meta && meta.length > 0 && (
          <span className="mt-1 block truncate text-[10px] tabular-nums text-muted-foreground">
            {meta.join(" · ")}
          </span>
        )}
      </span>
      <span className="shrink-0 text-right">
        <span
          className={cn(
            "block text-sm font-bold tabular-nums",
            TRAILING_COLOR[trailing.tone ?? "neutral"],
          )}
        >
          {trailing.value}
        </span>
        {trailing.caption && (
          <span className="mt-0.5 block text-[9px] text-muted-foreground">
            {trailing.caption}
          </span>
        )}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "rounded-xl border border-white/6 bg-z-surface-2/60",
        isOpen && "border-z-brass/30",
        className,
      )}
    >
      {expandable ? (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          className="flex w-full items-center gap-3 p-3 text-left"
        >
          {header}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              isOpen && "rotate-180",
            )}
          />
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 p-3">{header}</div>
      )}

      {expandable && (
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out"
          style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="px-3 pb-3">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Crea las stories**

Crea `webapp/src/components/ui/entity-row.stories.tsx`:

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { EntityRow } from "./entity-row";

const meta: Meta<typeof EntityRow> = {
  title: "UI/EntityRow",
  component: EntityRow,
  tags: ["autodocs"],
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
export default meta;
type Story = StoryObj<typeof EntityRow>;

const Badge = ({ children }: { children: string }) => (
  <span className="flex size-9 items-center justify-center rounded-lg bg-z-brass/20 text-xs font-bold text-z-brass">
    {children}
  </span>
);

export const Ahorro: Story = {
  args: {
    leading: <Badge>B</Badge>,
    title: "Bancolombia Ahorros ****4398",
    meta: ["sin actualizar 20d"],
    trailing: { value: "$ 180.296", caption: "disponible", tone: "neutral" },
  },
};

export const TarjetaExcedida: Story = {
  args: {
    leading: <Badge>B</Badge>,
    title: "Bancolombia VISA ****7022",
    gauge: { pct: 105, label: "uso", tone: "alert" },
    meta: ["cuota $ 2.024.211", "28.8% EA"],
    trailing: { value: "$ 5.665.822", caption: "usado", tone: "debt" },
  },
};

export const Prestamo: Story = {
  args: {
    leading: <Badge>B</Badge>,
    title: "Bancolombia Préstamo ****2475",
    gauge: { pct: 67, label: "pagado", tone: "income" },
    meta: ["cuota $ 159.477", "10.3% EA"],
    trailing: { value: "$ 330.339", caption: "saldo", tone: "debt" },
  },
};

export const Expandible: Story = {
  args: {
    ...Prestamo.args,
    children: (
      <div className="rounded-lg border border-white/6 bg-black/20 p-3 text-sm text-muted-foreground">
        Aquí van las celdas de detalle y las acciones de la pantalla.
      </div>
    ),
  },
};

/** Las tres formas juntas — así se ve la densidad real de /accounts. */
export const Lista: Story = {
  render: () => (
    <div className="max-w-sm space-y-2">
      <EntityRow {...(Ahorro.args as never)} />
      <EntityRow {...(TarjetaExcedida.args as never)} />
      <EntityRow {...(Prestamo.args as never)} />
    </div>
  ),
};
```

- [ ] **Step 3: Comprueba que Storybook renderiza las cinco stories**

Run: `pnpm --dir webapp storybook`
Abre `http://localhost:6006` → `UI/EntityRow`.
Expected: las cinco stories renderizan. En `Lista`, cada fila colapsada mide **≤ 88px** — mídelo con el inspector. Si se pasa, reduce el padding antes de seguir; ese número es el criterio de aceptación de la ola 1.

Detén Storybook al terminar.

- [ ] **Step 4: Build y lint**

Run: `pnpm build:web`
Expected: `✓ Compiled successfully`.

Run: `pnpm --dir webapp lint 2>&1 | grep entity-row`
Expected: sin salida.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/ui/entity-row.tsx webapp/src/components/ui/entity-row.stories.tsx
git commit -m "feat(ui): primitiva EntityRow con stories de las tres formas reales"
```

---

### Task 3: Adaptador y sustitución de la grilla en /accounts

**Files:**
- Create: `webapp/src/components/accounts/account-entity-row.tsx`
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx:220-224`
- Modify: `webapp/src/components/accounts/accounts-section.tsx:55-60`

**Interfaces:**
- Consumes: `<EntityRow>` (Task 2), `deriveAccountRow` (Task 1).
- Produces: `<AccountEntityRow account={...} allAccounts={...} today={...} />`. La tarea 4 le añade la acción de archivar.

- [ ] **Step 1: Crea el adaptador**

Crea `webapp/src/components/accounts/account-entity-row.tsx`:

```tsx
"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EntityRow } from "@/components/ui/entity-row";
import { AccountIcon } from "@/components/accounts/account-icon";
import { DetailCell } from "@/components/mobile/v2/deudas/detail-cell";
import { deriveAccountRow } from "@/lib/utils/entity-row-model";
import { formatCurrency } from "@/lib/utils/currency";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

export function AccountEntityRow({
  account,
  today,
  open,
  onOpenChange,
}: {
  account: Account;
  /** Día actual en formato YYYY-MM-DD. Lo calcula el servidor: leer el reloj
   *  en el cliente durante el render rompe la hidratación. */
  today: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const model = deriveAccountRow(account, { today });

  return (
    <EntityRow
      leading={
        <AccountIcon
          bank_key={account.bank_key}
          account_type={account.account_type}
          color={account.color}
          size="md"
        />
      }
      title={account.name}
      gauge={model.gauge}
      meta={model.meta}
      trailing={model.trailing}
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <DetailCell
            label={model.trailing.caption}
            tone={model.trailing.tone === "neutral" ? undefined : model.trailing.tone}
          >
            {model.trailing.value}
          </DetailCell>
          <DetailCell label="Cupo">
            {account.credit_limit != null
              ? formatCurrency(account.credit_limit, account.currency_code)
              : "—"}
          </DetailCell>
        </div>
        <Link
          href={`/accounts/${account.id}`}
          className={cn(
            GHOST_BUTTON_CLASS,
            "flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm",
          )}
        >
          Ver detalle
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </EntityRow>
  );
}
```

- [ ] **Step 2: Sustituye la grilla en la página**

En `webapp/src/app/(dashboard)/accounts/page.tsx`, cambia el import de `AccountCard` por:

```tsx
import { AccountEntityRow } from "@/components/accounts/account-entity-row";
import { toColombiaDateString } from "@/lib/utils/date";
```

Justo después de `const accounts = result.success ? result.data : [];` añade:

```tsx
// El día se calcula en el servidor. Un componente cliente que lea el reloj
// durante el render muestrea instantes distintos en SSR e hidratación.
const today = toColombiaDateString(new Date());
```

Y sustituye el bloque de la grilla (`<div className="grid gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-3">…</div>`) por:

```tsx
<div className="space-y-2">
  {section.accounts.map((account) => (
    <AccountEntityRow key={account.id} account={account} today={today} />
  ))}
</div>
```

- [ ] **Step 3: Haz lo mismo en `accounts-section.tsx`**

`AccountsSection` es un componente cliente y **no puede** llamar a `new Date()` durante el render. Añade `today` como prop obligatoria:

```tsx
export function AccountsSection({
  hideDebt = false,
  today,
}: {
  hideDebt?: boolean;
  /** YYYY-MM-DD calculado en el servidor. */
  today: string;
}) {
```

Sustituye el bloque de la grilla por:

```tsx
<div className="space-y-2">
  {group.accounts.map((account) => (
    <AccountEntityRow key={account.id} account={account} today={today} />
  ))}
</div>
```

`AccountsSection` tiene exactamente **dos consumidores**, y los dos son Server Components, así que pueden calcular la fecha directamente:

- `webapp/src/app/(dashboard)/deudas/page.tsx:439` — hoy `<AccountsSection />`
- `webapp/src/app/(dashboard)/dashboard/page.tsx:244` — hoy `<AccountsSection allAccounts={allAccounts} />`

En cada uno añade `import { toColombiaDateString } from "@/lib/utils/date";` y pasa `today={toColombiaDateString(new Date())}`. **No** lo resuelvas con un efecto en el cliente.

Nota: `dashboard/page.tsx` pasa `allAccounts`, que no aparece en la firma actual de `AccountsSection`. Comprueba la firma real antes de editar y respeta lo que haya; si `allAccounts` sobra, déjalo como esté — limpiarlo no es parte de esta tarea.

- [ ] **Step 4: Verifica en navegador**

Run: `pnpm --dir webapp dev`
Abre `http://localhost:3000/accounts` con el viewport en 375×812.

Expected:
- Cada fila colapsada mide **≤ 88px** y se ven **al menos 6 cuentas** por pantalla (antes se veían 1,5).
- Tocar cualquier punto de la fila la expande; no hay un segundo destino táctil en la fila colapsada.
- "Ver detalle" navega a `/accounts/<id>`.
- Sin scroll horizontal.

Comprueba nombres accesibles en la consola del navegador:

```js
(()=>{const els=[...document.querySelectorAll('button,a,[role=button]')];
return els.filter(e=>!(e.getAttribute('aria-label')||e.textContent||'').trim()).length;})()
```

Expected: `0`.

- [ ] **Step 5: Gates y commit**

```bash
pnpm build:web
pnpm --dir webapp exec vitest run
git add webapp/src/components/accounts/account-entity-row.tsx "webapp/src/app/(dashboard)/accounts/page.tsx" webapp/src/components/accounts/accounts-section.tsx
git commit -m "feat(accounts): la lista de cuentas pasa de tarjetas a filas expandibles"
```

---

### Task 4: Archivar obligaciones saldadas desde la expansión

**Files:**
- Modify: `webapp/src/components/accounts/account-entity-row.tsx`

**Interfaces:**
- Consumes: `model.primaryAction` (Task 1), `archiveDebtObligation` de `@/actions/accounts`.
- Produces: nada nuevo.

`archiveDebtObligation(id)` ya existe en `webapp/src/actions/accounts.ts:295`. Pone saldo en 0, marca `is_active: false` y desactiva las plantillas recurrentes asociadas. **No la modifiques.**

- [ ] **Step 1: Añade el diálogo de confirmación a la expansión**

En `account-entity-row.tsx`, añade a los imports:

```tsx
import { useState, useTransition } from "react";
import { Archive } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { archiveDebtObligation } from "@/actions/accounts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
```

Dentro del componente, antes del `return`:

```tsx
const router = useRouter();
const [confirmOpen, setConfirmOpen] = useState(false);
const [pending, startTransition] = useTransition();

function handleArchive() {
  startTransition(async () => {
    const result = await archiveDebtObligation(account.id);
    if (result.success) {
      setConfirmOpen(false);
      // La acción revalida las etiquetas del servidor, pero esta página ya
      // está montada: sin refresh la fila archivada sigue en pantalla.
      router.refresh();
      toast.success(`${account.name} archivada`);
    } else {
      toast.error(result.error);
    }
  });
}
```

Dentro de la expansión, justo antes del enlace "Ver detalle":

```tsx
{model.primaryAction === "archive" && (
  <Button
    type="button"
    onClick={() => setConfirmOpen(true)}
    className={cn(BRASS_BUTTON_CLASS, "w-full")}
  >
    <Archive className="size-4" aria-hidden />
    Archivar (pagada)
  </Button>
)}
```

Y después del `</EntityRow>`, envuelto en un fragmento:

```tsx
<Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Archivar obligación</DialogTitle>
      <DialogDescription>
        {account.name} queda archivada y sus pagos recurrentes se desactivan.
        Podrás verla en las obligaciones cerradas de Deudas.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setConfirmOpen(false)}
        disabled={pending}
      >
        Cancelar
      </Button>
      <Button
        onClick={handleArchive}
        disabled={pending}
        className={BRASS_BUTTON_CLASS}
      >
        {pending ? "Archivando..." : "Archivar"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Recuerda cambiar el `return` para envolver `<EntityRow>` y `<Dialog>` en `<>…</>`.

- [ ] **Step 2: Verifica en navegador**

Run: `pnpm --dir webapp dev` → `http://localhost:3000/accounts`

Expected:
- Un préstamo con saldo `$ 0` expande y muestra **"Archivar (pagada)"** como acción principal, sin "Abonar".
- Una cuenta con saldo no muestra ese botón.
- Al confirmar: toast de éxito, la fila desaparece de la lista, y la obligación aparece en las cerradas de `/deudas`.

**Cuidado:** esto escribe en la base de datos real. Archiva **una sola** obligación en $0 como prueba y avisa al usuario de cuál fue.

- [ ] **Step 3: Gates y commit**

```bash
pnpm build:web
pnpm --dir webapp exec vitest run
git add webapp/src/components/accounts/account-entity-row.tsx
git commit -m "feat(accounts): archivar obligaciones saldadas desde la fila expandida"
```

---

### Task 5: Señal de atención para obligaciones saldadas

**Files:**
- Modify: `webapp/src/types/attention.ts:3`
- Modify: `webapp/src/actions/attention.ts`
- Modify: `webapp/src/app/(dashboard)/accounts/page.tsx`

**Interfaces:**
- Consumes: `AttentionSignal` existente.
- Produces: señal con `page: "cuentas"`, `key: "obligaciones-saldadas"`.

- [ ] **Step 1: Amplía el tipo**

En `webapp/src/types/attention.ts` línea 3:

```ts
export type AttentionPage =
  | "transactions"
  | "categories"
  | "destinatarios"
  | "recurrentes"
  | "pendientes"
  | "cuentas";
```

- [ ] **Step 2: Añade la consulta**

En `webapp/src/actions/attention.ts`, dentro del `Promise.all` existente (junto a las otras consultas de señales), añade:

```ts
// Signal: obligaciones activas con saldo cero. Archivar apaga sus plantillas
// recurrentes, así que el usuario debe confirmarlo — pero enterrado en el
// menú de overflow de /accounts/[id] costaba cinco pasos por obligación.
supabase
  .from("accounts")
  .select("id", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("is_active", true)
  .eq("current_balance", 0)
  .in("account_type", ["CREDIT_CARD", "LOAN"]),
```

Añade la variable correspondiente a la desestructuración del `Promise.all` (por ejemplo `saldadasRes`), respetando el orden.

- [ ] **Step 3: Emite la señal**

Junto a las demás señales:

```ts
const saldadasCount = saldadasRes.count ?? 0;
if (saldadasCount > 0) {
  signals.push({
    page: "cuentas",
    key: "obligaciones-saldadas",
    count: saldadasCount,
    label:
      saldadasCount === 1
        ? "1 obligación saldada sin archivar"
        : `${saldadasCount} obligaciones saldadas sin archivar`,
    priority: "action",
    actionHref: "/accounts?saldadas=1",
  });
}
```

- [ ] **Step 4: Haz que el parámetro expanda esas filas**

En `webapp/src/app/(dashboard)/accounts/page.tsx`, acepta `searchParams` y calcula qué filas nacen abiertas:

```tsx
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ saldadas?: string }>;
}) {
  await connection();
  const { saldadas } = await searchParams;
  // …
  const expandSettled = saldadas === "1";
```

Y en el render de cada fila:

```tsx
<AccountEntityRow
  key={account.id}
  account={account}
  today={today}
  defaultOpen={
    expandSettled &&
    isDebtAccountType(account.account_type) &&
    account.current_balance === 0
  }
/>
```

Para soportarlo, añade a `AccountEntityRow` la prop `defaultOpen?: boolean` y úsala como estado inicial cuando `open` no venga controlado:

```tsx
// en account-entity-row.tsx
export function AccountEntityRow({ account, today, defaultOpen = false, open, onOpenChange }: {
  account: Account;
  today: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [selfOpen, setSelfOpen] = useState(defaultOpen);
  const isControlled = open !== undefined;
  // …
      open={isControlled ? open : selfOpen}
      onOpenChange={isControlled ? onOpenChange : setSelfOpen}
```

- [ ] **Step 5: Verifica**

Run: `pnpm --dir webapp dev`

- `http://localhost:3000/dashboard` → la tarjeta de Atención lista "N obligaciones saldadas sin archivar" con "Resolver →".
- Pulsar "Resolver" lleva a `/accounts?saldadas=1` con **esas** filas ya expandidas y el botón de archivar a la vista.
- Sin el parámetro, todas las filas nacen colapsadas.

- [ ] **Step 6: Gates y commit**

```bash
pnpm build:web
pnpm --dir webapp exec vitest run
pnpm --dir webapp lint 2>&1 | tail -3
git add webapp/src/types/attention.ts webapp/src/actions/attention.ts "webapp/src/app/(dashboard)/accounts/page.tsx" webapp/src/components/accounts/account-entity-row.tsx
git commit -m "feat(attention): señal de obligaciones saldadas sin archivar"
```

---

### Task 6: E2E de la lista de cuentas

**Files:**
- Create: `webapp/e2e/accounts-rows.spec.ts`

**Interfaces:**
- Consumes: la UI de las tareas 3–5.
- Produces: nada.

Los specs existentes en `webapp/e2e/` usan `storageState: "e2e/.auth/user.json"`, generado por `auth.setup.ts`. No inventes otra autenticación.

- [ ] **Step 1: Escribe el spec**

Crea `webapp/e2e/accounts-rows.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 375, height: 812 } });

test.describe("/accounts en filas", () => {
  test("muestra al menos 6 cuentas sin scroll horizontal", async ({ page }) => {
    await page.goto("/accounts");
    const rows = page.locator('[aria-expanded]');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(6);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });

  test("una fila colapsada no pasa de 88px", async ({ page }) => {
    await page.goto("/accounts");
    const first = page.locator('[aria-expanded="false"]').first();
    const box = await first.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(88);
  });

  test("tocar la fila la expande y ofrece navegar al detalle", async ({ page }) => {
    await page.goto("/accounts");
    const first = page.locator('[aria-expanded="false"]').first();
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("link", { name: /ver detalle/i }).first()).toBeVisible();
  });

  test("todo elemento interactivo tiene nombre accesible", async ({ page }) => {
    await page.goto("/accounts");
    const unnamed = await page.evaluate(() => {
      const els = [...document.querySelectorAll("button,a,[role=button]")];
      return els.filter(
        (e) => !(e.getAttribute("aria-label") || e.textContent || "").trim(),
      ).length;
    });
    expect(unnamed).toBe(0);
  });
});
```

- [ ] **Step 2: Ejecútalo**

Run: `pnpm --dir webapp exec playwright test e2e/accounts-rows.spec.ts`
Expected: 4 passed.

Si falla la autenticación, ejecuta primero el proyecto de setup: `pnpm --dir webapp exec playwright test --project=setup`.

El test de las 6 cuentas depende de que la cuenta de prueba tenga al menos 6. Si tiene menos, baja el umbral y **anótalo en el propio test** con un comentario, en vez de dejarlo fallando.

- [ ] **Step 3: Commit**

```bash
git add webapp/e2e/accounts-rows.spec.ts
git commit -m "test(e2e): densidad, expansión y accesibilidad de la lista de cuentas"
```

---

## Cierre

- [ ] `pnpm build:web` limpio
- [ ] `pnpm --dir webapp exec vitest run` en verde
- [ ] `pnpm --dir webapp lint` sin errores nuevos frente a `main` (compara por archivo: el total incluye 72 preexistentes)
- [ ] Recorrido manual a 375px con captura antes/después
- [ ] Abrir PR contra `main`

**Lo que este plan no cubre:** escritorio (queda como deuda en el spec), las primitivas de formulario (ola 2), y `/destinatarios`, `/recurrentes`, `/suscripciones` (ola 3). `/deudas` se migra en la ola 4, deliberadamente al final.
