"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { PANEL_INSET_CLASS } from "@/lib/constants/styles";
import type { ModoCandidateRow } from "@/actions/modos";
import type { CurrencyCode } from "@/types/domain";

export function describeCandidate(row: ModoCandidateRow): string {
  return (
    row.merchant_name?.trim() ||
    row.clean_description?.trim() ||
    row.raw_description?.trim() ||
    row.category?.name_es ||
    row.category?.name ||
    "Movimiento"
  );
}

function reasonLabel(row: ModoCandidateRow): { label: string; strong: boolean } | null {
  if (row.candidate.foreignCurrency) return { label: "Moneda extranjera", strong: true };
  if (row.flow_class_effective === "CASH_WITHDRAWAL") return { label: "Retiro", strong: true };
  if (row.candidate.reason === "manual_capture") return { label: "Registrado a mano", strong: false };
  return { label: "Importado", strong: false };
}

interface ModoCandidateListProps {
  rows: ModoCandidateRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll?: (next: boolean) => void;
  /** Cap rendered rows (wizard); the tray shows everything. */
  limit?: number;
  className?: string;
}

/**
 * "¿Fueron del viaje?" — one checkbox row per candidate. Shared by the wizard's
 * last step and the review tray so both read the same way.
 */
export function ModoCandidateList({
  rows,
  selected,
  onToggle,
  onToggleAll,
  limit,
  className,
}: ModoCandidateListProps) {
  const visible = limit ? rows.slice(0, limit) : rows;
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));

  return (
    <div className={cn(PANEL_INSET_CLASS, "overflow-hidden", className)}>
      {onToggleAll && rows.length > 1 && (
        <label className="flex items-center gap-3 border-b border-white/6 px-3 py-2 text-xs text-muted-foreground">
          <Checkbox
            checked={allSelected ? true : selected.size > 0 ? "indeterminate" : false}
            onCheckedChange={(v) => onToggleAll(v === true)}
            aria-label="Seleccionar todos"
          />
          {allSelected ? "Quitar selección" : "Seleccionar todos"} · {rows.length}
        </label>
      )}
      <ul className="divide-y divide-white/6">
        {visible.map((row) => {
          const checked = selected.has(row.id);
          const reason = reasonLabel(row);
          return (
            <li key={row.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/[0.02]">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => onToggle(row.id)}
                  aria-label={`Incluir ${describeCandidate(row)}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{describeCandidate(row)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatDate(row.transaction_date, "d MMM")}
                    {row.account ? ` · ${row.account.name}` : ""}
                    {row.category ? ` · ${row.category.name_es ?? row.category.name}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-sm tabular-nums">
                    {formatCurrency(row.amount ?? 0, (row.currency_code ?? "COP") as CurrencyCode)}
                  </span>
                  {reason && (
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px]",
                        reason.strong
                          ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
                          : "border-white/6 text-muted-foreground",
                      )}
                    >
                      {reason.label}
                    </span>
                  )}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {limit && rows.length > limit && (
        <p className="border-t border-white/6 px-3 py-2 text-xs text-muted-foreground">
          y {rows.length - limit} más — podrás revisarlos en el viaje
        </p>
      )}
    </div>
  );
}
