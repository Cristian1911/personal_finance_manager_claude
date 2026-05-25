"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/currency";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { WizardActionBar } from "./wizard-action-bar";
import { DiffRow } from "./snapshot-diff-row";
import type { ImportResult } from "@/types/import";
import type { CurrencyCode } from "@/types/domain";

const SALDO_FIELD = "Saldo capital";

/**
 * Loan-tailored results step. Loan imports create no transactions — the story is
 * how the loan evolved since the last statement. Hero-promotes the saldo-capital
 * change (from the snapshot diff) and lists the full month-over-month evolution.
 */
export function LoanStepResults({
  result,
  currency,
  onReset,
}: {
  result: ImportResult;
  currency: CurrencyCode;
  onReset: () => void;
}) {
  const update = result.accountUpdates?.[0];
  // A loan import applies exactly one account. No accountUpdate means the
  // statement wasn't applied (e.g. a failed snapshot/account write surfaced in
  // result.details) — treat it as a failure, not a silent success.
  const failed = result.errors > 0 || !update;
  const saldoDiff = update?.diffs.find((d) => d.field === SALDO_FIELD);

  const paidDown =
    saldoDiff &&
    typeof saldoDiff.previousValue === "number" &&
    typeof saldoDiff.currentValue === "number"
      ? saldoDiff.previousValue - saldoDiff.currentValue
      : null;

  const { headline, subline } = (() => {
    if (failed) {
      return {
        headline: "No pudimos aplicar el extracto",
        subline: "Revisa los detalles e intenta de nuevo.",
      };
    }
    if (update?.isFirstImport) {
      const saldo =
        typeof saldoDiff?.currentValue === "number"
          ? formatCurrency(saldoDiff.currentValue, currency)
          : null;
      return {
        headline: "Préstamo registrado",
        subline: saldo
          ? `Saldo capital inicial: ${saldo}.`
          : "Guardamos el estado de tu préstamo.",
      };
    }
    if (paidDown != null && paidDown > 0) {
      return {
        headline: `Abonaste ${formatCurrency(paidDown, currency)} al capital`,
        subline: "Tu saldo bajó respecto al extracto anterior.",
      };
    }
    if (paidDown != null && paidDown < 0) {
      return {
        headline: `El capital subió ${formatCurrency(-paidDown, currency)}`,
        subline: "El saldo creció respecto al extracto anterior.",
      };
    }
    return {
      headline: "Extracto aplicado",
      subline: "Actualizamos el estado de tu préstamo.",
    };
  })();

  const hasEvolution = (update?.diffs.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col items-center py-4 text-center">
        {failed ? (
          <AlertTriangle className="h-16 w-16 text-z-alert" strokeWidth={1.5} />
        ) : paidDown != null && paidDown > 0 ? (
          <TrendingDown className="h-16 w-16 text-z-income" strokeWidth={1.5} />
        ) : (
          <CheckCircle2 className="h-16 w-16 text-z-income" strokeWidth={1.5} />
        )}
        <h3 className="mt-4 text-xl font-bold text-z-white">{headline}</h3>
        <p className="mt-1 text-sm text-z-sage-light">{subline}</p>
      </div>

      {update && (
        <section className="rounded-2xl border border-white/6 bg-z-surface-2/65 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-z-white">
            <RefreshCw className="h-4 w-4" />
            {update.accountName || "Préstamo"}
            {update.isFirstImport && (
              <span className="rounded-full border border-white/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
                Primer extracto
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-z-sage-dark">
            {update.isFirstImport
              ? "Estado tomado del encabezado del extracto."
              : "Cambios respecto al extracto anterior."}
          </p>
          <div className="mt-3">
            {hasEvolution ? (
              <div className="space-y-0.5">
                {update.diffs.map((diff) => (
                  <DiffRow key={diff.field} diff={diff} currency={currency} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-z-sage-dark">
                Sin cambios respecto al anterior.
              </p>
            )}
          </div>
        </section>
      )}

      {result.details.length > 0 && (
        <div className="space-y-1 rounded-2xl border border-white/6 bg-z-surface-2/40 p-3">
          <p className="text-sm font-medium text-z-white">Detalles</p>
          {result.details.map((d, i) => (
            <p key={i} className="text-xs text-z-sage-dark">
              {d}
            </p>
          ))}
        </div>
      )}

      <WizardActionBar>
        <Button variant="outline" onClick={onReset} className={GHOST_BUTTON_CLASS}>
          Importar otro
        </Button>
        <Button asChild className={BRASS_BUTTON_CLASS}>
          <Link href="/deudas">Ver préstamos</Link>
        </Button>
      </WizardActionBar>
    </div>
  );
}
