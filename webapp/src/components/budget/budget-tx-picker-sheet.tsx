"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import {
  BRASS_BUTTON_CLASS,
  MOBILE_SHEET_SAFE_AREA_CLASS,
} from "@/lib/constants/styles";
import { getUncategorizedTransactions, categorizeTransaction } from "@/actions/categorize";
import type { TransactionWithAccount, CurrencyCode } from "@/types/domain";

// ─── Pure helper (exported for tests) ────────────────────────────────────────

export function sumSelectedTx(
  txs: { id: string; amount: number }[],
  selected: Set<string>,
): number {
  // Budget amounts are positive; transaction amounts may be signed (expenses
  // negative). Sum magnitudes so the filled budget and footer are positive.
  return txs.reduce((s, t) => (selected.has(t.id) ? s + Math.abs(t.amount) : s), 0);
}

// ─── Public interface ─────────────────────────────────────────────────────────

export interface BudgetTxPickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Category/subcategory the picked tx get assigned to. */
  targetCategoryId: string;
  targetCategoryName: string;
  currency: CurrencyCode;
  /** Sum of the picked (now-categorized) tx, to fill the budget amount. */
  onConfirm: (sum: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BudgetTxPickerSheet({
  open,
  onOpenChange,
  targetCategoryId,
  targetCategoryName,
  currency,
  onConfirm,
}: BudgetTxPickerSheetProps): React.JSX.Element {
  const [txs, setTxs] = useState<TransactionWithAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(false);

  // Load uncategorized transactions when the sheet opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelected(new Set());
    setSearch("");
    getUncategorizedTransactions()
      .then((data) => setTxs(data))
      .catch(() => toast.error("No se pudieron cargar las transacciones"))
      .finally(() => setLoading(false));
  }, [open]);

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = search
    ? txs.filter((t) => {
        const label = t.merchant_name ?? t.clean_description ?? t.raw_description ?? "";
        return label.toLowerCase().includes(search.toLowerCase());
      })
    : txs;

  const sum = sumSelectedTx(txs, selected);

  async function handleConfirm() {
    setConfirming(true);
    try {
      const chosen = txs.filter((t) => selected.has(t.id));
      const results = await Promise.all(
        chosen.map((t) => categorizeTransaction(t.id, targetCategoryId)),
      );
      const okIds = new Set(
        chosen.filter((_, i) => results[i].success).map((t) => t.id),
      );
      const failed = chosen.length - okIds.size;
      if (failed > 0) {
        toast.error(`No se pudieron categorizar ${failed} movimiento(s)`);
      }
      // Fill the budget only with value actually backed by categorized tx.
      if (okIds.size > 0) onConfirm(sumSelectedTx(chosen, okIds));
      onOpenChange(false);
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>Desde transacciones · {targetCategoryName}</DrawerTitle>
          <DrawerDescription>
            Selecciona los movimientos para calcular el presupuesto y categorizarlos.
          </DrawerDescription>
        </DrawerHeader>

        <div className="shrink-0 px-4 pb-2">
          <Input
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9"
          />
        </div>

        <DrawerBody safeArea={false} className={MOBILE_SHEET_SAFE_AREA_CLASS}>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Cargando movimientos...
            </p>
          )}

          {!loading && filtered.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search
                ? `Sin resultados para «${search}»`
                : "No hay movimientos sin categorizar."}
            </p>
          )}

          {!loading &&
            filtered.map((tx) => {
              const label =
                tx.merchant_name ?? tx.clean_description ?? tx.raw_description ?? "—";
              const isSelected = selected.has(tx.id);
              return (
                <TxRow
                  key={tx.id}
                  label={label}
                  date={tx.transaction_date}
                  amount={Math.abs(tx.amount)}
                  currency={currency}
                  isSelected={isSelected}
                  onToggle={() => toggleRow(tx.id)}
                />
              );
            })}
        </DrawerBody>

        <DrawerFooter>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={selected.size === 0 || confirming}
            className={cn(BRASS_BUTTON_CLASS, "w-full")}
          >
            {confirming
              ? "Asignando..."
              : `Asignar ${selected.size} · ${formatCurrency(sum, currency)}`}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function TxRow({
  label,
  date,
  amount,
  currency,
  isSelected,
  onToggle,
}: {
  label: string;
  date: string;
  amount: number;
  currency: CurrencyCode;
  isSelected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isSelected}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-z-brass/50",
        isSelected
          ? "bg-z-brass/10 ring-1 ring-z-brass/30"
          : "hover:bg-white/[0.03]",
      )}
    >
      {/* Checkbox indicator */}
      <div
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
          isSelected
            ? "border-z-brass bg-z-brass"
            : "border-white/20 bg-transparent",
        )}
        aria-hidden="true"
      >
        {isSelected && <Check className="size-3 text-z-ink" strokeWidth={3} />}
      </div>

      {/* Label + date */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{formatDate(date)}</p>
      </div>

      {/* Amount */}
      <p className="shrink-0 text-sm font-semibold tabular-nums text-z-expense">
        {formatCurrency(amount, currency)}
      </p>
    </button>
  );
}
