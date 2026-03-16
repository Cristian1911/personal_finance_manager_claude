"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CategoryCombobox } from "@/components/ui/category-combobox";
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
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type { ParsedTransaction } from "@/types/import";

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
}: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const allSelected =
    transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0 && !allSelected;
  const showCategories =
    categories && categoryMap && stmtIdx !== undefined && onCategoryChange;

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
          {selected.size} de {transactions.length} seleccionadas
        </span>
      </div>

      {/* Transaction rows */}
      <div className="divide-y">
        {transactions.map((tx, i) => {
          const isSelected = selected.has(i);
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
                        <span className="rounded bg-muted px-1.5 py-px">
                          {catName}
                        </span>
                      </>
                    )}
                    {tx.installment_current != null && (
                      <>
                        <span>·</span>
                        <InstallmentLabel tx={tx} />
                      </>
                    )}
                  </div>
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
                      <CategoryCombobox
                        categories={categories}
                        value={catId}
                        onValueChange={(v) => onCategoryChange(i, v)}
                        direction={tx.direction}
                        triggerClassName="h-8 text-xs flex-1"
                      />
                    </div>
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
}: Props) {
  const allSelected =
    transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0 && !allSelected;
  const showCategories =
    categories && categoryMap && stmtIdx !== undefined && onCategoryChange;

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
            <TableHead>Tipo</TableHead>
            <TableHead>Cuotas</TableHead>
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx, i) => {
            const catId = showCategories
              ? categoryMap.get(`${stmtIdx}-${i}`) ?? null
              : null;

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
                    <CategoryCombobox
                      categories={categories}
                      value={catId}
                      onValueChange={(v) => onCategoryChange(i, v)}
                      direction={tx.direction}
                      triggerClassName="w-full sm:w-[180px] h-8 text-xs"
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
