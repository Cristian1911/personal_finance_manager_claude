import { formatCurrency } from "@/lib/utils/currency";
import { formatDebtFreeDate } from "@/components/debt/planner/utils";
import type { DebtCountdownData } from "@/actions/debt-countdown";

interface DebtFreeCountdownProps {
  data: DebtCountdownData | null;
}

export function DebtFreeCountdown({ data }: DebtFreeCountdownProps) {
  // Celebratory state: no debts
  if (!data) {
    return (
      <div className="rounded-xl bg-z-surface-2 border border-z-border p-4 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-z-income/15 text-xl">
          ✓
        </div>
        <div>
          <p className="text-sm font-semibold text-z-income">Libre de deudas!</p>
          <p className="text-xs text-muted-foreground">No tienes cuentas de deuda activas.</p>
        </div>
      </div>
    );
  }

  const progressPercent = Math.min(100, Math.max(0, data.progressPercent));

  return (
    <div className="rounded-xl bg-z-surface-2 border border-z-border p-4 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Libre de deudas en
      </p>

      {/* Headline */}
      <div>
        <p className="text-[42px] font-extrabold leading-none tracking-tight">
          {data.monthsToFree}{" "}
          <span className="text-2xl font-bold">meses</span>
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDebtFreeDate(data.projectedDate)} al ritmo actual
        </p>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Deuda original: {formatCurrency(data.originalDebt, data.currency)}</span>
          <span>Restante: {formatCurrency(data.totalDebt, data.currency)}</span>
        </div>
        <div className="relative h-3 rounded-full bg-z-surface-3 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPercent}%`,
              background: "var(--z-income)",
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground text-right">
          {Math.round(progressPercent)}% pagado
        </p>
      </div>

      {/* Extra payment scenario */}
      {data.extraPaymentScenario && (
        <div
          className="rounded-lg px-3 py-2.5 text-xs space-y-0.5"
          style={{ background: "color-mix(in srgb, var(--z-income) 10%, transparent)" }}
        >
          <p className="font-semibold text-z-income">
            Pagando {formatCurrency(data.extraPaymentScenario.extraAmount, data.currency)} extra/mes
            &rarr; libre en {data.extraPaymentScenario.monthsToFree} meses
          </p>
          <p className="text-muted-foreground">
            Ahorras {formatCurrency(data.extraPaymentScenario.interestSaved, data.currency)} en
            intereses ({data.extraPaymentScenario.monthsSaved} mes
            {data.extraPaymentScenario.monthsSaved !== 1 ? "es" : ""} antes)
          </p>
        </div>
      )}

      {/* Incomplete data warning */}
      {data.incompleteAccounts.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          Datos incompletos para:{" "}
          <span className="text-foreground">{data.incompleteAccounts.join(", ")}</span>
        </p>
      )}
    </div>
  );
}
