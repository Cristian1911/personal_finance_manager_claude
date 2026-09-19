"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  GitMerge,
  Trash2,
  MinusCircle,
  Tags,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { dismissEmailPdfStatement } from "@/actions/email-pdf-ingest";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  INLINE_EXPAND_TOGGLE_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import { WizardActionBar } from "./wizard-action-bar";
import { DiffRow } from "./snapshot-diff-row";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatMonthLabel } from "@/lib/utils/date";
import type { ImportResult, ImportScope, ImportSkippedReason } from "@/types/import";
import type { Account, CurrencyCode } from "@/types/domain";

const SKIPPED_REASON_LABELS: Record<ImportSkippedReason, string> = {
  already_imported: "Ya estaba en tu historial",
  duplicate_in_batch: "Repetida en el extracto",
  insert_conflict: "Ya existía (conflicto)",
};

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return formatMonthLabel(new Date(y, m - 1, 1));
}

function scopeHref(scope: ImportScope, uncategorized: boolean): string {
  const params = new URLSearchParams({ accountId: scope.accountId, month: scope.month });
  if (uncategorized) params.set("categoryId", "none");
  return `/transactions?${params.toString()}`;
}

export function StepResults({
  result,
  currency,
  accounts = [],
  onReset,
  emailStatementId,
  onDismissedFromEmail,
}: {
  result: ImportResult;
  currency: CurrencyCode;
  /** For naming the account behind each "Categorizar" link. */
  accounts?: Account[];
  onReset: () => void;
  emailStatementId?: string | null;
  onDismissedFromEmail?: (id: string) => void;
}) {
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Cuenta";
  const uncategorizedScopes = (result.scopes ?? []).filter((s) => s.uncategorized > 0);
  const [showAllScopes, setShowAllScopes] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const visibleScopes = showAllScopes ? uncategorizedScopes : uncategorizedScopes.slice(0, 3);
  const dominantScope = result.scopes?.[0];
  const hasNextSteps =
    (result.uncategorizedCount ?? 0) > 0 ||
    (result.modoAssignments?.length ?? 0) > 0 ||
    (result.sharedCount ?? 0) > 0 ||
    (result.installmentLinkedCount ?? 0) > 0;
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

  const uncategorizedSuffix =
    ((result.uncategorizedCount ?? 0) > 0 ? ` · ${result.uncategorizedCount} sin categoría` : "") +
    ((result.enrichmentErrors ?? 0) > 0
      ? ` · ${result.enrichmentErrors} ${result.enrichmentErrors === 1 ? "reparto con aviso" : "repartos con aviso"}`
      : "");
  const subline = allDuplicates
    ? "Nada nuevo entró. Descartamos la entrada porque ya estaba cubierta."
    : result.errors > 0
      ? `${result.imported} entraron · ${result.errors} con error${uncategorizedSuffix}`
      : `Tu historial quedó al día.${uncategorizedSuffix}`;

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

      {/* What to do next — the import is not "done" while rows sit uncategorized
          or a trip/people are waiting for what just landed. */}
      {hasNextSteps && (
        <section className="space-y-2">
          <p className={SECTION_EYEBROW_CLASS}>Qué sigue</p>
          {uncategorizedScopes.length > 0 && (
            <div className={cn(PANEL_INSET_CLASS, "space-y-2 p-4")}>
              <p className="flex items-center gap-2 text-sm font-medium text-z-white">
                <Tags className="size-4 text-z-brass" />
                Categorizar {result.uncategorizedCount}{" "}
                {result.uncategorizedCount === 1 ? "pendiente" : "pendientes"}
              </p>
              <ul className="space-y-1.5">
                {visibleScopes.map((scope) => (
                  <li key={`${scope.accountId}-${scope.month}`}>
                    <Link
                      href={scopeHref(scope, true)}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors hover:bg-white/[0.04]"
                    >
                      <span className="min-w-0 truncate text-z-sage-light">
                        {accountName(scope.accountId)} · {monthLabel(scope.month)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1 text-z-brass">
                        {scope.uncategorized}
                        <ArrowRight className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {uncategorizedScopes.length > 3 && (
                <button
                  type="button"
                  className={INLINE_EXPAND_TOGGLE_CLASS}
                  aria-expanded={showAllScopes}
                  onClick={() => setShowAllScopes((v) => !v)}
                >
                  {showAllScopes ? "Ver menos" : `y ${uncategorizedScopes.length - 3} más`}
                  <ChevronDown className={cn("size-3.5 transition-transform", showAllScopes && "rotate-180")} />
                </button>
              )}
            </div>
          )}
          {(result.modoAssignments ?? []).map((m) => (
            <Link
              key={m.modoId}
              href={`/modos/${m.modoId}`}
              className={cn(PANEL_INSET_CLASS, "flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/[0.03]")}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-z-white">
                  {m.emoji ? `${m.emoji} ` : ""}
                  {m.name}
                </span>
                <span className="block text-xs text-z-sage-dark">
                  {m.count} {m.count === 1 ? "movimiento agregado" : "movimientos agregados"} al viaje
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1 text-sm text-z-brass">
                Ver viaje
                <ArrowRight className="size-3.5" />
              </span>
            </Link>
          ))}
          {((result.sharedCount ?? 0) > 0 || (result.installmentLinkedCount ?? 0) > 0) && (
            <Link
              href="/deudas-personales"
              className={cn(PANEL_INSET_CLASS, "flex items-center justify-between gap-3 p-4 transition-colors hover:bg-white/[0.03]")}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-sm font-medium text-z-white">
                  <Users className="size-4 text-z-brass" />
                  {result.sharedCount ?? 0} {result.sharedCount === 1 ? "pago compartido" : "pagos compartidos"}
                  {(result.installmentLinkedCount ?? 0) > 0 &&
                    ` · ${result.installmentLinkedCount} ${result.installmentLinkedCount === 1 ? "cuota vinculada" : "cuotas vinculadas"}`}
                </span>
                <span className="block text-xs text-z-sage-dark">Las deudas de las personas ya están registradas.</span>
              </span>
              <ArrowRight className="size-3.5 shrink-0 text-z-brass" />
            </Link>
          )}
        </section>
      )}

      {result.skippedRows && result.skippedRows.length > 0 && (
        <section className={cn(PANEL_INSET_CLASS, "p-3")}>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={showSkipped}
            onClick={() => setShowSkipped((v) => !v)}
          >
            <span className="text-sm font-medium text-z-white">Omitidas ({result.skipped})</span>
            <ChevronDown className={cn("size-4 text-z-sage-dark transition-transform", showSkipped && "rotate-180")} />
          </button>
          {showSkipped && (
            <ul className="mt-2 divide-y divide-white/6">
              {result.skippedRows.map((row, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-z-sage-light">{row.raw_description}</span>
                    <span className="block text-xs text-z-sage-dark">
                      {formatDate(row.transaction_date)} · {formatCurrency(row.amount, row.currency_code as CurrencyCode)} ·{" "}
                      {SKIPPED_REASON_LABELS[row.reason]}
                    </span>
                  </span>
                  {row.existingTransactionId && (
                    <Link
                      href={`/transactions/${row.existingTransactionId}`}
                      className="shrink-0 text-xs font-medium text-z-brass hover:underline"
                    >
                      Ver existente
                    </Link>
                  )}
                </li>
              ))}
              {result.skippedRowsTruncated && (
                <li className="py-2 text-xs text-z-sage-dark">…y {result.skipped - result.skippedRows.length} más.</li>
              )}
            </ul>
          )}
        </section>
      )}

      {result.statementTrayCount != null && result.statementTrayCount > 0 && (
        <div className="rounded-2xl border border-z-alert/20 bg-z-alert/8 p-3 text-sm text-z-alert">
          {result.statementTrayCount === 1
            ? "1 movimiento que llegó por correo o pantallazo no aparece en el extracto."
            : `${result.statementTrayCount} movimientos que llegaron por correo o pantallazo no aparecen en el extracto.`}{" "}
          Al cerrar esta importación los encuentras en la bandeja «Sin respaldo en el extracto» para
          eliminarlos o conservarlos.
        </div>
      )}

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
          <Link href={dominantScope ? scopeHref(dominantScope, false) : "/transactions"}>Ver transacciones</Link>
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
