"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  GitMerge,
  Trash2,
  MinusCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { dismissEmailPdfStatement } from "@/actions/email-pdf-ingest";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { WizardActionBar } from "./wizard-action-bar";
import { cn } from "@/lib/utils";
import type { ImportResult, SnapshotDiff } from "@/types/import";
import type { CurrencyCode } from "@/types/domain";

const RATE_FIELDS = new Set(["Tasa de interés", "Tasa de mora"]);
const COUNT_FIELDS = new Set(["Cuotas en mora"]);

function formatDiffValue(
  value: number | string | null,
  field: string,
  currency: CurrencyCode,
): string {
  if (value === null || value === undefined) return "---";
  if (typeof value === "string") return value;
  if (RATE_FIELDS.has(field)) return `${value}% E.A.`;
  if (COUNT_FIELDS.has(field)) return `${value}`;
  return formatCurrency(value, currency);
}

function DiffRow({ diff, currency }: { diff: SnapshotDiff; currency: CurrencyCode }) {
  const fmt = (v: number | string | null) => formatDiffValue(v, diff.field, currency);
  const colorClass =
    diff.changeType === "decreased"
      ? "text-z-income"
      : diff.changeType === "increased"
        ? "text-z-debt"
        : "text-z-sage-light";

  return (
    <div className="flex items-center justify-between py-0.5 text-xs">
      <span className="text-z-sage-dark">{diff.field}</span>
      <div className="flex items-center gap-2">
        {diff.previousValue !== null && (
          <>
            <span className="text-z-sage-dark">{fmt(diff.previousValue)}</span>
            <ArrowRight className="h-3 w-3 text-z-sage-dark" />
          </>
        )}
        <span className={colorClass}>{fmt(diff.currentValue)}</span>
      </div>
    </div>
  );
}

export function StepResults({
  result,
  currency,
  onReset,
  emailStatementId,
  onDismissedFromEmail,
}: {
  result: ImportResult;
  currency: CurrencyCode;
  onReset: () => void;
  emailStatementId?: string | null;
  onDismissedFromEmail?: (id: string) => void;
}) {
  const allDuplicates =
    result.imported === 0 && result.skipped > 0 && result.errors === 0;

  const hasReconciliation =
    result.autoMerged > 0 || result.manualMerged > 0 || result.leftAsSeparate > 0;

  const [dismissed, setDismissed] = useState(false);
  const [isDismissing, startDismiss] = useTransition();

  function handleDismiss() {
    if (!emailStatementId) return;
    startDismiss(async () => {
      const res = await dismissEmailPdfStatement(emailStatementId);
      if (res.success) {
        setDismissed(true);
        onDismissedFromEmail?.(emailStatementId);
        toast.success("Entrada del correo descartada");
      } else {
        toast.error(res.error ?? "No se pudo descartar");
      }
    });
  }

  const headline =
    result.errors > 0
      ? "Terminamos con avisos"
      : allDuplicates
        ? "Ya tenías todo esto"
        : `${result.imported} ${result.imported === 1 ? "movimiento importado" : "movimientos importados"}`;

  const subline = allDuplicates
    ? "Nada nuevo entró. Descartamos la entrada porque ya estaba cubierta."
    : result.errors > 0
      ? `${result.imported} entraron · ${result.errors} con error`
      : "Tu historial quedó al día.";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col items-center py-4 text-center">
        {result.errors > 0 ? (
          <AlertTriangle className="h-16 w-16 text-z-alert" strokeWidth={1.5} />
        ) : (
          <CheckCircle2 className="h-16 w-16 text-z-income" strokeWidth={1.5} />
        )}
        <h3 className="mt-4 text-xl font-bold text-z-white">{headline}</h3>
        <p className="mt-1 text-sm text-z-sage-light">{subline}</p>
      </div>

      {allDuplicates && emailStatementId && !dismissed && (
        <div className="space-y-2 rounded-2xl border border-z-alert/20 bg-z-alert/8 p-4 text-sm text-z-alert">
          <p>
            Es posible que ya hubieras importado este extracto por otra vía. Puedes
            descartar la entrada del correo para despejar la bandeja.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDismiss}
            disabled={isDismissing}
            className="gap-1.5"
          >
            <Trash2 className="size-3.5" />
            {isDismissing ? "Descartando..." : "Descartar entrada del correo"}
          </Button>
        </div>
      )}

      {/* Summary rows */}
      <section className="rounded-2xl border border-white/6 bg-z-surface-2/65 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Resumen
        </p>
        <dl className="mt-3 space-y-2">
          <SummaryRow
            icon={<CheckCircle2 className="h-4 w-4 text-z-income" />}
            label="Nuevas importadas"
            value={result.imported}
          />
          <SummaryRow
            icon={<MinusCircle className="h-4 w-4 text-z-alert" />}
            label="Ya existían, omitidas"
            value={result.skipped}
          />
          {result.errors > 0 && (
            <SummaryRow
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              label="No se pudieron importar"
              value={result.errors}
              valueTone="destructive"
            />
          )}
          {hasReconciliation && (
            <>
              <div className="my-3 h-px bg-white/6" />
              {result.autoMerged > 0 && (
                <SummaryRow
                  icon={<GitMerge className="h-4 w-4 text-z-brass" />}
                  label="Fusionadas automáticamente"
                  value={result.autoMerged}
                />
              )}
              {result.manualMerged > 0 && (
                <SummaryRow
                  icon={<RefreshCw className="h-4 w-4 text-z-brass" />}
                  label="Fusionadas por ti"
                  value={result.manualMerged}
                />
              )}
              {result.leftAsSeparate > 0 && (
                <SummaryRow
                  icon={<MinusCircle className="h-4 w-4 text-z-sage-dark" />}
                  label="Dejadas como separadas"
                  value={result.leftAsSeparate}
                />
              )}
            </>
          )}
        </dl>
      </section>

      {result.adjustmentsExcluded != null && result.adjustmentsExcluded > 0 && (
        <div className="rounded-2xl border border-z-alert/20 bg-z-alert/8 p-3 text-sm text-z-alert">
          Se excluyeron {result.adjustmentsExcluded} ajuste(s) manual(es) de saldo que
          fueron reemplazados por el extracto.
        </div>
      )}

      {result.details.length > 0 && (
        <div className="rounded-2xl border border-white/6 bg-z-surface-2/40 p-3 space-y-1">
          <p className="text-sm font-medium text-z-white">Detalles</p>
          {result.details.map((d, i) => (
            <p key={i} className="text-xs text-z-sage-dark">
              {d}
            </p>
          ))}
        </div>
      )}

      {result.accountUpdates && result.accountUpdates.length > 0 && (
        <section className="space-y-2">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-z-white">
              <RefreshCw className="h-4 w-4" />
              Datos de la cuenta actualizados
            </p>
            <p className="text-xs text-z-sage-dark">
              Información extraída del encabezado del extracto.
            </p>
          </div>
          {result.accountUpdates.map((update, idx) => (
            <div
              key={`${update.accountId}-${idx}`}
              className="rounded-2xl border border-white/6 bg-z-surface-2/65 p-4"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-z-white">
                {update.accountName}
                {update.isFirstImport && (
                  <span className="rounded-full border border-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                    Primer extracto
                  </span>
                )}
              </p>
              <div className="mt-2">
                {update.diffs.length === 0 ? (
                  <p className="text-xs text-z-sage-dark">Sin cambios respecto al anterior.</p>
                ) : (
                  <div className="space-y-0.5">
                    {update.diffs.map((diff) => (
                      <DiffRow key={diff.field} diff={diff} currency={currency} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      <WizardActionBar>
        <Button variant="outline" onClick={onReset} className={GHOST_BUTTON_CLASS}>
          Importar otro
        </Button>
        <Button asChild className={BRASS_BUTTON_CLASS}>
          <Link href="/transactions">Ver transacciones</Link>
        </Button>
      </WizardActionBar>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
  valueTone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  valueTone?: "destructive";
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <span className="text-sm text-z-sage-light">{label}</span>
      </div>
      <span
        className={cn(
          "text-lg font-bold tabular-nums",
          valueTone === "destructive" ? "text-destructive" : "text-z-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}
