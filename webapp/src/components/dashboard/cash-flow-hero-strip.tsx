import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface CashFlowHeroStripProps {
  income: number;
  expenses: number;
  balance: number;
  currency: CurrencyCode;
}

interface FlowNodeProps {
  label: string;
  amount: number;
  currency: CurrencyCode;
  valueClassName?: string;
  nodeClassName?: string;
}

function FlowNode({ label, amount, currency, valueClassName = "", nodeClassName = "" }: FlowNodeProps) {
  return (
    <div className={cn("bg-z-surface-2 border border-z-border rounded-[10px] px-3 py-2", nodeClassName)}>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={cn("text-[16px] font-extrabold", valueClassName)}>
        {formatCurrency(amount, currency)}
      </p>
    </div>
  );
}

function Arrow() {
  return <span className="text-muted-foreground text-lg select-none">→</span>;
}

export function CashFlowHeroStrip({
  income,
  expenses,
  balance,
  currency,
}: CashFlowHeroStripProps) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Flujo del mes
        </p>
        <p className="text-xs text-muted-foreground">
          Resume lo que entró y salió este mes. No es el mismo cálculo que tu disponible para gastar.
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <FlowNode
          label="Entró este mes"
          amount={income}
          currency={currency}
          valueClassName="text-z-income"
        />
        <Arrow />
        <FlowNode
          label="Salió este mes"
          amount={expenses}
          currency={currency}
          valueClassName="text-z-expense"
        />
        <Arrow />
        <FlowNode
          label="Balance del mes"
          amount={balance}
          currency={currency}
          valueClassName={balance < 0 ? "text-z-debt" : "text-z-income"}
          nodeClassName={balance < 0 ? "border-z-debt" : "border-z-income"}
        />
      </div>
    </div>
  );
}
