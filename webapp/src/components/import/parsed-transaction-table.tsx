"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { SlidersHorizontal, StickyNote, Tag, UserPlus, UserRound, Users } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RowEnrichmentPanel } from "./row-enrichment-panel";
import { cn } from "@/lib/utils";
import { BRASS_GHOST_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { CurrencyCode, CategoryWithChildren, ModoWithParticipants } from "@/types/domain";
import type { ParsedTransaction } from "@/types/import";
import type { RowEnrichment } from "@/lib/import/review-enrichment";

interface Props {
  transactions: ParsedTransaction[];
  currency: string;
  selected: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  categories?: CategoryWithChildren[];
  categoryMap?: Map<string, string | null>;
  stmtIdx?: number;
  onCategoryChange?: (txIdx: number, categoryId: string | null) => void;
  /** Keyed `${stmtIdx}-${txIdx}` → assigned destinatario (auto-matched or created here). */
  /**
   * Keys (`${stmtIdx}-${txIdx}`) whose category came from the rule engine rather
   * than a destinatario match or an explicit pick. Rendered with a "Sugerida"
   * marker so a 0.7-confidence guess is never mistaken for a confirmed choice.
   */
  suggestedKeys?: ReadonlySet<string>;
  destinatarioMap?: Map<string, { id: string; name: string }>;
  /** Open the seeded create form for a parsed row. */
  onCreateDestinatario?: (txIdx: number) => void;
  /** Per-row review decisions (viaje, compartido, etiquetas, nota), keyed `${stmtIdx}-${txIdx}`. */
  enrichmentMap?: Map<string, RowEnrichment>;
  /** Keys whose trip is the active-trip default rather than a pick. */
  defaultModoKeys?: ReadonlySet<string>;
  modos?: ModoWithParticipants[];
  onEnrichmentChange?: (txIdx: number, patch: Partial<RowEnrichment>) => void;
  onOpenShare?: (txIdx: number) => void;
  /** Rows to render (triage chip); omitted = all. */
  visibleIndices?: ReadonlySet<number>;
}

/** Compact marks for what a row will get at import: trip emoji, people, tags, note. */
function EnrichmentBadges({ value, modos }: { value: RowEnrichment | undefined; modos: ModoWithParticipants[] }) {
  if (!value) return null;
  const modo = value.modoId ? modos.find((m) => m.id === value.modoId) : null;
  const marks: React.ReactNode[] = [];
  if (modo) {
    marks.push(
      <span key="modo" className="inline-flex items-center gap-0.5 rounded-full bg-z-brass/12 px-1.5 py-0 text-[10px] font-medium text-z-brass" title={modo.name}>
        {modo.emoji ?? "✈️"} {modo.name}
      </span>,
    );
  }
  if (value.share && value.share.participants.length > 0) {
    marks.push(
      <span key="share" className="inline-flex items-center gap-0.5 text-[10px] text-z-brass" title="Compartido">
        <Users className="size-3" />
        {value.share.participants.length}
      </span>,
    );
  }
  if (value.tagIds.length > 0) {
    marks.push(
      <span key="tags" className="inline-flex items-center gap-0.5 text-[10px]" title="Etiquetas">
        <Tag className="size-3" />
        {value.tagIds.length}
      </span>,
    );
  }
  if (value.notes.trim()) {
    marks.push(
      <span key="note" className="inline-flex items-center text-[10px]" title="Nota">
        <StickyNote className="size-3" />
      </span>,
    );
  }
  if (marks.length === 0) return null;
  return <span className="inline-flex flex-wrap items-center gap-1.5">{marks}</span>;
}

/**
 * Desktop "Más" cell: the enrichment panel in a popover. Controlled so the
 * popover closes before "Compartir con…" opens the share sheet — otherwise the
 * popover tier (above modal by design) would float over the sheet.
 */
function DesktopMoreCell({
  description,
  direction,
  enrichment,
  isDefaultModo,
  modos,
  onChange,
  onOpenShare,
}: {
  description: string;
  direction: "INFLOW" | "OUTFLOW";
  enrichment: RowEnrichment;
  isDefaultModo: boolean;
  modos: ModoWithParticipants[];
  onChange: (patch: Partial<RowEnrichment>) => void;
  onOpenShare: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = !!(enrichment.modoId || enrichment.share || enrichment.tagIds.length || enrichment.notes.trim());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Más opciones para ${description}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors",
            active ? BRASS_GHOST_BUTTON_CLASS : GHOST_BUTTON_CLASS,
          )}
        >
          <SlidersHorizontal className="size-3.5" />
          <EnrichmentBadges value={enrichment} modos={modos} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px]">
        <RowEnrichmentPanel
          value={enrichment}
          isDefaultModo={isDefaultModo}
          direction={direction}
          modos={modos}
          onChange={onChange}
          onOpenShare={() => {
            setOpen(false);
            onOpenShare();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/** A row's assigned-destinatario chip, or a "create" button when unassigned. */
function DestinatarioCell({
  name,
  onCreate,
}: {
  name: string | null;
  onCreate: () => void;
}) {
  if (name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-z-brass/12 px-2 py-0.5 text-[11px] font-medium text-z-brass">
        <UserRound className="size-3" />
        {name}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onCreate}
      className="inline-flex items-center gap-1 rounded-full border border-white/6 bg-white/[0.03] px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-z-brass"
    >
      <UserPlus className="size-3" />
      Destinatario
    </button>
  );
}

function getCategoryName(
  categoryId: string | null,
  categories: CategoryWithChildren[]
): string | null {
  if (!categoryId) return null;
  for (const cat of categories) {
    if (cat.id === categoryId) return cat.name;
    for (const child of cat.children) {
      if (child.id === categoryId) return child.name;
    }
  }
  return null;
}

function InstallmentLabel({ tx }: { tx: ParsedTransaction }) {
  if (tx.installment_current == null) return null;
  const label =
    tx.installment_total != null
      ? `${tx.installment_current}/${tx.installment_total}`
      : `${tx.installment_current}/?`;
  return <span>{label}</span>;
}

function MobileList({
  transactions,
  currency,
  selected,
  onToggle,
  onToggleAll,
  categories,
  categoryMap,
  stmtIdx,
  onCategoryChange,
  suggestedKeys,
  destinatarioMap,
  onCreateDestinatario,
  enrichmentMap,
  defaultModoKeys,
  modos,
  onEnrichmentChange,
  onOpenShare,
  visibleIndices,
}: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const allSelected =
    transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0 && !allSelected;
  const showCategories =
    categories && categoryMap && stmtIdx !== undefined && onCategoryChange;
  const showDestinatarios =
    destinatarioMap && stmtIdx !== undefined && onCreateDestinatario;
  const showEnrichment =
    enrichmentMap && stmtIdx !== undefined && onEnrichmentChange && onOpenShare;
  const visibleCount = visibleIndices ? visibleIndices.size : transactions.length;

  return (
    <div className="rounded-md border sm:hidden">
      {/* Select all bar */}
      <div className="flex items-center gap-2.5 border-b bg-muted/50 px-3 py-2">
        <Checkbox
          checked={someSelected ? "indeterminate" : allSelected}
          onCheckedChange={onToggleAll}
          aria-label="Seleccionar todas"
        />
        <span className="text-xs text-muted-foreground">
          {visibleIndices && visibleCount !== transactions.length
            ? `${visibleCount} visibles · ${selected.size} de ${transactions.length} seleccionadas`
            : `${selected.size} de ${transactions.length} seleccionadas`}
        </span>
      </div>

      {/* Transaction rows */}
      <div className="divide-y">
        {visibleIndices && visibleCount === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nada con este filtro.</p>
        )}
        {transactions.map((tx, i) => {
          if (visibleIndices && !visibleIndices.has(i)) return null;
          const isSelected = selected.has(i);
          const enrichment = showEnrichment ? enrichmentMap.get(`${stmtIdx}-${i}`) : undefined;
          const isExpanded = expandedIdx === i;
          const catId = showCategories
            ? categoryMap.get(`${stmtIdx}-${i}`) ?? null
            : null;
          const catName = showCategories
            ? getCategoryName(catId, categories)
            : null;

          return (
            <div
              key={i}
              className={isSelected ? "" : "opacity-50"}
            >
              <div className="flex gap-2.5 px-3 py-2.5 items-start">
                {/* Checkbox */}
                <div className="pt-0.5">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggle(i)}
                    aria-label={`Seleccionar ${tx.description}`}
                  />
                </div>

                {/* Row body — tap to expand */}
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  {/* Line 1: description + amount */}
                  <div className="flex justify-between items-baseline gap-2">
                    <span className="text-sm font-medium truncate">
                      {tx.description}
                    </span>
                    <span
                      className={`text-sm font-semibold whitespace-nowrap ${
                        tx.direction === "INFLOW"
                          ? "text-z-income"
                          : "text-z-debt"
                      }`}
                    >
                      {tx.direction === "INFLOW" ? "+" : "-"}
                      {formatCurrency(tx.amount, currency as CurrencyCode)}
                    </span>
                  </div>

                  {/* Line 2: date · category · installments */}
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                    <span>{formatDate(tx.date)}</span>
                    {catName && (
                      <>
                        <span>·</span>
                        <Badge
                          variant={suggestedKeys?.has(`${stmtIdx}-${i}`) ? "outline" : "secondary"}
                          className="px-1.5 py-0 text-[10px] font-normal"
                        >
                          {catName}
                        </Badge>
                        {suggestedKeys?.has(`${stmtIdx}-${i}`) && (
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            Sugerida
                          </span>
                        )}
                      </>
                    )}
                    {tx.installment_current != null && (
                      <>
                        <span>·</span>
                        <InstallmentLabel tx={tx} />
                      </>
                    )}
                  </div>
                  {enrichment && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      <EnrichmentBadges value={enrichment} modos={modos ?? []} />
                    </div>
                  )}
                </button>
              </div>

              {/* Expanded area */}
              {isExpanded && (
                <div className="bg-muted/30 px-3 pb-3 pt-1 ml-8">
                  {tx.original_amount != null &&
                    tx.original_amount !== tx.amount && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Compra total:{" "}
                        {formatCurrency(
                          tx.original_amount,
                          currency as CurrencyCode
                        )}
                      </p>
                    )}
                  {showCategories && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Categoría:
                      </span>
                      <CategoryZonePicker
                        variant="popover"
                        categories={categories}
                        value={catId}
                        onValueChange={(v) => onCategoryChange(i, v)}
                        direction={tx.direction}
                        triggerClassName="h-8 text-xs flex-1"
                      />
                    </div>
                  )}
                  {showDestinatarios && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        Destinatario:
                      </span>
                      <DestinatarioCell
                        name={destinatarioMap.get(`${stmtIdx}-${i}`)?.name ?? null}
                        onCreate={() => onCreateDestinatario(i)}
                      />
                    </div>
                  )}
                  {showEnrichment && enrichment && (
                    <RowEnrichmentPanel
                      className="mt-3 border-t border-white/6 pt-3"
                      value={enrichment}
                      isDefaultModo={defaultModoKeys?.has(`${stmtIdx}-${i}`) ?? false}
                      direction={tx.direction}
                      modos={modos ?? []}
                      onChange={(patch) => onEnrichmentChange(i, patch)}
                      onOpenShare={() => onOpenShare(i)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DesktopTable({
  transactions,
  currency,
  selected,
  onToggle,
  onToggleAll,
  categories,
  categoryMap,
  stmtIdx,
  onCategoryChange,
  suggestedKeys,
  destinatarioMap,
  onCreateDestinatario,
  enrichmentMap,
  defaultModoKeys,
  modos,
  onEnrichmentChange,
  onOpenShare,
  visibleIndices,
}: Props) {
  const allSelected =
    transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0 && !allSelected;
  const showCategories =
    categories && categoryMap && stmtIdx !== undefined && onCategoryChange;
  const showDestinatarios =
    destinatarioMap && stmtIdx !== undefined && onCreateDestinatario;
  const showEnrichment =
    enrichmentMap && stmtIdx !== undefined && onEnrichmentChange && onOpenShare;

  return (
    <div className="hidden sm:block rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={someSelected ? "indeterminate" : allSelected}
                onCheckedChange={onToggleAll}
                aria-label="Seleccionar todas"
              />
            </TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Descripción</TableHead>
            {showCategories && <TableHead>Categoría</TableHead>}
            {showDestinatarios && <TableHead>Destinatario</TableHead>}
            <TableHead>Tipo</TableHead>
            <TableHead>Cuotas</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            {showEnrichment && <TableHead className="w-10">Más</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleIndices && visibleIndices.size === 0 && (
            <TableRow>
              <TableCell
                colSpan={5 + (showCategories ? 1 : 0) + (showDestinatarios ? 1 : 0) + (showEnrichment ? 1 : 0)}
                className="py-6 text-center text-xs text-muted-foreground"
              >
                Nada con este filtro.
              </TableCell>
            </TableRow>
          )}
          {transactions.map((tx, i) => {
            if (visibleIndices && !visibleIndices.has(i)) return null;
            const catId = showCategories
              ? categoryMap.get(`${stmtIdx}-${i}`) ?? null
              : null;
            const enrichment = showEnrichment ? enrichmentMap.get(`${stmtIdx}-${i}`) : undefined;

            return (
              <TableRow
                key={i}
                className={selected.has(i) ? "" : "opacity-50"}
              >
                <TableCell>
                  <Checkbox
                    checked={selected.has(i)}
                    onCheckedChange={() => onToggle(i)}
                    aria-label={`Seleccionar ${tx.description}`}
                  />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {tx.date}
                </TableCell>
                <TableCell className="text-sm max-w-[200px] lg:max-w-[400px] truncate">
                  {tx.description}
                </TableCell>
                {showCategories && (
                  <TableCell>
                    <CategoryZonePicker
                      variant="popover"
                      categories={categories}
                      value={catId}
                      onValueChange={(v) => onCategoryChange(i, v)}
                      direction={tx.direction}
                      triggerClassName="w-full sm:w-[180px] h-8 text-xs"
                    />
                    {suggestedKeys?.has(`${stmtIdx}-${i}`) && (
                      <span className="mt-0.5 block text-[10px] text-muted-foreground">
                        Sugerida
                      </span>
                    )}
                  </TableCell>
                )}
                {showDestinatarios && (
                  <TableCell>
                    <DestinatarioCell
                      name={destinatarioMap.get(`${stmtIdx}-${i}`)?.name ?? null}
                      onCreate={() => onCreateDestinatario(i)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant={
                      tx.direction === "INFLOW" ? "default" : "secondary"
                    }
                    className="text-xs"
                  >
                    {tx.direction === "INFLOW" ? "Ingreso" : "Gasto"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  <InstallmentLabel tx={tx} />
                </TableCell>
                <TableCell className="text-right whitespace-nowrap font-medium text-sm">
                  <span
                    className={
                      tx.direction === "INFLOW"
                        ? "text-z-income"
                        : "text-z-debt"
                    }
                  >
                    {tx.direction === "INFLOW" ? "+" : "-"}
                    {formatCurrency(tx.amount, currency as CurrencyCode)}
                  </span>
                  {tx.original_amount != null &&
                    tx.original_amount !== tx.amount && (
                      <p className="text-xs text-muted-foreground">
                        Compra:{" "}
                        {formatCurrency(
                          tx.original_amount,
                          currency as CurrencyCode
                        )}
                      </p>
                    )}
                </TableCell>
                {showEnrichment && enrichment && (
                  <TableCell>
                    <DesktopMoreCell
                      description={tx.description}
                      direction={tx.direction}
                      enrichment={enrichment}
                      isDefaultModo={defaultModoKeys?.has(`${stmtIdx}-${i}`) ?? false}
                      modos={modos ?? []}
                      onChange={(patch) => onEnrichmentChange(i, patch)}
                      onOpenShare={() => onOpenShare(i)}
                    />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ParsedTransactionTable(props: Props) {
  return (
    <>
      <MobileList {...props} />
      <DesktopTable {...props} />
    </>
  );
}
