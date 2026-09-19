"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Inbox, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { resolveStatementTray, type StatementTrayRow } from "@/actions/statement-tray";
import {
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode } from "@/types/domain";

const SOURCE_LABELS: Record<string, string> = {
  EMAIL_IMPORT: "Correo",
  OCR_BATCH: "Pantallazo",
  OCR_SINGLE: "Pantallazo",
};

/**
 * "Sin respaldo en el extracto": card movements that came in by alert email
 * or screenshot inside a period already imported from the statement and
 * that no statement row backed. Usually card-validation holds the bank
 * withdrew. Delete them, or keep them and the tray stops asking.
 */
export function StatementTrayPanel({ rows }: { rows: StatementTrayRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = rows.filter((r) => !hidden.has(r.id));
  if (visible.length === 0) return null;

  function resolve(input: { deleteIds?: string[]; keepIds?: string[] }) {
    const ids = [...(input.deleteIds ?? []), ...(input.keepIds ?? [])];
    startTransition(async () => {
      const result = await resolveStatementTray(input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setHidden((cur) => new Set([...cur, ...ids]));
      const { deleted, kept } = result.data;
      if (deleted > 0) toast.success(deleted === 1 ? "Movimiento eliminado" : `${deleted} movimientos eliminados`);
      else if (kept > 0) toast.success(kept === 1 ? "Movimiento conservado" : `${kept} movimientos conservados`);
      router.refresh();
    });
  }

  return (
    <section id="statement-tray" className={cn(PANEL_INSET_CLASS, "space-y-3 p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className={SECTION_EYEBROW_CLASS}>Bandeja</p>
          <p className="text-sm font-medium text-z-white">
            Sin respaldo en el extracto ({visible.length})
          </p>
          <p className="text-xs text-muted-foreground">
            Llegaron por correo o pantallazo dentro de un periodo ya importado, pero el extracto no los
            trae. Suelen ser validaciones de tarjeta que el banco retira.
          </p>
        </div>
        <Inbox className="mt-0.5 size-4 shrink-0 text-z-brass" />
      </div>

      <ul className="divide-y divide-white/6">
        {visible.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <Link href={`/transactions/${row.id}`} className="min-w-0 flex-1">
              <span className="block truncate text-z-sage-light">{row.description || "Sin descripción"}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {formatDate(row.transaction_date)} · {formatCurrency(row.amount, row.currency_code as CurrencyCode)}
                {row.account_name ? ` · ${row.account_name}` : ""} · {SOURCE_LABELS[row.capture_method] ?? row.capture_method}
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(GHOST_BUTTON_CLASS, "h-8 px-2 text-xs")}
                disabled={pending}
                onClick={() => resolve({ keepIds: [row.id] })}
              >
                Conservar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS, "h-8 px-2 text-xs")}
                disabled={pending}
                onClick={() => resolve({ deleteIds: [row.id] })}
                aria-label={`Eliminar ${row.description || "movimiento sin descripción"}`}
              >
                <Trash2 className="size-3.5" />
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>

      {visible.length > 1 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(GHOST_BUTTON_CLASS, "h-8 text-xs")}
            disabled={pending}
            onClick={() => resolve({ deleteIds: visible.map((r) => r.id) })}
          >
            <Trash2 className="size-3.5" />
            Eliminar todos ({visible.length})
          </Button>
        </div>
      )}
    </section>
  );
}
