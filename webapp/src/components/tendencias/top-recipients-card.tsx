"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { RecipientRank } from "@zeta/shared";
import { formatCurrency } from "@/lib/utils/currency";
import {
  INLINE_EXPAND_TOGGLE_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  ROW_EXPAND_TRIGGER_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/domain";
import { DeltaChip } from "./delta-chip";
import { Expand } from "@/components/mobile/v2/expand";
import { DrilldownTransactions } from "./drilldown-transactions";

const DEFAULT_VISIBLE = 8;

/** Accent- + case-insensitive fold for the client search filter. */
function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Nested guide line for expanded (transaction) content. */
const NEST_GUIDE_CLASS = "ml-2 border-l border-white/6 pl-3";

interface RecipientRowProps {
  r: RecipientRank;
  max: number;
  currency: CurrencyCode;
  windowFrom: string;
  windowTo: string;
}

function RecipientRow({ r, max, currency, windowFrom, windowTo }: RecipientRowProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  // "Sin asignar" (null id) has no drill target — render it non-expandable.
  const expandable = r.destinatarioId !== null;

  const toggle = () => {
    setOpen((o) => !o);
    setEverOpened(true);
  };

  const inner = (
    <>
      {expandable ? (
        <ChevronDown
          className={cn("size-4 shrink-0 text-z-sage-dark transition-transform", open && "rotate-180")}
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden />
      )}
      <span
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-z-ink"
        style={{ background: r.color }}
      >
        {r.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
          <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(r.total, currency)}</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
          <div className="h-full rounded-full" style={{ width: `${(r.total / max) * 100}%`, background: r.color }} />
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[11px] text-z-sage-dark">{r.count} mov.</span>
          {r.momPct !== null && <DeltaChip pct={r.momPct} />}
        </div>
      </div>
    </>
  );

  if (!expandable) {
    return <div className="flex items-center gap-2.5 py-2.5">{inner}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={ROW_EXPAND_TRIGGER_CLASS}
      >
        {inner}
      </button>
      <Expand open={open}>
        <div className={cn(NEST_GUIDE_CLASS, "pb-2")}>
          {everOpened && (
            <DrilldownTransactions
              destinatarioId={r.destinatarioId ?? undefined}
              dateFrom={windowFrom}
              dateTo={windowTo}
              currency={currency}
            />
          )}
        </div>
      </Expand>
    </div>
  );
}

export interface TopRecipientsCardProps {
  /** Full ranked recipient list — `vm.gastos.recipientsFull`. */
  recipients: RecipientRank[];
  currency: CurrencyCode;
  /** Active period window (YYYY-MM-DD inclusive) — `vm.windowFrom` / `vm.windowTo`. */
  windowFrom: string;
  windowTo: string;
}

export function TopRecipientsCard({ recipients, currency, windowFrom, windowTo }: TopRecipientsCardProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const max = useMemo(() => Math.max(...recipients.map((r) => r.total), 1), [recipients]);

  const folded = useMemo(() => fold(query.trim()), [query]);
  const foldedNames = useMemo(() => recipients.map((r) => fold(r.name)), [recipients]);
  const searching = folded.length > 0;

  const rows = useMemo(() => {
    if (searching) return recipients.filter((_, i) => foldedNames[i].includes(folded));
    return showAll ? recipients : recipients.slice(0, DEFAULT_VISIBLE);
  }, [searching, folded, foldedNames, recipients, showAll]);

  if (recipients.length === 0) return null;

  const hiddenCount = recipients.length - DEFAULT_VISIBLE;

  return (
    <div className={`mt-3 ${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">¿A dónde va? · Destinatarios</p>

      <label
        className={cn(
          PANEL_INSET_CLASS,
          "mb-1 flex items-center gap-2 px-3 py-2 transition-colors focus-within:border-z-brass/40"
        )}
      >
        <Search className="size-4 shrink-0 text-z-sage-dark" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar destinatario..."
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-z-sage-dark focus:outline-none"
        />
      </label>

      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-z-sage-dark">Sin resultados</p>
      ) : (
        rows.map((r) => (
          <div key={r.destinatarioId ?? "none"} className="border-t border-white/6 first:border-t-0">
            <RecipientRow
              r={r}
              max={max}
              currency={currency}
              windowFrom={windowFrom}
              windowTo={windowTo}
            />
          </div>
        ))
      )}

      {!searching && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className={INLINE_EXPAND_TOGGLE_CLASS}
        >
          {showAll ? "Ver menos" : `Ver todas (${recipients.length})`}
          <ChevronDown className={cn("size-3 transition-transform", showAll && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
