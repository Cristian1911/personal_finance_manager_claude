"use client";

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
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type { ParsedTransaction } from "@/types/import";

export function ParsedTransactionTable({
  transactions,
  currency,
  selected,
  onToggle,
  onToggleAll,
  categories,
  categoryMap,
  stmtIdx,
  onCategoryChange,
}: {
  transactions: ParsedTransaction[];
  currency: string;
  selected: Set<number>;
  onToggle: (index: number) => void;
  onToggleAll: () => void;
  categories?: CategoryWithChildren[];
  categoryMap?: Map<string, string | null>;
  stmtIdx?: number;
  onCategoryChange?: (txIdx: number, categoryId: string | null) => void;
}) {
  const allSelected =
    transactions.length > 0 && selected.size === transactions.length;
  const someSelected = selected.size > 0 && !allSelected;
  const showCategories = categories && categoryMap && stmtIdx !== undefined && onCategoryChange;

  return (
    <div className="rounded-md border overflow-x-auto">
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
                <TableCell className="text-sm max-w-[300px] truncate">
                  {tx.description}
                </TableCell>
                {showCategories && (
                  <TableCell>
                    <CategoryCombobox
                      categories={categories}
                      value={catId}
                      onValueChange={(v) => onCategoryChange(i, v)}
                      direction={tx.direction}
                      triggerClassName="w-[180px] h-8 text-xs"
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
                  {tx.installment_current != null && tx.installment_total != null
                    ? `${tx.installment_current}/${tx.installment_total}`
                    : tx.installment_current != null
                      ? `${tx.installment_current}/?`
                      : null}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap font-medium text-sm">
                  <span
                    className={
                      tx.direction === "INFLOW"
                        ? "text-emerald-600"
                        : "text-red-600"
                    }
                  >
                    {tx.direction === "INFLOW" ? "+" : "-"}
                    {formatCurrency(tx.amount, currency as CurrencyCode)}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
