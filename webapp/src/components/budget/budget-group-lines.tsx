"use client";

import { useState } from "react";
import { Plus, Minus, ListPlus } from "lucide-react";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData, CurrencyCode } from "@/types/domain";

interface BudgetGroupLinesProps {
  group: CategoryBudgetData;
  currency: CurrencyCode;
  /** category_id → amount string. The group's own id keys the "Base" line. */
  draft: Record<string, string>;
  onChange: (categoryId: string, amount: string) => void;
  /** Adds a line to the draft (chip tap / picker), prefilled by the caller. */
  onAddLine: (categoryId: string, prefill: string) => void;
  /** Removes a line from the draft (the "−" affordance). Base line is never removable. */
  onRemoveLine?: (categoryId: string) => void;
  /** Optional inline creation of a subcategory; resolves to the new id. */
  onCreateSub?: (name: string) => Promise<string | null>;
  /** Composer mode: show real spend next to each line. */
  showSpend?: boolean;
  /** Opens the transaction picker for this group (fills the base line from picked tx). */
  onPickFromTransactions?: (categoryId: string, categoryName: string) => void;
  /** True when there are uncategorized tx available — gates the "Desde transacciones" chip. */
  hasUncategorized?: boolean;
}

export function BudgetGroupLines({
  group,
  currency,
  draft,
  onChange,
  onAddLine,
  onRemoveLine,
  onCreateSub,
  showSpend = false,
  onPickFromTransactions,
  hasUncategorized = false,
}: BudgetGroupLinesProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const baseValue = draft[group.id] ?? "";
  const lineChildren = group.children.filter((c) => draft[c.id] !== undefined);
  const suggested = group.children.filter(
    (c) =>
      draft[c.id] === undefined &&
      ((group.childRecurring[c.id] ?? 0) > 0 || (group.childAvg3m[c.id] ?? 0) > 0)
  );
  const pickable = group.children.filter(
    (c) => draft[c.id] === undefined && !suggested.includes(c)
  );

  function suggestionAmount(childId: string): number {
    // Recurring amount is exact; fall back to rounded 3m average.
    const rec = group.childRecurring[childId] ?? 0;
    if (rec > 0) return Math.round(rec);
    return Math.round(group.childAvg3m[childId] ?? 0);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name || !onCreateSub || busy) return;
    setBusy(true);
    try {
      const id = await onCreateSub(name);
      if (id) {
        onAddLine(id, "");
        setNewName("");
        setCreating(false);
      }
    } finally {
      setBusy(false);
    }
  }

  const parentOwnSpent =
    group.spent - Object.values(group.childrenSpent).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-1.5">
      <LineRow
        label="Base (general)"
        muted={Number(baseValue || 0) === 0 && lineChildren.length > 0}
        spend={showSpend ? parentOwnSpent : null}
        currency={currency}
        value={baseValue}
        onChange={(v) => onChange(group.id, v)}
      />

      {lineChildren.map((child) => (
        <LineRow
          key={child.id}
          label={child.name_es ?? child.name}
          badge={
            (group.childRecurring[child.id] ?? 0) > 0
              ? "recurrente"
              : (group.childAvg3m[child.id] ?? 0) > 0
                ? "prom 3m"
                : undefined
          }
          spend={showSpend ? (group.childrenSpent[child.id] ?? 0) : null}
          currency={currency}
          value={draft[child.id] ?? ""}
          onChange={(v) => onChange(child.id, v)}
          onRemove={onRemoveLine && child.id !== group.id ? () => onRemoveLine(child.id) : undefined}
        />
      ))}

      {(suggested.length > 0 || pickable.length > 0 || onCreateSub || (onPickFromTransactions && hasUncategorized)) && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {suggested.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onAddLine(child.id, String(suggestionAmount(child.id)))}
              className="rounded-full border border-dashed border-z-brass/40 bg-z-brass/8 px-2.5 py-1 text-[10px] font-medium text-z-brass transition-colors active:bg-z-brass/14"
            >
              + {child.name_es ?? child.name} ·{" "}
              {(group.childRecurring[child.id] ?? 0) > 0 ? "recurrente " : "prom "}
              {formatCurrency(suggestionAmount(child.id), currency)}
            </button>
          ))}

          {pickable.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => onAddLine(child.id, "")}
              className="rounded-full border border-dashed border-white/6 px-2.5 py-1 text-[10px] text-z-sage-light transition-colors active:bg-white/5"
            >
              + {child.name_es ?? child.name}
            </button>
          ))}

          {onPickFromTransactions && hasUncategorized && (
            <button
              type="button"
              onClick={() => onPickFromTransactions(group.id, group.name_es ?? group.name)}
              className="flex items-center gap-1 rounded-full border border-dashed border-z-brass/40 bg-z-brass/8 px-2.5 py-1 text-[10px] font-medium text-z-brass transition-colors active:bg-z-brass/14"
            >
              <ListPlus className="size-2.5" strokeWidth={2} /> Desde transacciones
            </button>
          )}

          {onCreateSub && !creating && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 rounded-full border border-dashed border-white/6 px-2.5 py-1 text-[10px] text-z-sage-dark transition-colors active:bg-white/5"
            >
              <Plus className="size-2.5" strokeWidth={2} /> Otra línea…
            </button>
          )}
        </div>
      )}

      {creating && (
        <div className="flex items-center gap-2 pt-1">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre — ej. Netflix"
            className="h-9 flex-1 rounded-md border border-white/6 bg-black/10 px-3 text-sm outline-none placeholder:text-z-sage-dark focus-visible:border-z-brass/35"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={busy || !newName.trim()}
            className={cn(
              "h-9 shrink-0 rounded-md border px-3 text-xs font-semibold transition-colors disabled:opacity-50",
              BRASS_GHOST_BUTTON_CLASS
            )}
          >
            {busy ? "Creando..." : "Crear línea"}
          </button>
        </div>
      )}
    </div>
  );
}

function LineRow({
  label,
  badge,
  muted,
  spend,
  currency,
  value,
  onChange,
  onRemove,
}: {
  label: string;
  badge?: string;
  muted?: boolean;
  spend: number | null;
  currency: CurrencyCode;
  value: string;
  onChange: (value: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-lg border border-white/6 bg-black/10 px-2.5 py-1.5",
        muted && "opacity-60"
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] font-medium">{label}</span>
        {badge && (
          <span className="shrink-0 rounded-full border border-z-brass/30 bg-z-brass/12 px-1.5 text-[9px] font-semibold text-z-brass">
            {badge}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {spend !== null && spend > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {formatCurrency(spend, currency)} /
          </span>
        )}
        <CurrencyInput
          className="w-28 text-right"
          placeholder="0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Quitar ${label}`}
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-z-sage-dark transition-colors hover:bg-z-debt/10 hover:text-z-debt"
          >
            <Minus className="size-3.5" strokeWidth={2} />
          </button>
        )}
      </span>
    </div>
  );
}
