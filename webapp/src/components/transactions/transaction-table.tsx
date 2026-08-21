"use client";

import { useState, useTransition } from "react";
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
import { groupTransferPairs } from "@/lib/utils/transfer-pairs";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDateTime } from "@/lib/utils/date";
import { toggleExcludeTransaction } from "@/actions/transactions";
import { categorizeTransaction, uncategorizeTransaction, assignDestinatario } from "@/actions/categorize";
import { DestinatarioCreateDialog } from "@/components/destinatarios/destinatario-create-form";
import { toast } from "sonner";
import type { TransactionWithAccount, CategoryWithChildren, CurrencyCode , TransferLegSummary } from "@/types/domain";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowRight, ArrowUpRight, Eye, EyeOff, FileUp, Inbox, Plus, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function TransactionTable({
  transactions,
  transferLegs = [],
  categories,
}: {
  transactions: TransactionWithAccount[];
  /** Counterpart legs for transfers split across pages — never rendered as rows. */
  transferLegs?: TransferLegSummary[];
  categories: CategoryWithChildren[];
}) {

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
            {/* A transfer's two legs collapse into one origin → destination row
                when both are on this page; otherwise each renders on its own. */}
            {groupTransferPairs(transactions, transferLegs).map((item) => (
              <TransactionRow
                key={item.tx.id}
                tx={item.tx}
                counterpart={item.kind === "pair" ? item.counterpart : undefined}
                categories={categories}
              />
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

/** A transfer is neither spend nor income — every metric filters it out. The
 *  feed says so: no +/−, no income/expense colour, and the flow between the two
 *  accounts as the title. With only one leg on the page it states the half it
 *  can prove instead of inventing the other account. */
function transferPresentation(
  tx: TransactionWithAccount,
  counterpart?: TransactionWithAccount | TransferLegSummary,
): {
  title: string;
  subtitle: string;
  origin: { name: string; color: string | null } | null;
  destination: { name: string; color: string | null } | null;
} | null {
  if (!tx.transfer_group_id) return null;
  const origin = counterpart ? (tx.direction === "OUTFLOW" ? tx : counterpart).account : null;
  const destination = counterpart ? (tx.direction === "OUTFLOW" ? counterpart : tx).account : null;
  if (origin && destination) {
    // The OUTFLOW leg carries the movement's real name ("Pago NU tarjeta"); the
    // INFLOW side is usually just the source account repeated. Fall back to the
    // flow when neither leg was ever named.
    const outflowLeg =
      tx.direction === "OUTFLOW" ? tx : counterpart!.direction === "OUTFLOW" ? counterpart! : null;
    return {
      title:
        outflowLeg?.merchant_name ||
        outflowLeg?.clean_description ||
        `${origin.name} → ${destination.name}`,
      subtitle: `Transferencia · ${origin.name} → ${destination.name}`,
      origin,
      destination,
    };
  }
  return {
    title:
      tx.direction === "OUTFLOW" ? `Salió de ${tx.account.name}` : `Entró a ${tx.account.name}`,
    subtitle: "Transferencia · el otro lado no está en esta vista",
    origin: tx.direction === "OUTFLOW" ? tx.account : null,
    destination: tx.direction === "OUTFLOW" ? null : tx.account,
  };
}

function TransactionRow({
  tx,
  counterpart,
  categories,
}: {
  tx: TransactionWithAccount;
  counterpart?: TransactionWithAccount | TransferLegSummary;
  categories: CategoryWithChildren[];
}) {
  const [isPending, startTransition] = useTransition();
  const transfer = transferPresentation(tx, counterpart);

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
        {transfer ? (
          <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
        ) : tx.direction === "INFLOW" ? (
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
            {transfer?.title ??
              (tx.merchant_name ||
                tx.clean_description ||
                tx.raw_description ||
                "Sin descripción")}
          </p>
        </Link>
      </TableCell>
      <TableCell>
        {counterpart ? (
          // The merged row's title already names both accounts; repeating them
          // here would be noise, so the cell carries the pair's dot pair only.
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            title={`${transfer?.origin?.name} → ${transfer?.destination?.name}`}
          >
            {/* Origin first, always — the anchor row can be either leg, so ordering
                by `tx` would draw the arrow backwards half the time. Colour alone
                can't carry this either, hence the sr-only names. */}
            <span className="sr-only">
              De {transfer?.origin?.name} a {transfer?.destination?.name}
            </span>
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: transfer?.origin?.color ?? undefined }}
            />
            <ArrowRight aria-hidden="true" className="size-3 shrink-0" />
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: transfer?.destination?.color ?? undefined }}
            />
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: tx.account.color ?? undefined }}
            />
            <span className="truncate max-w-[120px]">{tx.account.name}</span>
          </span>
        )}
      </TableCell>
      <TableCell>
        {transfer ? (
          <span className="text-xs text-muted-foreground" title={transfer.subtitle}>
            Transferencia{counterpart ? "" : " · solo un lado"}
          </span>
        ) : (
          <InlineCategoryEdit tx={tx} categories={categories} />
        )}
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
          className={cn(
            "font-medium tabular-nums",
            transfer
              ? "text-muted-foreground"
              : tx.direction === "INFLOW" && "text-green-600",
            tx.is_excluded && "line-through",
          )}
        >
          {!transfer && (tx.direction === "INFLOW" ? "+" : "-")}
          {formatCurrency(tx.amount, tx.currency_code)}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          {!transfer && <CreateDestinatarioAction tx={tx} categories={categories} />}
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
