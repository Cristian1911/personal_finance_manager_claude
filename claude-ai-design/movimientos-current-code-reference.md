# Movimientos (webapp mobile view) — código actual de la lista de transacciones

Referencia para Claude Design: este es el código REAL que hoy pinta la lista de
transacciones en la vista móvil del webapp (`sanson1911.cloud` → Movim.).
Sirve como base para construir el layout actual antes de proponer el rediseño.

## Árbol de componentes

```
MovimientosRoot (movimientos-root.tsx)
├── MobileHeader "Movimientos"
├── MonthSelector
├── MovimientosLectura        ← resumen del mes (no incluido aquí)
├── MovimientosHerramientas   ← tiles Categorizar/Importar (no incluido aquí)
├── MovimientosUtilidades     ← búsqueda + "Filtrar" (no incluido aquí)
└── Feed agrupado por fecha
    ├── Eyebrow de día (SECTION_EYEBROW_CLASS) — "JUEVES, 02 JUL"
    └── MovimientosTransactionRow (por transacción)
        ├── Fila colapsada: icono dirección + descripción + (dot cuenta ·
        │   icono+nombre categoría) + monto
        ├── TagChips (si tiene etiquetas)
        └── [expandida] TransactionQuickActions
            ├── Meta-línea (Recurrente · N etiquetas · Excluida)
            ├── Trío: Categoría · Destinatario · Más
            └── Sheet "Más acciones" (Drawer/vaul)
```

## Tokens de color (Tailwind config)

| Token | Valor |
|---|---|
| `background` | `#121412` |
| `foreground` | `#F6F0E3` |
| `muted-foreground` | `#938C7E` |
| `z-brass` | `#937844` |
| `z-income` | `#5CB88A` |
| `z-expense` | `#E8875A` |
| `z-sage-dark` | `#938C7E` |
| `z-sage-light` | `#D9CCB9` |
| `z-surface-2` | `#1E221E` |
| borde estándar | `border-white/6`, `border-white/8` |

Tipografía: Inter. Montos siempre `tabular-nums`.

```ts
// SECTION_EYEBROW_CLASS (headers de día)
"text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark"
```

---

## 1. Feed — `mobile/v2/movimientos/movimientos-root.tsx` (sección del feed)

```tsx
{/* Feed — date-grouped transaction rows */}
{transactions.length === 0 ? (
  <div className="flex flex-col items-center justify-center py-16 text-center">
    <p className="text-muted-foreground">
      No hay movimientos en esta vista
    </p>
  </div>
) : (
  <div className="space-y-4">
    {groupedByDate.map(([date, txs]) => (
      <div key={date}>
        <p className={cn("mb-2", SECTION_EYEBROW_CLASS)}>
          {formatDate(date, "EEEE, dd MMM")}
        </p>
        <div className="space-y-0.5">
          {txs.map((tx) => (
            <MovimientosTransactionRow key={tx.id} transaction={tx} categories={categories} tags={tagsByTxId.get(tx.id)} linkableAccountIds={linkableAccountIds} />
          ))}
        </div>
      </div>
    ))}

    {/* Cargar más — appends the next server page in place */}
    {hasMorePages && (
      <button
        type="button"
        onClick={loadMore}
        disabled={isLoadingMore}
        className={cn(
          "w-full rounded-lg py-2.5 text-xs font-medium text-z-sage-dark transition-colors active:bg-white/[0.04]",
          isLoadingMore && "opacity-50"
        )}
      >
        {isLoadingMore ? "Cargando..." : "Cargar más movimientos"}
      </button>
    )}
  </div>
)}
```

---

## 2. Fila — `mobile/v2/movimientos/movimientos-transaction-row.tsx` (completo)

```tsx
"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { CategoryIcon } from "@/components/categories/category-icon";
import { TagChip } from "@/components/tags/tag-chip";
import { TransactionQuickActions } from "@/components/transactions/transaction-quick-actions";
import type { TransactionWithAccount, CategoryWithChildren } from "@/types/domain";

interface MovimientosTransactionRowProps {
  transaction: TransactionWithAccount;
  categories: CategoryWithChildren[];
  tags?: Array<{ id: string; name: string; color: string | null; group_color: string | null }>;
  /** Account IDs that have pending recurring occurrences — enables "Vincular a recurrente" */
  linkableAccountIds?: Set<string>;
  /** Called after a successful category assignment — used by categorizar to remove from list / prompt bulk apply */
  onCategorized?: (txId: string, categoryId: string) => void;
}

export function MovimientosTransactionRow({
  transaction: tx,
  categories,
  tags = [],
  linkableAccountIds,
  onCategorized,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  // Optimistic category for the collapsed-row subtitle (the action surface owns
  // the rest of the mutations and reports back via onCategorized).
  const [localCategory, setLocalCategory] = useState(tx.category);

  const description =
    tx.merchant_name || tx.clean_description || tx.raw_description || "Sin descripción";
  const categoryName = localCategory?.name_es ?? localCategory?.name ?? null;

  function handleCategorized(txId: string, categoryId: string) {
    const cat = categories
      .flatMap((c) => [c, ...(c.children ?? [])])
      .find((c) => c.id === categoryId);
    if (cat) {
      setLocalCategory({ id: cat.id, name: cat.name, name_es: cat.name_es, icon: cat.icon, color: cat.color });
    }
    onCategorized?.(txId, categoryId);
  }

  return (
    <div
      className={cn(
        "rounded-xl transition-colors",
        expanded && "border-l-2 border-z-brass pl-2",
      )}
    >
      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex w-full items-center gap-2 px-2 py-2.5 text-left transition-colors hover:bg-white/5",
          tx.is_excluded && "opacity-40",
        )}
      >
        <div
          className={cn(
            "flex size-[22px] shrink-0 items-center justify-center rounded-md",
            tx.direction === "INFLOW" ? "bg-z-income/12 text-z-income" : "bg-z-expense/12 text-z-expense",
          )}
        >
          {tx.direction === "INFLOW" ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-medium">
            {tx.recurrence_group_id && (
              <>
                <Repeat className="size-3 shrink-0 text-z-brass/70" aria-hidden="true" />
                <span className="sr-only">Vinculado a recurrente:</span>
              </>
            )}
            <span className="truncate">{description}</span>
          </p>
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate">{tx.account.name}</span>
            <span className="text-white/15">·</span>
            {categoryName ? (
              <span className="inline-flex items-center gap-0.5 truncate">
                {localCategory?.icon && <CategoryIcon icon={localCategory.icon} className="size-3 shrink-0" />}
                {categoryName}
              </span>
            ) : (
              <span className="text-z-brass">Sin cat.</span>
            )}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-medium tabular-nums",
            tx.direction === "INFLOW" && "text-z-income",
            tx.is_excluded && "line-through",
          )}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </button>

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 pb-1.5 pl-[38px]">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={{ name: t.name, color: t.color }}
              groupColor={t.group_color}
              size="sm"
            />
          ))}
        </div>
      )}

      {/* Expanded: shared quick-action surface */}
      {expanded && (
        <div className="px-2 pb-2.5 pt-0.5">
          <TransactionQuickActions
            transaction={tx}
            categories={categories}
            tags={tags}
            linkableAccountIds={linkableAccountIds}
            onCategorized={handleCategorized}
          />
        </div>
      )}
    </div>
  );
}
```

---

## 3. Superficie expandida — `transactions/transaction-quick-actions.tsx` (partes de UI)

Compartida por Inicio, Movimientos y el inbox Categorizar. La lógica de
mutación se omite aquí; esto es todo lo que pinta.

```tsx
/** Base action button for the primary trio (Variante B). Categoría/Destinatario
 *  take `flex-1`; "Más" stays content-width so the two grow. */
const TRIO_BTN_CLASS =
  "inline-flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors";

// ── Meta-línea: compact read-only/shortcut status of assigned secondary state ──
const metaItems: React.ReactNode[] = [];
if (tx.recurrence_group_id) {
  metaItems.push(
    <span key="rec" className="inline-flex items-center gap-1">
      <Repeat className="size-3" /> Recurrente
    </span>,
  );
}
if (tags.length > 0) {
  metaItems.push(
    <button
      key="tags"
      type="button"
      onClick={() => setMoreOpen(true)}
      className="inline-flex items-center gap-1 hover:text-z-brass"
    >
      <TagIcon className="size-3" /> {tags.length} etiqueta{tags.length === 1 ? "" : "s"}
    </button>,
  );
}
if (excluded) {
  metaItems.push(
    <span key="exc" className="inline-flex items-center gap-1 text-z-expense">
      <EyeOff className="size-3" /> Excluida
    </span>,
  );
}

return (
  <div className="flex flex-col gap-2">
    {/* Meta-línea */}
    {metaItems.length > 0 && (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
        {metaItems.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            {i > 0 && <span className="opacity-40">·</span>}
            {item}
          </span>
        ))}
      </div>
    )}

    {/* Primary trio — Categoría · Destinatario grow; Más stays compact */}
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        onClick={() => setCatOpen(true)}
        className={cn(
          TRIO_BTN_CLASS,
          "flex-1",
          !catColor && "border-z-brass/30 bg-z-brass/10 text-z-brass",
        )}
        style={
          catColor
            ? {
                backgroundColor: chipBackground(catColor),   // color zona al 15%
                borderColor: zoneBorder(catColor),           // color zona al 20%
                color: zoneTextColor(catColor),              // color zona directo
              }
            : undefined
        }
      >
        {categoryName ? (
          <>
            {localCategory?.icon && <CategoryIcon icon={localCategory.icon} className="size-3.5 shrink-0" />}
            <span className="truncate">{categoryName}</span>
          </>
        ) : (
          <>
            <TagIcon className="size-3.5 shrink-0" />
            Categorizar
          </>
        )}
      </button>
      <button
        type="button"
        onClick={() => setDestOpen(true)}
        className={cn(
          TRIO_BTN_CLASS,
          "flex-1",
          localDestinatario
            ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
            : "border-white/8 bg-white/[0.03] text-foreground hover:bg-white/[0.06]",
        )}
      >
        <UserRound className="size-3.5 shrink-0" />
        <span className="truncate">{localDestinatario?.name ?? "Destinatario"}</span>
      </button>
      <button
        type="button"
        onClick={() => setMoreOpen(true)}
        aria-label="Más acciones"
        className={cn(
          TRIO_BTN_CLASS,
          "shrink-0 border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
        )}
      >
        <MoreHorizontal className="size-3.5 shrink-0" />
        Más
      </button>
    </div>

    {/* "Más" sheet — secondary actions (Drawer de vaul, sube desde abajo) */}
    <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Más acciones</DrawerTitle>
        </DrawerHeader>
        <DrawerBody className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="px-1">
            <div className="mb-2 px-2">
              <TagZonePicker ... triggerClassName="w-full justify-start rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2.5 text-sm" />
            </div>
            {canLinkRecurring && (
              <ActionRow icon={<Link2 className="size-4" />} label="Vincular a recurrente" ... />
            )}
            {canLinkPersona && (
              <ActionRow icon={<Users className="size-4" />} label="Vincular a deuda personal" ... />
            )}
            {canSplit && (
              <ActionRow icon={<Receipt className="size-4" />} label="Repartir (pago compartido)" ... />
            )}
            <ActionRow
              icon={excluded ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              label={excluded ? "Incluir en métricas" : "Excluir de métricas"}
              ...
            />
            <ActionRow asLink href={`/transactions/${tx.id}`} icon={<Pencil className="size-4" />} label="Ver / editar detalle" />
          </div>
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  </div>
);

/* Fila de acción dentro del sheet "Más" */
function ActionRow({ icon, label, onClick, disabled, asLink, href }) {
  const className =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-white/5 disabled:opacity-50";
  // <Link> o <button> con: <span className="text-muted-foreground">{icon}</span> {label}
}
```

---

## 4. Helpers visuales

### `tags/tag-chip.tsx` (completo)

```tsx
export function TagChip({ tag, groupColor, onRemove, size = "md" }: TagChipProps) {
  const color = tag.color ?? groupColor ?? "rgba(255,255,255,0.15)";
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border ${sizeClasses}`}
      style={{
        borderColor: color,
        backgroundColor: `${color}15`,   // color al ~8% (hex alpha 15)
      }}
    >
      <span style={{ color }}>{tag.name}</span>
      {/* onRemove → botón X opcional */}
    </span>
  );
}
```

### `lib/utils/zone-colors.ts` (fórmulas de color por categoría)

```ts
/** Zone tile background — 10% opacity of zone color */
export function zoneBackground(hex: string): string { return rgba(hex, 0.1); }

/** Zone tile border — 20% opacity of zone color */
export function zoneBorder(hex: string): string { return rgba(hex, 0.2); }

/** Subcategory chip background — 15% opacity of zone color */
export function chipBackground(hex: string): string { return rgba(hex, 0.15); }

/** Zone text color — uses the category color directly (suitable for dark theme) */
export function zoneTextColor(hex: string): string { return hex; }
```

### `categories/category-icon.tsx`

Mapea el nombre de icono guardado en la categoría (`"paw-print"`, `"shopping-cart"`,
`"utensils"`, etc.) a su icono lucide-react. ~70 iconos registrados. Uso:
`<CategoryIcon icon={cat.icon} className="size-3" />`.

---

## Notas de comportamiento (para que el layout las respete)

- La fila colapsada es un `<button>` que togglea `expanded`; al expandir, el
  contenedor gana `border-l-2 border-z-brass pl-2` (regla brass a la izquierda).
- El monto: `-` neutral (`foreground`) para gastos, `+` verde `z-income` para
  ingresos. Excluida → `opacity-40` + `line-through`.
- Categoría en el trío usa el color de la ZONA padre (no el de la subcategoría)
  vía `chipBackground/zoneBorder/zoneTextColor`.
- "Sin cat." en brass es el estado de atención (call to action implícito).
- Filas separadas hoy solo por `space-y-0.5` — sin divisores (este es el dolor
  que el rediseño ataca).
- Día agrupado con eyebrow uppercase tracking ancho; fechas `formatDate(date,
  "EEEE, dd MMM")` en español.
