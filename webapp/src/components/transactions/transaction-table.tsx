"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateTime } from "@/lib/utils/date";
import { toggleExcludeTransaction } from "@/actions/transactions";
import { categorizeTransaction, uncategorizeTransaction, assignDestinatario } from "@/actions/categorize";
import { DestinatarioCreateDialog } from "@/components/destinatarios/destinatario-create-form";
import { toast } from "sonner";
import type { TransactionWithAccount, Category, CategoryWithChildren, CurrencyCode } from "@/types/domain";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, FileUp, Inbox, Plus, UserPlus } from "lucide-react";
import { flattenCategories } from "@/lib/utils/categories";
import { EmptyState } from "@/components/ui/empty-state";

export function TransactionTable({
  transactions,
  categories,
}: {
  transactions: TransactionWithAccount[];
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
      <EmptyState
        icon={<Inbox className="size-6" strokeWidth={1.5} />}
        title="Todavía no hay movimientos"
        description="Sube un extracto y aparecen en segundos. Detectamos el banco automáticamente."
        primary={{ label: "Importar extracto", href: "/import", icon: <FileUp className="size-4" strokeWidth={1.5} /> }}
        secondary={{ label: "Agregar a mano", href: "/transactions/new", icon: <Plus className="size-4" strokeWidth={1.5} /> }}
      />
    );
  }

  return (
    <>
      {/* Mobile: card layout */}
      <div className="sm:hidden space-y-2">
        {transactions.map((tx) => (
          <MobileTransactionCard key={tx.id} tx={tx} categoryMap={categoryMap} categories={categories} />
        ))}
      </div>

      {/* Desktop: table layout */}
      <div className="hidden sm:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cuenta</TableHead>
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

/** Row action: create a destinatario seeded from this transaction, then assign
 *  it. Only rendered when the transaction has no destinatario yet. */
function CreateDestinatarioAction({
  tx,
  categories,
  className,
}: {
  tx: TransactionWithAccount;
  categories: CategoryWithChildren[];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (tx.destinatario_id) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Crear destinatario"
        title="Crear destinatario"
        className={cn(
          "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-z-brass",
          className,
        )}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <UserPlus className="size-4" />
      </button>
      {open && (
        <DestinatarioCreateDialog
          open={open}
          onOpenChange={setOpen}
          categories={categories}
          rawDescription={tx.raw_description}
          merchantName={tx.merchant_name}
          amount={tx.amount}
          currencyCode={tx.currency_code as CurrencyCode}
          onCreated={(d) => {
            setOpen(false);
            startTransition(async () => {
              const result = await assignDestinatario(tx.id, d.id);
              if (result.success) {
                toast.success(`Destinatario "${d.name}" creado y asignado`);
                router.refresh();
              } else {
                toast.error(result.error ?? "No se pudo asignar el destinatario");
              }
            });
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MobileTransactionCard({
  tx,
  categoryMap,
  categories,
}: {
  tx: TransactionWithAccount;
  categoryMap: Map<string, Category>;
  categories: CategoryWithChildren[];
}) {
  const description =
    tx.merchant_name ||
    tx.clean_description ||
    tx.raw_description ||
    "Sin descripción";
  const category = tx.category_id ? categoryMap.get(tx.category_id) : null;

  return (
    <div
      className={cn("flex items-center gap-3 rounded-lg border p-3", tx.is_excluded && "opacity-40")}
    >
      <Link
        href={`/transactions/${tx.id}`}
        className="flex min-w-0 flex-1 items-center gap-3"
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
            <span
              className="inline-block h-1.5 w-1.5 rounded-full align-middle mr-1"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span>{tx.account.name}</span>
            {category && (
              <>
                {" · "}
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full align-middle mr-1"
                  style={{ backgroundColor: category.color }}
                />
                <span>{category.name_es ?? category.name}</span>
              </>
            )}
            {" · "}
            {formatDateTime(tx.transaction_date, tx.transaction_time)}
            {tx.status !== "POSTED" && (
              <span>
                {" · "}
                {tx.status === "PENDING" ? "Pendiente" : "Cancelada"}
              </span>
            )}
            {tx.is_excluded && <span> · Excluida</span>}
          </p>
        </div>
      </Link>
      <span
        className={cn("text-sm font-semibold shrink-0", tx.direction === "INFLOW" && "text-green-600", tx.is_excluded && "line-through")}
      >
        {tx.direction === "INFLOW" ? "+" : "-"}
        {formatCurrency(tx.amount, tx.currency_code)}
      </span>
      <CreateDestinatarioAction tx={tx} categories={categories} className="shrink-0" />
    </div>
  );
}

function TransactionRow({
  tx,
  categories,
}: {
  tx: TransactionWithAccount;
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
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: tx.account.color ?? undefined }}
          />
          <span className="truncate max-w-[120px]">{tx.account.name}</span>
        </span>
      </TableCell>
      <TableCell>
        <InlineCategoryEdit tx={tx} categories={categories} />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDateTime(tx.transaction_date, tx.transaction_time)}
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
        <div className="flex items-center justify-end gap-0.5">
          <CreateDestinatarioAction tx={tx} categories={categories} />
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
        </div>
      </TableCell>
    </TableRow>
  );
}

function InlineCategoryEdit({
  tx,
  categories,
}: {
  tx: TransactionWithAccount;
  categories: CategoryWithChildren[];
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(categoryId: string | null) {
    if (!categoryId) return;
    const previousCategoryId = tx.category_id ?? null;
    startTransition(async () => {
      const result = await categorizeTransaction(tx.id, categoryId);
      if (result?.success) {
        toast.success("Categoría actualizada", {
          action: {
            label: "Deshacer",
            onClick: () => {
              if (previousCategoryId) {
                void categorizeTransaction(tx.id, previousCategoryId);
              } else {
                void uncategorizeTransaction(tx.id);
              }
            },
          },
        });
      } else if (result && !result.success) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className={cn(isPending && "opacity-50 pointer-events-none")}>
      <CategoryZonePicker
        variant="popover"
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
