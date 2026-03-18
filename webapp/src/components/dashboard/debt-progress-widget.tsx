import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { DebtProgressAccount } from "@/actions/debt-progress";

interface DebtProgressWidgetProps {
  accounts: DebtProgressAccount[];
}

export function DebtProgressWidget({ accounts }: DebtProgressWidgetProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl bg-z-surface-2 border border-z-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Progreso de deudas
        </p>
        <p className="text-sm text-muted-foreground">
          No hay cuentas de deuda activas.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-z-surface-2 border border-z-border p-4 space-y-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        Progreso de deudas
      </p>

      {accounts.map((account) => {
        const isGood = account.progressPercent > 50;
        const barColor = isGood ? "var(--z-income)" : "var(--z-alert)";

        return (
          <div key={account.id}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium truncate pr-2">{account.name}</span>
              <span className="shrink-0 text-muted-foreground">
                {formatCurrency(account.currentBalance, account.currency)}
                {account.initialAmount != null && (
                  <span className="text-[10px] ml-1">
                    / {formatCurrency(account.initialAmount, account.currency)}
                  </span>
                )}
              </span>
            </div>

            <div className="relative h-2 rounded-full bg-z-surface-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${account.progressPercent}%`,
                  background: barColor,
                }}
              />
            </div>

            {account.initialAmount != null && (
              <p
                className={cn(
                  "text-[10px] mt-0.5 text-right",
                  isGood ? "text-z-income" : "text-muted-foreground"
                )}
              >
                {Math.round(account.progressPercent)}% pagado
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
