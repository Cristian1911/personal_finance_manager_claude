"use client";

import { useMemo, useTransition } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { toggleExcludeTransaction } from "@/actions/transactions";
import { categorizeTransaction } from "@/actions/categorize";
import { toast } from "sonner";
import type { Transaction, Category, CategoryWithChildren } from "@/types/domain";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, FileText } from "lucide-react";
import { flattenCategories } from "@/lib/utils/categories";

export function TransactionTable({
  transactions,
  categories,
}: {
  transactions: Transaction[];
  categories: CategoryWithChildren[];
}) {
  const categoryMap = useMemo(() => {
    const flat = flattenCategories(categories);
    const map = new Map<string, Category>();
    for (const cat of flat) {
      map.set(cat.id, cat);
    }
    return map;
  }, [categories]);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="size-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-1">Sin transacciones</p>
        <p className="text-sm text-muted-foreground mb-4">
          Importa un extracto PDF o registra tu primer movimiento.
        </p>
        <div className="flex gap-2">
          <Link href="/import">
            <Button size="sm" variant="default">Importar extracto</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {transactions.map((tx) => (
          <MobileTransactionCard key={tx.id} tx={tx} categoryMap={categoryMap} />
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Monto</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TransactionRow key={tx.id} tx={tx} categories={categories} />
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}

function MobileTransactionCard({
  tx,
  categoryMap,
}: {
  tx: Transaction;
  categoryMap: Map<string, Category>;
}) {
  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripción";
  const category = tx.category_id ? categoryMap.get(tx.category_id) : null;

  return (
    <Link href={`/transactions/${tx.id}`}>
      <div
        className={cn("flex items-center gap-3 rounded-lg border p-3", tx.is_excluded && "opacity-40")}
      >
        <div className="shrink-0">
          {tx.direction === "INFLOW" ? (
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          ) : (
            <ArrowUpRight className="h-4 w-4 text-orange-500" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{description}</p>
          <p className="text-xs text-muted-foreground">
            {category && (
              <>
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full align-middle mr-1"
                  style={{ backgroundColor: category.color }}
                />
                <span>{category.name_es ?? category.name}</span>
                {" · "}
              </>
            )}
            {formatDate(tx.transaction_date)}
            {tx.status !== "POSTED" && (
              <span>
                {" · "}
                {tx.status === "PENDING" ? "Pendiente" : "Cancelada"}
              </span>
            )}
            {tx.is_excluded && <span> · Excluida</span>}
          </p>
        </div>
        <span
          className={cn("text-sm font-semibold shrink-0", tx.direction === "INFLOW" && "text-green-600", tx.is_excluded && "line-through")}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </div>
    </Link>
  );
}

function TransactionRow({
  tx,
  categories,
}: {
  tx: Transaction;
  categories: CategoryWithChildren[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleToggleExclude() {
    startTransition(async () => {
      await toggleExcludeTransaction(tx.id, !tx.is_excluded);
    });
  }

  return (
    <TableRow
      className={`cursor-pointer ${tx.is_excluded ? "opacity-40" : ""}`}
    >
      <TableCell>
        {tx.direction === "INFLOW" ? (
          <ArrowDownLeft className="h-4 w-4 text-green-500" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-orange-500" />
        )}
      </TableCell>
      <TableCell>
        <Link
          href={`/transactions/${tx.id}`}
          className="hover:underline"
        >
          <p className="font-medium text-sm">
            {tx.merchant_name ||
              tx.clean_description ||
              tx.raw_description ||
              "Sin descripción"}
          </p>
        </Link>
      </TableCell>
      <TableCell>
        <InlineCategoryEdit tx={tx} categories={categories} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(tx.transaction_date)}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Badge
            variant={tx.status === "POSTED" ? "secondary" : "outline"}
            className="text-xs"
          >
            {tx.status === "POSTED"
              ? "Confirmada"
              : tx.status === "PENDING"
                ? "Pendiente"
                : "Cancelada"}
          </Badge>
          {tx.is_excluded && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Excluida
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span
          className={`font-medium ${tx.direction === "INFLOW" ? "text-green-600" : ""} ${tx.is_excluded ? "line-through" : ""}`}
        >
          {tx.direction === "INFLOW" ? "+" : "-"}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </TableCell>
      <TableCell>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleExclude}
                disabled={isPending}
              >
                {tx.is_excluded ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {tx.is_excluded
                ? "Incluir en cálculos"
                : "Excluir de cálculos"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </TableCell>
    </TableRow>
  );
}

function InlineCategoryEdit({
  tx,
  categories,
}: {
  tx: Transaction;
  categories: CategoryWithChildren[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(categoryId: string | null) {
    if (!categoryId) return;
    startTransition(async () => {
      const result = await categorizeTransaction(tx.id, categoryId);
      if (result?.success) {
        toast.success("Categoría actualizada");
      } else if (result && !result.success) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className={cn(isPending && "opacity-50 pointer-events-none")}>
      <CategoryCombobox
        categories={categories}
        value={tx.category_id ?? null}
        onValueChange={handleChange}
        direction={tx.direction as "INFLOW" | "OUTFLOW" | undefined}
        placeholder="Sin categoría"
        triggerClassName="h-7 text-xs px-2 w-auto max-w-[180px] border-dashed"
      />
    </div>
  );
}
