"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { CategoryHierarchyNode, CategoryTrend } from "@zeta/shared";
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

/** Nested guide line for expanded (subcategory / transaction) content. */
const NEST_GUIDE_CLASS = "ml-2 border-l border-white/6 pl-3";

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const max = Math.max(...points, 1);
  const w = 56;
  const h = 18;
  const d = points
    .map((p, i) => `${(i / Math.max(points.length - 1, 1)) * w},${h - (p / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <polyline points={d} fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}

interface RowChromeProps {
  open: boolean;
  onToggle: () => void;
  color: string;
  name: string;
  total: number;
  currency: CurrencyCode;
  /** Optional sparkline/delta trend (own-spend series); only shown for leaf rows. */
  trend?: CategoryTrend;
}

/** Shared clickable header used by both parent and leaf rows. */
function RowHeader({ open, onToggle, color, name, total, currency, trend }: RowChromeProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={ROW_EXPAND_TRIGGER_CLASS}
    >
      <ChevronDown
        className={cn("size-4 shrink-0 text-z-sage-dark transition-transform", open && "rotate-180")}
      />
      <span className="size-2.5 shrink-0 rounded" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      {trend && (
        <span className="hidden shrink-0 sm:block">
          <Sparkline points={trend.monthly} color={color} />
        </span>
      )}
      <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(total, currency)}</span>
      {trend && trend.momPct != null && <DeltaChip pct={trend.momPct} />}
    </button>
  );
}

interface LeafRowProps {
  categoryId: string;
  name: string;
  color: string;
  total: number;
  trend?: CategoryTrend;
  currency: CurrencyCode;
  windowFrom: string;
  windowTo: string;
}

/** A drillable row: subcategory, childless parent, or the synthetic "(directo)" leaf. */
function LeafRow({ categoryId, name, color, total, trend, currency, windowFrom, windowTo }: LeafRowProps) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);
  const toggle = () => {
    setOpen((o) => !o);
    setEverOpened(true);
  };
  return (
    <div>
      <RowHeader
        open={open}
        onToggle={toggle}
        color={color}
        name={name}
        total={total}
        currency={currency}
        trend={trend}
      />
      <Expand open={open}>
        <div className={cn(NEST_GUIDE_CLASS, "pb-2")}>
          {everOpened && (
            <DrilldownTransactions
              categoryId={categoryId}
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

interface ParentRowProps {
  node: CategoryHierarchyNode;
  nodeById: ReadonlyMap<string, CategoryHierarchyNode>;
  trendById: ReadonlyMap<string, CategoryTrend>;
  currency: CurrencyCode;
  windowFrom: string;
  windowTo: string;
}

/** A parent with subcategory children: expands to subtotal leaves (no fetch). */
function ParentRow({ node, nodeById, trendById, currency, windowFrom, windowTo }: ParentRowProps) {
  const [open, setOpen] = useState(false);
  const children = node.childIds
    .map((id) => nodeById.get(id))
    .filter((n): n is CategoryHierarchyNode => n != null);
  return (
    <div>
      <RowHeader
        open={open}
        onToggle={() => setOpen((o) => !o)}
        color={node.color}
        name={node.nameEs}
        total={node.rolledTotal}
        currency={currency}
      />
      <Expand open={open}>
        <div className={NEST_GUIDE_CLASS}>
          {children.map((child) => (
            <div key={child.id} className="border-t border-white/6 first:border-t-0">
              <LeafRow
                categoryId={child.id}
                name={child.nameEs}
                color={child.color}
                total={child.ownTotal}
                trend={trendById.get(child.id)}
                currency={currency}
                windowFrom={windowFrom}
                windowTo={windowTo}
              />
            </div>
          ))}
          {node.ownTotal > 0 && (
            <div className="border-t border-white/6 first:border-t-0">
              <LeafRow
                categoryId={node.id}
                name={`${node.nameEs} (directo)`}
                color={node.color}
                total={node.ownTotal}
                trend={trendById.get(node.id)}
                currency={currency}
                windowFrom={windowFrom}
                windowTo={windowTo}
              />
            </div>
          )}
        </div>
      </Expand>
    </div>
  );
}

export interface CategoryTrendListProps {
  /** Flat parent+leaf breakdown (windowed totals) — `vm.gastos.categoryHierarchy`. */
  hierarchy: CategoryHierarchyNode[];
  /** Top-N own-spend trends — `vm.gastos.categories` — used for sparkline/MoM on leaves. */
  trends: CategoryTrend[];
  currency: CurrencyCode;
  /** Active period window (YYYY-MM-DD inclusive) — `vm.windowFrom` / `vm.windowTo`. */
  windowFrom: string;
  windowTo: string;
}

export function CategoryTrendList({
  hierarchy,
  trends,
  currency,
  windowFrom,
  windowTo,
}: CategoryTrendListProps) {
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const nodeById = useMemo(() => new Map(hierarchy.map((n) => [n.id, n])), [hierarchy]);
  const trendById = useMemo(() => new Map(trends.map((t) => [t.categoryId, t])), [trends]);
  const topLevel = useMemo(() => hierarchy.filter((n) => n.parentId === null), [hierarchy]);
  const foldedNames = useMemo(() => hierarchy.map((n) => fold(n.nameEs)), [hierarchy]);

  const folded = useMemo(() => fold(query.trim()), [query]);
  const searching = folded.length > 0;

  const rows = useMemo(() => {
    if (searching) return hierarchy.filter((_, i) => foldedNames[i].includes(folded));
    return showAll ? topLevel : topLevel.slice(0, DEFAULT_VISIBLE);
  }, [searching, folded, hierarchy, foldedNames, topLevel, showAll]);

  if (hierarchy.length === 0) {
    return (
      <div className={`${PANEL_SURFACE_CLASS} p-6 text-center text-sm text-z-sage-dark`}>
        Sin gastos categorizados en el periodo.
      </div>
    );
  }

  const hiddenCount = topLevel.length - DEFAULT_VISIBLE;

  return (
    <div className={`${PANEL_SURFACE_CLASS} p-4`}>
      <p className="mb-3 text-sm font-semibold">Gasto por categoría</p>

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
          placeholder="Buscar categoría..."
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-z-sage-dark focus:outline-none"
        />
      </label>

      {rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-z-sage-dark">Sin resultados</p>
      ) : (
        rows.map((node) => (
          <div key={node.id} className="border-t border-white/6 first:border-t-0">
            {node.childIds.length > 0 ? (
              <ParentRow
                node={node}
                nodeById={nodeById}
                trendById={trendById}
                currency={currency}
                windowFrom={windowFrom}
                windowTo={windowTo}
              />
            ) : (
              <LeafRow
                categoryId={node.id}
                name={node.nameEs}
                color={node.color}
                total={node.rolledTotal}
                trend={trendById.get(node.id)}
                currency={currency}
                windowFrom={windowFrom}
                windowTo={windowTo}
              />
            )}
          </div>
        ))
      )}

      {!searching && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
          className={INLINE_EXPAND_TOGGLE_CLASS}
        >
          {showAll ? "Ver menos" : `Ver todas (${topLevel.length})`}
          <ChevronDown className={cn("size-3 transition-transform", showAll && "rotate-180")} />
        </button>
      )}
    </div>
  );
}
