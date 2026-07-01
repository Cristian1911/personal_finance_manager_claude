# Modos (Filtro guardado + resumen) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir agrupar transacciones de un viaje/evento en un "Modo" (filtro `tags[] + rango` guardado con nombre) y ver un resumen, además de convertir el filtro de transacciones de un tag a multi-tag.

**Architecture:** Un Modo es una fila en la tabla `modos` que guarda `tag_ids uuid[]` + `date_from/date_to`. La membresía se deriva en tiempo de query (nunca se guarda por transacción): tx ∈ Modo si su fecha está en rango Y tiene al menos uno de los tags (OR). Una sola función resuelve los tx ids; todos los bloques del resumen se construyen sobre ese set. El filtro multi-tag reusa la misma semántica OR.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (Postgres + RLS), Zod, Vitest, Tailwind v4 + shadcn/ui.

## Global Constraints

- Package manager: **pnpm**. Comandos desde `webapp/`.
- UI en español (todo string visible al usuario).
- Server Actions: usar `getAuthenticatedClient()` de `@/lib/supabase/auth`; lecturas cacheadas con `createCachedClient(accessToken)` + `"use cache"` + `cacheTag(...)` + `cacheLife("zeta")`.
- Defense-in-depth: toda query filtra `.eq("user_id", user.id)` además de RLS.
- RLS pattern: `(select auth.uid()) = user_id`. Error de duplicado: `23505`.
- Zod errors: usar `.issues[0].message`.
- Regen types tras migración: `npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu` (verificar que el header `export type Json =` quede intacto).
- Verification gates antes de dar por hecho: `pnpm build` limpio.

---

### Task 1: Migración — tabla `modos` + RLS

**Files:**
- Create: `webapp/supabase/migrations/<timestamp>_create_modos.sql`
- Modify: `webapp/src/types/database.ts` (regenerado)

**Interfaces:**
- Produces: tabla `modos(id, user_id, name, color, emoji, date_from, date_to, tag_ids uuid[], created_at)`; tipo generado `Tables<"modos">`.

- [ ] **Step 1: Crear la migración**

Run: `cd webapp && npx supabase migration new create_modos`

Contenido del archivo generado:

```sql
create table public.modos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  emoji text,
  date_from date not null,
  date_to date not null,
  tag_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.modos enable row level security;

create policy "modos_select_own" on public.modos
  for select using ((select auth.uid()) = user_id);
create policy "modos_insert_own" on public.modos
  for insert with check ((select auth.uid()) = user_id);
create policy "modos_update_own" on public.modos
  for update using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "modos_delete_own" on public.modos
  for delete using ((select auth.uid()) = user_id);

create index modos_user_id_idx on public.modos (user_id);
```

- [ ] **Step 2: Aplicar la migración**

Run: `cd webapp && npx supabase db push`
Expected: aplica sin error.

- [ ] **Step 3: Regenerar tipos**

Run: `cd webapp && npx supabase gen types --lang=typescript --project-id tgkhaxipfgskxydotdtu > src/types/database.ts`
Expected: `src/types/database.ts` contiene `modos:` en `Tables` y el header `export type Json =` intacto (verificar la primera línea de contenido).

- [ ] **Step 4: Verificar build de tipos**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/supabase/migrations webapp/src/types/database.ts
git commit -m "feat(modos): migración tabla modos + RLS"
```

---

### Task 2: Validadores y tipos de dominio

**Files:**
- Create: `webapp/src/lib/validators/modo.ts`
- Create: `webapp/src/lib/validators/__tests__/modo.test.ts`
- Modify: `webapp/src/types/domain.ts` (agregar `export type Modo = Tables<"modos">;`)
- Modify: `webapp/src/lib/validators/transaction.ts:82` (`tagId` → `tags` CSV)

**Interfaces:**
- Produces: `modoSchema` (Zod) con `{ name, color?, emoji?, date_from, date_to, tag_ids: string[] }`; helper `parseTagsParam(csv?: string): string[]`; tipo `Modo`.
- Consumes: `uuidStr` ya existe en `validators/transaction.ts`.

- [ ] **Step 1: Escribir el test que falla**

`webapp/src/lib/validators/__tests__/modo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { modoSchema, parseTagsParam } from "@/lib/validators/modo";

describe("modoSchema", () => {
  const base = {
    name: "Cartagena",
    date_from: "2026-07-01",
    date_to: "2026-07-05",
    tag_ids: ["00000000-0000-0000-0000-0000000000a1"],
  };

  it("acepta un modo válido", () => {
    expect(modoSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(modoSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rechaza date_to anterior a date_from", () => {
    const r = modoSchema.safeParse({ ...base, date_from: "2026-07-05", date_to: "2026-07-01" });
    expect(r.success).toBe(false);
  });

  it("acepta tag_ids vacío", () => {
    expect(modoSchema.safeParse({ ...base, tag_ids: [] }).success).toBe(true);
  });
});

describe("parseTagsParam", () => {
  it("parsea CSV a array", () => {
    expect(parseTagsParam("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("devuelve [] para undefined o vacío", () => {
    expect(parseTagsParam(undefined)).toEqual([]);
    expect(parseTagsParam("")).toEqual([]);
  });
  it("descarta segmentos vacíos", () => {
    expect(parseTagsParam("a,,b,")).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd webapp && pnpm vitest run src/lib/validators/__tests__/modo.test.ts`
Expected: FAIL ("Cannot find module '@/lib/validators/modo'").

- [ ] **Step 3: Implementar el validador**

`webapp/src/lib/validators/modo.ts`:

```ts
import { z } from "zod";

const uuidStr = z.string().uuid();
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const modoSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    color: z.string().max(32).optional().nullable(),
    emoji: z.string().max(8).optional().nullable(),
    date_from: dateStr,
    date_to: dateStr,
    tag_ids: z.array(uuidStr).default([]),
  })
  .refine((d) => d.date_from <= d.date_to, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["date_to"],
  });

export type ModoInput = z.infer<typeof modoSchema>;

export function parseTagsParam(csv?: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd webapp && pnpm vitest run src/lib/validators/__tests__/modo.test.ts`
Expected: PASS.

- [ ] **Step 5: Agregar tipo de dominio y migrar el filtro a multi-tag param**

En `webapp/src/types/domain.ts`, junto a los otros alias `Tables<...>`, agregar:

```ts
export type Modo = Tables<"modos">;
```

En `webapp/src/lib/validators/transaction.ts`, reemplazar la línea 82 (`tagId: uuidStr().optional(),`) por:

```ts
  tags: z.string().optional(), // CSV de uuids, OR
```

- [ ] **Step 6: Verificar build**

Run: `cd webapp && pnpm build`
Expected: PASS (todavía pueden quedar refs a `params.tagId`; se corrigen en Task 3 — si el build falla solo por eso, continuar a Task 3 antes de commitear).

- [ ] **Step 7: Commit**

```bash
git add webapp/src/lib/validators/modo.ts webapp/src/lib/validators/__tests__/modo.test.ts webapp/src/types/domain.ts webapp/src/lib/validators/transaction.ts
git commit -m "feat(modos): validador de modo + param multi-tag"
```

---

### Task 3: Filtro multi-tag (server + UI)

**Files:**
- Modify: `webapp/src/actions/transactions.ts` (firma de `getTransactionsCached`, prefetch, y el caller `getTransactions`)
- Modify: `webapp/src/components/transactions/transaction-filters.tsx`
- Create: `webapp/src/lib/utils/__tests__/tag-ids.test.ts`
- Create: `webapp/src/lib/utils/tag-ids.ts`

**Interfaces:**
- Consumes: `parseTagsParam` (Task 2).
- Produces: `dedupeTransactionIds(rows: { transaction_id: string }[]): string[]`; `getTransactionsCached(..., tagIds: string[] | undefined)`.

- [ ] **Step 1: Escribir el test del helper puro**

`webapp/src/lib/utils/__tests__/tag-ids.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";

describe("dedupeTransactionIds", () => {
  it("deduplica (semántica OR: una tx con varios tags aparece una vez)", () => {
    const rows = [
      { transaction_id: "tx1" },
      { transaction_id: "tx2" },
      { transaction_id: "tx1" },
    ];
    expect(dedupeTransactionIds(rows).sort()).toEqual(["tx1", "tx2"]);
  });
  it("devuelve [] para input vacío", () => {
    expect(dedupeTransactionIds([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/tag-ids.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar el helper**

`webapp/src/lib/utils/tag-ids.ts`:

```ts
export function dedupeTransactionIds(
  rows: { transaction_id: string }[],
): string[] {
  return [...new Set(rows.map((r) => r.transaction_id))];
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/tag-ids.test.ts`
Expected: PASS.

- [ ] **Step 5: Cambiar el prefetch a multi-tag en `transactions.ts`**

En `webapp/src/actions/transactions.ts`, cambiar el parámetro `tagId: string | undefined,` (línea ~444) por `tagIds: string[] | undefined,`.

Reemplazar el bloque de prefetch (líneas ~454-467) por:

```ts
  // Tag filter (OR): pre-fetch matching transaction IDs
  let taggedTransactionIds: string[] | null = null;
  if (tagIds && tagIds.length > 0) {
    const { data: taggedIds } = await supabase
      .from("transaction_tags")
      .select("transaction_id")
      .in("tag_id", tagIds);

    if (taggedIds && taggedIds.length > 0) {
      taggedTransactionIds = dedupeTransactionIds(taggedIds);
    } else {
      return { data: [], count: 0, page, pageSize, totalPages: 0 };
    }
  }
```

Agregar el import al inicio del archivo:

```ts
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
```

En el caller `getTransactions` (línea ~543), reemplazar `params.tagId,` por:

```ts
      params.tags ? params.tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
```

- [ ] **Step 6: Convertir el selector de tag a multi-select en la UI**

En `webapp/src/components/transactions/transaction-filters.tsx`, el filtro hoy usa searchParams `tagId` con un `<Select>` single (líneas ~196-208). Reemplazar ese `<Select>` por un multi-select basado en toggles que escribe el param `tags` como CSV. Estructura:

```tsx
{tags.length > 0 && (
  <div className="flex flex-wrap gap-1.5">
    {tags.map((tag) => {
      const selected = (searchParams.get("tags") ?? "")
        .split(",").filter(Boolean).includes(tag.id);
      return (
        <button
          key={tag.id}
          type="button"
          onClick={() => {
            const current = (searchParams.get("tags") ?? "")
              .split(",").filter(Boolean);
            const next = selected
              ? current.filter((id) => id !== tag.id)
              : [...current, tag.id];
            updateFilter("tags", next.length ? next.join(",") : null);
          }}
          className={selected
            ? "rounded-full border px-2.5 py-1 text-xs bg-primary text-primary-foreground"
            : "rounded-full border px-2.5 py-1 text-xs text-muted-foreground"}
        >
          {tag.name}
        </button>
      );
    })}
  </div>
)}
```

Ajustar las referencias a `searchParams.get("tagId")` (líneas ~66 y ~80, usadas para el badge "hay filtros activos") para que lean `searchParams.get("tags")`. `updateFilter` ya acepta `null` para limpiar el param (verificar su firma en el mismo archivo y mantenerla).

- [ ] **Step 7: Verificar build + tests**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/tag-ids.test.ts && pnpm build`
Expected: PASS. Grep de sanidad: `grep -rn "params.tagId\|\"tagId\"\|'tagId'" src/` no debe devolver referencias vivas del filtro de transacciones.

- [ ] **Step 8: Commit**

```bash
git add webapp/src/actions/transactions.ts webapp/src/components/transactions/transaction-filters.tsx webapp/src/lib/utils/tag-ids.ts webapp/src/lib/utils/__tests__/tag-ids.test.ts
git commit -m "feat(modos): filtro multi-tag (OR) en transacciones"
```

---

### Task 4: Helpers puros del resumen del Modo

**Files:**
- Create: `webapp/src/lib/utils/modo-summary.ts`
- Create: `webapp/src/lib/utils/__tests__/modo-summary.test.ts`

**Interfaces:**
- Consumes: tipo `SharedPaymentGroup` de `@/types/domain`.
- Produces:
  - `type ModoTxRow = { id: string; amount: number | null; direction: "INFLOW" | "OUTFLOW"; transaction_date: string; category: { id: string; name_es: string | null; name: string; color: string | null } | null }`
  - `type CategoryBucket = { categoryId: string | null; name: string; color: string | null; total: number; count: number }`
  - `type ModoSummary = { total: number; count: number; observedFrom: string | null; observedTo: string | null; byCategory: CategoryBucket[] }`
  - `summarizeModo(txs: ModoTxRow[]): ModoSummary` — solo cuenta OUTFLOW para `total`/`byCategory`.
  - `filterSharedGroupsByOrigin(groups: SharedPaymentGroup[], txIds: string[]): SharedPaymentGroup[]`

- [ ] **Step 1: Escribir el test que falla**

`webapp/src/lib/utils/__tests__/modo-summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeModo, filterSharedGroupsByOrigin } from "@/lib/utils/modo-summary";
import type { ModoTxRow } from "@/lib/utils/modo-summary";

const cat = (id: string, name: string) => ({ id, name, name_es: name, color: "#fff" });

const txs: ModoTxRow[] = [
  { id: "t1", amount: 100, direction: "OUTFLOW", transaction_date: "2026-07-02", category: cat("c1", "Comida") },
  { id: "t2", amount: 50, direction: "OUTFLOW", transaction_date: "2026-07-01", category: cat("c1", "Comida") },
  { id: "t3", amount: 200, direction: "OUTFLOW", transaction_date: "2026-07-04", category: cat("c2", "Hotel") },
  { id: "t4", amount: 999, direction: "INFLOW", transaction_date: "2026-07-03", category: null },
];

describe("summarizeModo", () => {
  it("suma solo OUTFLOW y cuenta esas tx", () => {
    const s = summarizeModo(txs);
    expect(s.total).toBe(350);
    expect(s.count).toBe(3);
  });
  it("calcula rango observado (min/max) sobre OUTFLOW", () => {
    const s = summarizeModo(txs);
    expect(s.observedFrom).toBe("2026-07-01");
    expect(s.observedTo).toBe("2026-07-04");
  });
  it("agrupa por categoría ordenado desc por total", () => {
    const s = summarizeModo(txs);
    expect(s.byCategory.map((b) => [b.name, b.total])).toEqual([
      ["Hotel", 200],
      ["Comida", 150],
    ]);
  });
  it("maneja lista vacía", () => {
    const s = summarizeModo([]);
    expect(s).toEqual({ total: 0, count: 0, observedFrom: null, observedTo: null, byCategory: [] });
  });
});

describe("filterSharedGroupsByOrigin", () => {
  it("mantiene solo grupos cuyo origin_transaction_id está en el set", () => {
    const groups = [
      { split_group_id: "g1", debts: [{ origin_transaction_id: "t1" }] },
      { split_group_id: "g2", debts: [{ origin_transaction_id: "tX" }] },
    ] as unknown as import("@/types/domain").SharedPaymentGroup[];
    const out = filterSharedGroupsByOrigin(groups, ["t1", "t2"]);
    expect(out.map((g) => g.split_group_id)).toEqual(["g1"]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/modo-summary.test.ts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar los helpers**

`webapp/src/lib/utils/modo-summary.ts`:

```ts
import type { SharedPaymentGroup } from "@/types/domain";

export type ModoTxRow = {
  id: string;
  amount: number | null;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  category: { id: string; name_es: string | null; name: string; color: string | null } | null;
};

export type CategoryBucket = {
  categoryId: string | null;
  name: string;
  color: string | null;
  total: number;
  count: number;
};

export type ModoSummary = {
  total: number;
  count: number;
  observedFrom: string | null;
  observedTo: string | null;
  byCategory: CategoryBucket[];
};

export function summarizeModo(txs: ModoTxRow[]): ModoSummary {
  const outflows = txs.filter((t) => t.direction === "OUTFLOW");
  const total = outflows.reduce((s, t) => s + (t.amount ?? 0), 0);
  const dates = outflows.map((t) => t.transaction_date).sort();
  const buckets = new Map<string, CategoryBucket>();
  for (const t of outflows) {
    const key = t.category?.id ?? "__uncategorized__";
    const name = t.category?.name_es ?? t.category?.name ?? "Sin categoría";
    const existing = buckets.get(key);
    if (existing) {
      existing.total += t.amount ?? 0;
      existing.count += 1;
    } else {
      buckets.set(key, {
        categoryId: t.category?.id ?? null,
        name,
        color: t.category?.color ?? null,
        total: t.amount ?? 0,
        count: 1,
      });
    }
  }
  const byCategory = [...buckets.values()].sort((a, b) => b.total - a.total);
  return {
    total,
    count: outflows.length,
    observedFrom: dates[0] ?? null,
    observedTo: dates[dates.length - 1] ?? null,
    byCategory,
  };
}

export function filterSharedGroupsByOrigin(
  groups: SharedPaymentGroup[],
  txIds: string[],
): SharedPaymentGroup[] {
  const set = new Set(txIds);
  return groups.filter((g) =>
    g.debts.some((d) => d.origin_transaction_id != null && set.has(d.origin_transaction_id)),
  );
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd webapp && pnpm vitest run src/lib/utils/__tests__/modo-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/lib/utils/modo-summary.ts webapp/src/lib/utils/__tests__/modo-summary.test.ts
git commit -m "feat(modos): helpers puros de resumen (total/categoría/shared)"
```

---

### Task 5: Actions de Modos (CRUD + resumen)

**Files:**
- Create: `webapp/src/actions/modos.ts`
- Create: `webapp/src/actions/__tests__/modos-summary.test.ts`

**Interfaces:**
- Consumes: `getAuthenticatedClient`, `createCachedClient`, `modoSchema`, `dedupeTransactionIds`, `summarizeModo`, `filterSharedGroupsByOrigin`, `getSharedPaymentGroups`, tipo `Modo`, `SharedPaymentGroup`.
- Produces:
  - `listModos(): Promise<ActionResult<Modo[]>>`
  - `getModo(id: string): Promise<ActionResult<Modo>>`
  - `createModo(formData: FormData): Promise<ActionResult<{ id: string }>>`
  - `updateModo(id: string, formData: FormData): Promise<ActionResult<null>>`
  - `deleteModo(id: string): Promise<ActionResult<null>>`
  - `getModoTransactionIds(modo: Pick<Modo, "date_from" | "date_to" | "tag_ids">, userId: string, accessToken: string): Promise<string[]>`
  - `getModoSummary(id: string): Promise<ActionResult<{ modo: Modo; summary: ModoSummary; sharedGroups: SharedPaymentGroup[]; transactions: ModoTxRow[] }>>`

- [ ] **Step 1: Escribir el test de membresía (supabase mockeado)**

`webapp/src/actions/__tests__/modos-summary.test.ts` — sigue el estilo de `create-recurring-from-transaction.test.ts` (mock con `vi.hoisted`). Verifica que `getModoTransactionIds` intersecta rango de fechas Y tags (OR):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthenticatedClient } = vi.hoisted(() => ({ getAuthenticatedClient: vi.fn() }));
const createCachedClient = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/lib/supabase/cached", () => ({ createCachedClient }));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateFinancialViews: vi.fn() }));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(), revalidateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(), unstable_cacheLife: vi.fn(),
}));

import { getModoTransactionIds } from "@/actions/modos";

// Query builder mock: transaction_tags(.in tag) -> rows; transactions(.in id .gte .lte) -> rows
function makeClient() {
  return {
    from(table: string) {
      if (table === "transaction_tags") {
        return {
          select: () => ({
            in: () => Promise.resolve({
              data: [
                { transaction_id: "t1" }, { transaction_id: "t2" }, { transaction_id: "t1" },
              ],
            }),
          }),
        };
      }
      // transactions: only t1 falls inside [2026-07-01, 2026-07-05]
      return {
        select: () => ({
          eq: () => ({
            in: () => ({
              gte: () => ({
                lte: () => Promise.resolve({ data: [{ id: "t1" }] }),
              }),
            }),
          }),
        }),
      };
    },
  };
}

beforeEach(() => {
  createCachedClient.mockReturnValue(makeClient());
});

describe("getModoTransactionIds", () => {
  it("intersecta tags (OR, deduplicado) con el rango de fechas", async () => {
    const ids = await getModoTransactionIds(
      { date_from: "2026-07-01", date_to: "2026-07-05", tag_ids: ["tagA", "tagB"] },
      "user-1",
      "token",
    );
    expect(ids).toEqual(["t1"]);
  });

  it("devuelve [] si el modo no tiene tags", async () => {
    const ids = await getModoTransactionIds(
      { date_from: "2026-07-01", date_to: "2026-07-05", tag_ids: [] },
      "user-1",
      "token",
    );
    expect(ids).toEqual([]);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `cd webapp && pnpm vitest run src/actions/__tests__/modos-summary.test.ts`
Expected: FAIL ("Cannot find module '@/actions/modos'").

- [ ] **Step 3: Implementar las actions**

`webapp/src/actions/modos.ts`:

```ts
"use server";

import { cacheTag, cacheLife, updateTag as expireTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { modoSchema } from "@/lib/validators/modo";
import { dedupeTransactionIds } from "@/lib/utils/tag-ids";
import {
  summarizeModo,
  filterSharedGroupsByOrigin,
  type ModoTxRow,
  type ModoSummary,
} from "@/lib/utils/modo-summary";
import { getSharedPaymentGroups } from "@/actions/shared-payments";
import type { ActionResult } from "@/types/actions";
import type { Modo, SharedPaymentGroup } from "@/types/domain";

const MODO_TX_SELECT =
  "id, amount, direction, transaction_date, category:categories!transactions_category_id_fkey(id, name, name_es, color)";

// ── Membership (single source of truth) ──────────────────
export async function getModoTransactionIds(
  modo: Pick<Modo, "date_from" | "date_to" | "tag_ids">,
  userId: string,
  accessToken: string,
): Promise<string[]> {
  if (!modo.tag_ids || modo.tag_ids.length === 0) return [];
  const supabase = createCachedClient(accessToken);

  const { data: tagged } = await supabase
    .from("transaction_tags")
    .select("transaction_id")
    .in("tag_id", modo.tag_ids);
  const candidateIds = dedupeTransactionIds(tagged ?? []);
  if (candidateIds.length === 0) return [];

  const { data: rows } = await supabase
    .from("transactions")
    .select("id")
    .eq("user_id", userId)
    .in("id", candidateIds)
    .gte("transaction_date", modo.date_from)
    .lte("transaction_date", modo.date_to);
  return (rows ?? []).map((r) => r.id);
}

// ── Reads ────────────────────────────────────────────────
async function listModosCached(userId: string, accessToken: string): Promise<Modo[]> {
  "use cache";
  cacheTag("modos");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("modos")
    .select("*")
    .eq("user_id", userId)
    .order("date_from", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function listModos(): Promise<ActionResult<Modo[]>> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };
  try {
    return { success: true, data: await listModosCached(user.id, accessToken) };
  } catch {
    return { success: false, error: "Error al cargar los modos" };
  }
}

export async function getModo(id: string): Promise<ActionResult<Modo>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const { data, error } = await supabase
    .from("modos").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !data) return { success: false, error: "Modo no encontrado" };
  return { success: true, data };
}

export async function getModoSummary(id: string): Promise<
  ActionResult<{ modo: Modo; summary: ModoSummary; sharedGroups: SharedPaymentGroup[]; transactions: ModoTxRow[] }>
> {
  const { user, accessToken, supabase } = await getAuthenticatedClient();
  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  const { data: modo, error } = await supabase
    .from("modos").select("*").eq("id", id).eq("user_id", user.id).single();
  if (error || !modo) return { success: false, error: "Modo no encontrado" };

  const txIds = await getModoTransactionIds(modo, user.id, accessToken);
  let transactions: ModoTxRow[] = [];
  if (txIds.length > 0) {
    const { data } = await supabase
      .from("transactions")
      .select(MODO_TX_SELECT)
      .eq("user_id", user.id)
      .in("id", txIds)
      .order("transaction_date", { ascending: false });
    transactions = (data ?? []) as unknown as ModoTxRow[];
  }

  const summary = summarizeModo(transactions);
  const groupsResult = await getSharedPaymentGroups();
  const sharedGroups = groupsResult.success
    ? filterSharedGroupsByOrigin(groupsResult.data, txIds)
    : [];

  return { success: true, data: { modo, summary, sharedGroups, transactions } };
}

// ── Mutations ────────────────────────────────────────────
function parseModoForm(formData: FormData) {
  return modoSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || null,
    emoji: formData.get("emoji") || null,
    date_from: formData.get("date_from"),
    date_to: formData.get("date_to"),
    tag_ids: JSON.parse((formData.get("tag_ids") as string) || "[]"),
  });
}

export async function createModo(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { data, error } = await supabase
    .from("modos")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id").single();
  if (error || !data) return { success: false, error: error?.message ?? "Error al crear el modo" };

  expireTag("modos");
  return { success: true, data: { id: data.id } };
}

export async function updateModo(id: string, formData: FormData): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const parsed = parseModoForm(formData);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { error } = await supabase
    .from("modos").update(parsed.data).eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  expireTag("modos");
  return { success: true, data: null };
}

export async function deleteModo(id: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  const { error } = await supabase
    .from("modos").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { success: false, error: error.message };

  expireTag("modos");
  return { success: true, data: null };
}
```

> Nota: `getAuthenticatedClient()` devuelve `{ supabase, user, accessToken }` — confirmar los nombres exactos en `@/lib/supabase/auth` y ajustar el destructuring si difiere.

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `cd webapp && pnpm vitest run src/actions/__tests__/modos-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Verificar build**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add webapp/src/actions/modos.ts webapp/src/actions/__tests__/modos-summary.test.ts
git commit -m "feat(modos): actions CRUD + resumen derivado"
```

---

> **Decisión UI (2026-07-01):** Modos viven en el hub **Gestionar/Bandeja** → agregar a `WORKSPACE_NAV` en `navigation.ts` (NO `PRIMARY_NAV`, NO barra inferior de `mobile-nav.ts` — está llena con 5). Descubrimiento principal = "Guardar como Modo" desde el filtro (Task 8). La página `/modos` incluye búsqueda client-side: input por nombre + segmento **Activos/Pasados** (derivado de `date_to` vs hoy).

### Task 6: Ruta `/modos` (lista de tarjetas) + entrada en nav

**Files:**
- Create: `webapp/src/app/(dashboard)/modos/page.tsx`
- Create: `webapp/src/components/modos/modo-card.tsx`
- Modify: `webapp/src/lib/constants/navigation.ts`
- Modify: `webapp/src/lib/constants/mobile-nav.ts`

**Interfaces:**
- Consumes: `listModos` (Task 5), tipo `Modo`.
- Produces: página listada en `/modos`; componente `ModoCard`.

- [ ] **Step 1: Componente `ModoCard`**

`webapp/src/components/modos/modo-card.tsx` (client component con Link a `/modos/[id]`). Muestra `emoji`, `name`, rango `date_from – date_to` formateado con date-fns locale `es`, y un borde/acento con `color`. Mirar `src/components/mobile/mobile-link-grid.tsx` o las tarjetas de `/deudas` para el estilo. Estructura mínima:

```tsx
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { Modo } from "@/types/domain";

export function ModoCard({ modo }: { modo: Modo }) {
  const range = `${format(new Date(modo.date_from), "d MMM", { locale: es })} – ${format(
    new Date(modo.date_to), "d MMM yyyy", { locale: es })}`;
  return (
    <Link
      href={`/modos/${modo.id}`}
      className="flex items-center gap-3 rounded-xl border p-4 hover:bg-accent"
      style={modo.color ? { borderLeftColor: modo.color, borderLeftWidth: 4 } : undefined}
    >
      <span className="text-2xl">{modo.emoji ?? "📍"}</span>
      <div>
        <p className="font-medium">{modo.name}</p>
        <p className="text-sm text-muted-foreground">{range}</p>
      </div>
    </Link>
  );
}
```

**Step 1b: Lista buscable (client)** — `webapp/src/components/modos/modos-list.tsx` (client). Recibe `modos: Modo[]`, renderiza:
- Un `<input>` de búsqueda por nombre (filtra client-side, case-insensitive).
- Un segmento **Activos / Pasados / Todos** (toggle) donde "Activo" = `date_to >= hoy` (comparar strings ISO `YYYY-MM-DD`), "Pasado" = `date_to < hoy`. Default: Todos.
- Las `ModoCard` filtradas por ambos criterios. Estado vacío si el filtro no deja ninguna.
Sin backend ni dependencias nuevas (dataset pequeño). `hoy` = `new Date().toISOString().slice(0,10)`.

- [ ] **Step 2: Página `/modos`**

`webapp/src/app/(dashboard)/modos/page.tsx` (server component) — carga `listModos()` y pasa los datos a `<ModosList modos={...} />` (client) en vez de mapear las tarjetas directamente:

```tsx
import { listModos } from "@/actions/modos";
import { ModoCard } from "@/components/modos/modo-card";

export default async function ModosPage() {
  const result = await listModos();
  const modos = result.success ? result.data : [];
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <h1 className="text-2xl font-semibold">Modos</h1>
      {modos.length === 0 ? (
        <p className="text-muted-foreground">
          Aún no tienes modos. Crea uno desde el filtro de una lista de transacciones etiquetadas.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {modos.map((m) => <ModoCard key={m.id} modo={m} />)}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Agregar entrada de nav**

En `webapp/src/lib/constants/navigation.ts` y `webapp/src/lib/constants/mobile-nav.ts`, agregar una entrada `{ href: "/modos", label: "Modos", icon: <IconApropiado> }` siguiendo la forma exacta de las entradas existentes (mirar la de `/deudas` en cada archivo y copiar su estructura, incluido el icono de lucide-react).

- [ ] **Step 4: Verificar build**

Run: `cd webapp && pnpm build`
Expected: PASS. Navegar mentalmente: `/modos` renderiza el estado vacío o las tarjetas.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/app/\(dashboard\)/modos/page.tsx webapp/src/components/modos/modo-card.tsx webapp/src/lib/constants/navigation.ts webapp/src/lib/constants/mobile-nav.ts
git commit -m "feat(modos): ruta /modos con tarjetas + nav"
```

---

### Task 7: Ruta `/modos/[id]` (resumen con los 4 bloques)

**Files:**
- Create: `webapp/src/app/(dashboard)/modos/[id]/page.tsx`
- Create: `webapp/src/components/modos/modo-summary-view.tsx`

**Interfaces:**
- Consumes: `getModoSummary` (Task 5), `formatCurrency` de `@/lib/utils/currency`, tipos `ModoSummary`, `SharedPaymentGroup`, `ModoTxRow`.
- Produces: vista de resumen en `/modos/[id]`.

- [ ] **Step 1: Componente `ModoSummaryView`**

`webapp/src/components/modos/modo-summary-view.tsx` — recibe el payload de `getModoSummary` y renderiza los 4 bloques. Reusar `formatCurrency` (verificar la firma exacta en `src/lib/utils/currency.ts`). Estructura:

```tsx
import { formatCurrency } from "@/lib/utils/currency";
import type { ModoSummary, ModoTxRow } from "@/lib/utils/modo-summary";
import type { Modo, SharedPaymentGroup } from "@/types/domain";

export function ModoSummaryView({ modo, summary, sharedGroups, transactions }: {
  modo: Modo; summary: ModoSummary; sharedGroups: SharedPaymentGroup[]; transactions: ModoTxRow[];
}) {
  const cc = transactions[0]?.amount != null ? "COP" : "COP"; // moneda por defecto del proyecto
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4">
      {/* Bloque 1: header total + conteo */}
      <header>
        {/* "Ver en Movimientos": aplica el filtro del Modo a la lista de transacciones (round-trip) */}
        <Link
          href={`/transactions?tags=${modo.tag_ids.join(",")}&dateFrom=${modo.date_from}&dateTo=${modo.date_to}`}
          className="text-sm text-z-brass hover:underline"
        >
          Ver en Movimientos →
        </Link>
        <h1 className="text-2xl font-semibold">{modo.emoji ?? "📍"} {modo.name}</h1>
        <p className="text-3xl font-bold mt-2">{formatCurrency(summary.total, cc)}</p>
        <p className="text-sm text-muted-foreground">
          {summary.count} transacciones · {summary.observedFrom ?? modo.date_from} – {summary.observedTo ?? modo.date_to}
        </p>
      </header>

      {/* Bloque 2: por categoría */}
      <section className="space-y-2">
        <h2 className="font-medium">Por categoría</h2>
        {summary.byCategory.map((b) => (
          <div key={b.categoryId ?? b.name} className="flex justify-between text-sm">
            <span>{b.name} <span className="text-muted-foreground">({b.count})</span></span>
            <span>{formatCurrency(b.total, cc)}</span>
          </div>
        ))}
      </section>

      {/* Bloque 3: pagos compartidos / por persona */}
      {sharedGroups.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-medium">Pagos compartidos</h2>
          {sharedGroups.map((g) => (
            <div key={g.split_group_id} className="rounded-lg border p-3 text-sm">
              <div className="flex justify-between">
                <span>{g.description ?? "Pago compartido"}</span>
                <span>{formatCurrency(g.total, g.currency_code)}</span>
              </div>
              <p className="text-muted-foreground">
                Tu parte {formatCurrency(g.userShare, g.currency_code)} · pendiente {formatCurrency(g.outstanding_total, g.currency_code)}
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Bloque 4: lista de transacciones */}
      <section className="space-y-1">
        <h2 className="font-medium">Transacciones</h2>
        {transactions.map((t) => (
          <div key={t.id} className="flex justify-between text-sm border-b py-1.5">
            <span>{t.category?.name_es ?? t.category?.name ?? "Sin categoría"} · {t.transaction_date}</span>
            <span>{formatCurrency(t.amount ?? 0, cc)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
```

> `cc` (moneda): usar el default del proyecto (`"COP"`). Si el proyecto ya expone una constante de moneda default, usarla en vez del literal.

- [ ] **Step 2: Página `/modos/[id]`**

`webapp/src/app/(dashboard)/modos/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getModoSummary } from "@/actions/modos";
import { ModoSummaryView } from "@/components/modos/modo-summary-view";

export default async function ModoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getModoSummary(id);
  if (!result.success) notFound();
  return <ModoSummaryView {...result.data} />;
}
```

> Confirmar la firma de `params` (Promise vs objeto) según la versión de Next del proyecto; mirar otra página `[id]` existente (ej. detalle de cuenta) y copiar su patrón exacto.

- [ ] **Step 3: Verificar build**

Run: `cd webapp && pnpm build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add webapp/src/app/\(dashboard\)/modos/\[id\]/page.tsx webapp/src/components/modos/modo-summary-view.tsx
git commit -m "feat(modos): vista de resumen /modos/[id]"
```

---

### Task 8: Diálogo crear/editar Modo + entrada "Guardar como Modo"

**Files:**
- Create: `webapp/src/components/modos/modo-form-dialog.tsx`
- Modify: `webapp/src/app/(dashboard)/modos/page.tsx` (botón "Nuevo modo")
- Modify: `webapp/src/components/transactions/transaction-filters.tsx` (botón "Guardar como Modo")

**Interfaces:**
- Consumes: `createModo`, `updateModo` (Task 5), lista de `Tag` (para el multi-select), componentes `Dialog`, `Input`, `Button` de `@/components/ui`, `date-picker`/`calendar`.
- Produces: `ModoFormDialog` reutilizable (create y edit).

- [ ] **Step 1: Componente `ModoFormDialog`**

`webapp/src/components/modos/modo-form-dialog.tsx` (client). Campos: `name` (Input), `emoji` (Input corto), `color` (Input color o presets), `date_from`/`date_to` (date-picker de `@/components/ui/date-picker`), y multi-select de tags (toggles de chips, igual patrón que Task 3). Al enviar, construye un `FormData` con `tag_ids` como `JSON.stringify(selectedIds)` (coincide con `parseModoForm` en Task 5) y llama `createModo` o `updateModo` dentro de `useTransition`; en éxito, `router.push('/modos/' + id)` o `router.refresh()`. Props:

```tsx
interface ModoFormDialogProps {
  tags: import("@/types/domain").Tag[];
  initial?: Partial<import("@/types/domain").Modo> & { id?: string };
  trigger: React.ReactNode;
  presetTagIds?: string[];
  presetDateFrom?: string;
  presetDateTo?: string;
}
```

Mirar un diálogo de formulario existente (ej. `transaction-form-dialog.tsx`) para el patrón de `Dialog` + `useActionState`/`useTransition` + manejo de errores con `.issues[0].message`.

- [ ] **Step 2: Botón "Nuevo modo" en `/modos`**

En `webapp/src/app/(dashboard)/modos/page.tsx`, cargar los tags del usuario (action existente de tags, ej. `getAllTags`/`getTagGroups` — verificar el nombre en `src/actions/tags.ts`) y renderizar `<ModoFormDialog tags={tags} trigger={<Button>Nuevo modo</Button>} />` en el header.

- [ ] **Step 3: Botón "Guardar como Modo" en el filtro**

En `webapp/src/components/transactions/transaction-filters.tsx`, cuando haya tags seleccionados en el param `tags`, mostrar un botón que abra `ModoFormDialog` pre-llenado: `presetTagIds` = tags actuales del filtro, `presetDateFrom`/`presetDateTo` = `dateFrom`/`dateTo` del filtro si existen. Pasar la lista `tags` (ya disponible como prop del componente de filtros).

- [ ] **Step 4: Verificar build + suite completa**

Run: `cd webapp && pnpm vitest run && pnpm build`
Expected: PASS en ambos.

- [ ] **Step 5: Commit**

```bash
git add webapp/src/components/modos/modo-form-dialog.tsx webapp/src/app/\(dashboard\)/modos/page.tsx webapp/src/components/transactions/transaction-filters.tsx
git commit -m "feat(modos): diálogo crear/editar + guardar como modo desde filtro"
```

---

## Notas de verificación final

- `pnpm vitest run` — toda la suite verde (validador, tag-ids, modo-summary, modos-summary).
- `pnpm build` — limpio (type-check incluido).
- Prueba manual: crear un Modo con los tags de Cartagena + rango de julio → `/modos/[id]` muestra total, desglose por categoría, el pago compartido con Estefa, y la lista de transacciones.
- El filtro de transacciones permite seleccionar varios tags a la vez (OR).

## Futuro (Opción 3 — fuera de este plan)

`is_active` + ventana de activación, auto-tag de transacciones creadas mientras el Modo está activo, banner global de "modo activo", scoping del dashboard. Documentado en el spec.
