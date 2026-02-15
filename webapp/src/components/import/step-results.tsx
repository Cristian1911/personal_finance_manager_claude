"use client";

import Link from "next/link";
import {
  CheckCircle,
  AlertTriangle,
  MinusCircle,
  ArrowRight,
  RefreshCw,
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

function DiffRow({ diff }: { diff: SnapshotDiff }) {
  const fmt = (v: number | string | null) =>
    typeof v === "number"
      ? formatCurrency(v, "COP" as CurrencyCode)
      : v ?? "---";

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
  onReset,
}: {
  result: ImportResult;
  onReset: () => void;
}) {
  const allDuplicates =
    result.imported === 0 && result.skipped > 0 && result.errors === 0;

  return (
    <div className="space-y-6">
      {allDuplicates && (
        <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 text-sm rounded-md p-3">
          Todas las transacciones ya existian en tu cuenta. Es posible que ya
          hayas importado este extracto.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Importadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <span className="text-2xl font-bold">{result.imported}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Duplicadas omitidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <MinusCircle className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{result.skipped}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Errores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{result.errors}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {result.details.length > 0 && (
        <div className="rounded-md border p-3 space-y-1">
          <p className="text-sm font-medium">Detalles de errores:</p>
          {result.details.map((d, i) => (
            <p key={i} className="text-xs text-destructive">
              {d}
            </p>
          ))}
        </div>
      )}

      {result.accountUpdates && result.accountUpdates.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizaciones de cuenta
          </h3>
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
                      <DiffRow key={diff.field} diff={diff} />
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
