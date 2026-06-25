"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

/**
 * Collapsible "settled" group for the living timeline — confirmed income or
 * paid expenses fold into a single summary bar (collapsed by default) so the
 * board only foregrounds what's still actionable.
 */
export function SettledGroup({
  count,
  total,
  currency,
  noun,
  caption,
  defaultOpen = false,
  children,
}: {
  count: number;
  total: number;
  currency: CurrencyCode;
  /** e.g. "confirmados" / "pagados" */
  noun: string;
  /** e.g. "ya en el saldo" / "ya descontados" */
  caption: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="flex flex-col gap-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/10 bg-white/[0.015] p-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-z-income/12 text-z-income">
          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold tabular-nums text-z-white">
            {count} {noun} · {formatCurrency(total, currency)}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {caption}
          </span>
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {open ? "ocultar" : "mostrar"}
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>
      {open && <div className="flex flex-col gap-2.5">{children}</div>}
    </div>
  );
}
