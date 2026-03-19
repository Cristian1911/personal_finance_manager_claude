import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

interface CashFlowHeroStripProps {
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  remaining: number;
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
  fixedExpenses,
  variableExpenses,
  remaining,
  currency,
}: CashFlowHeroStripProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <FlowNode
        label="Ingresos"
        amount={income}
        currency={currency}
        valueClassName="text-z-income"
      />
      <Arrow />
      <FlowNode
        label="Fijos"
        amount={fixedExpenses}
        currency={currency}
        valueClassName="text-z-expense"
      />
      <Arrow />
      <FlowNode
        label="Variable"
        amount={variableExpenses}
        currency={currency}
        valueClassName="text-z-expense"
      />
      <Arrow />
      <FlowNode
        label="Queda"
        amount={remaining}
        currency={currency}
        valueClassName="text-z-income"
        nodeClassName="border-z-income"
      />
    </div>
  );
}
