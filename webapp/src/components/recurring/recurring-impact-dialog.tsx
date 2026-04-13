"use client";

import { useEffect, useState, useTransition } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  getRecurringTemplateImpact,
  type TemplateImpact,
} from "@/actions/recurring-templates";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { AlertTriangle, Pause, Trash2 } from "lucide-react";
import type { CurrencyCode } from "@/types/domain";

interface RecurringImpactDialogProps {
  templateId: string;
  templateName: string;
  currencyCode: CurrencyCode;
  action: "delete" | "pause";
  onConfirm: () => void | Promise<void>;
  trigger: React.ReactNode;
}

export function RecurringImpactDialog({
  templateId,
  templateName,
  currencyCode,
  action,
  onConfirm,
  trigger,
}: RecurringImpactDialogProps) {
  const [open, setOpen] = useState(false);
  const [impact, setImpact] = useState<TemplateImpact | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setImpact(null);
      return;
    }
    let stale = false;
    setLoading(true);
    getRecurringTemplateImpact(templateId).then((result) => {
      if (stale) return;
      if (result.success) setImpact(result.data);
      setLoading(false);
    });
    return () => { stale = true; };
  }, [open, templateId]);

  const isDelete = action === "delete";
  const Icon = isDelete ? Trash2 : Pause;
  const title = isDelete
    ? `Eliminar "${templateName}"`
    : `Pausar "${templateName}"`;
  const confirmLabel = isDelete ? "Eliminar definitivamente" : "Pausar plantilla";
  const pendingLabel = isDelete ? "Eliminando..." : "Pausando...";

  function handleConfirm() {
    startTransition(async () => {
      await onConfirm();
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-z-debt/10">
              <Icon className="size-5 text-z-debt" />
            </div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="sr-only">
            Impacto de {isDelete ? "eliminar" : "pausar"} esta plantilla recurrente
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <div className="space-y-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ) : impact ? (
            <ImpactSummary
              impact={impact}
              action={action}
              currency={currencyCode}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No se pudo cargar el impacto.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading || isPending}
            className={BRASS_BUTTON_CLASS}
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ImpactSummary({
  impact,
  action,
  currency,
}: {
  impact: TemplateImpact;
  action: "delete" | "pause";
  currency: CurrencyCode;
}) {
  const isDelete = action === "delete";
  const isIncome = impact.direction === "INFLOW";
  const items: string[] = [];

  if (isDelete) {
    if (impact.pendingCount > 0) {
      items.push(
        `Se eliminarán ${impact.pendingCount} ${impact.pendingCount === 1 ? "ocurrencia pendiente" : "ocurrencias pendientes"} por ${formatCurrency(impact.pendingTotal, currency)}.`
      );
    }
    if (impact.within14Days.count > 0) {
      items.push(
        isIncome
          ? `Esto reduce tus ingresos esperados en ${formatCurrency(impact.within14Days.total, currency)} en los próximos 14 días.`
          : `Esto libera ${formatCurrency(impact.within14Days.total, currency)} de tu margen disponible (próximos 14 días).`
      );
    }
    if (impact.planningEntriesCount > 0) {
      items.push(
        `${impact.planningEntriesCount} ${impact.planningEntriesCount === 1 ? "entrada" : "entradas"} del planificador quedarán sin plantilla asociada.`
      );
    }
  } else {
    // Pause
    if (impact.pendingCount > 0) {
      items.push(
        `Las ${impact.pendingCount} ocurrencias pendientes seguirán activas, pero no se generarán nuevas.`
      );
    } else {
      items.push("No hay ocurrencias pendientes. No se generarán nuevas al pausar.");
    }
  }

  if (isIncome) {
    items.push(
      `Tu ingreso recurrente estimado baja en ${formatCurrency(impact.monthlyAmount, currency)}/mes.`
    );
  } else {
    items.push(
      `Tus obligaciones fijas bajan en ${formatCurrency(impact.monthlyAmount, currency)}/mes.`
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-lg border border-z-alert/20 bg-z-alert/5 p-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-z-alert" />
        <div className="space-y-1 text-sm">
          {items.map((item, i) => (
            <p key={i}>{item}</p>
          ))}
        </div>
      </div>
      {isDelete && (
        <p className="text-xs text-muted-foreground">
          Esta acción no se puede deshacer. Las transacciones ya registradas no se eliminan.
        </p>
      )}
    </div>
  );
}
