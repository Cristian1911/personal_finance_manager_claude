"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode, Category } from "@/types/domain";
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
  categories?: Category[];
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
            <TableHead className="text-right">Monto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx, i) => {
            const catId = showCategories
              ? categoryMap.get(`${stmtIdx}-${i}`) ?? null
              : null;

            // Filter categories by direction
            const filteredCategories = categories?.filter(
              (cat) => !cat.direction || cat.direction === tx.direction
            );

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
                    <Select
                      value={catId ?? "none"}
                      onValueChange={(v) =>
                        onCategoryChange(i, v === "none" ? null : v)
                      }
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue placeholder="Sin categoría" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin categoría</SelectItem>
                        {filteredCategories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ backgroundColor: cat.color }}
                              />
                              {cat.name_es ?? cat.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
