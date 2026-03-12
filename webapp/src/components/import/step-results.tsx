"use client";

import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  MinusCircle,
  ArrowRight,
  RefreshCw,
  GitMerge,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import type { ImportResult, SnapshotDiff } from "@/types/import";
import type { CurrencyCode } from "@/types/domain";

const RATE_FIELDS = new Set([
  "Tasa de interés",
  "Tasa de mora",
]);

const COUNT_FIELDS = new Set([
  "Cuotas en mora",
]);

function formatDiffValue(
  value: number | string | null,
  field: string,
  currency: CurrencyCode
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
      ? "text-emerald-600"
      : diff.changeType === "increased"
        ? "text-red-600"
        : "text-foreground";

  return (
    <div className="flex items-center justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{diff.field}</span>
      <div className="flex items-center gap-2">
        {diff.previousValue !== null && (
          <>
            <span className="text-muted-foreground">
              {fmt(diff.previousValue)}
            </span>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
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
}: {
  result: ImportResult;
  currency: CurrencyCode;
  onReset: () => void;
}) {
  const allDuplicates =
    result.imported === 0 && result.skipped > 0 && result.errors === 0;

  const hasReconciliation =
    result.autoMerged > 0 || result.manualMerged > 0 || result.leftAsSeparate > 0;

  return (
    <div className="space-y-6">
      {allDuplicates && (
        <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-md p-3">
          Todas las transacciones ya existían en tu cuenta. Es posible que ya
          hayas importado este extracto.
        </div>
      )}

      {/* --- Transaction counts --- */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Transacciones</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-2xl font-bold">{result.imported}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Nuevas importadas
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <div className="flex items-center gap-2 mb-1">
              <MinusCircle className="h-4 w-4 text-amber-500" />
              <span className="text-2xl font-bold">{result.skipped}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Ya existían, omitidas
            </p>
          </div>
          {result.errors > 0 && (
            <div className="rounded-lg border p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <span className="text-2xl font-bold">{result.errors}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                No se pudieron importar
              </p>
            </div>
          )}
        </div>
      </div>

      {/* --- Reconciliation (only if relevant) --- */}
      {hasReconciliation && (
        <div>
          <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
            <GitMerge className="h-4 w-4" />
            Reconciliación con entradas manuales
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Transacciones del extracto que coincidían con registros que ingresaste manualmente.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {result.autoMerged > 0 && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  <span className="text-2xl font-bold">{result.autoMerged}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Combinadas automáticamente
                </p>
              </div>
            )}
            {result.manualMerged > 0 && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="h-4 w-4 text-sky-600" />
                  <span className="text-2xl font-bold">{result.manualMerged}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Combinadas por ti
                </p>
              </div>
            )}
            {result.leftAsSeparate > 0 && (
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 mb-1">
                  <MinusCircle className="h-4 w-4 text-slate-500" />
                  <span className="text-2xl font-bold">{result.leftAsSeparate}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Dejadas como separadas
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {result.adjustmentsExcluded != null && result.adjustmentsExcluded > 0 && (
        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 text-sm p-3">
          Se excluyeron {result.adjustmentsExcluded} ajuste(s) manual(es) de saldo que fueron reemplazados por las transacciones del extracto.
        </div>
      )}

      {result.details.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-sm font-medium">Detalles:</p>
          {result.details.map((d, i) => (
            <p key={i} className="text-xs text-destructive">
              {d}
            </p>
          ))}
        </div>
      )}

      {result.accountUpdates && result.accountUpdates.length > 0 && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Datos de la cuenta actualizados
            </h3>
            <p className="text-xs text-muted-foreground">
              Información extraída del encabezado del extracto bancario.
            </p>
          </div>
          {result.accountUpdates.map((update) => (
            <Card key={update.accountId}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  {update.accountName}
                  {update.isFirstImport && (
                    <Badge variant="outline" className="text-xs">
                      Primer extracto
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {update.diffs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Sin cambios respecto al extracto anterior
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {update.diffs.map((diff) => (
                      <DiffRow key={diff.field} diff={diff} currency={currency} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button asChild>
          <Link href="/transactions">Ver transacciones</Link>
        </Button>
        <Button variant="outline" onClick={onReset}>
          Importar otro extracto
        </Button>
      </div>
    </div>
  );
}
