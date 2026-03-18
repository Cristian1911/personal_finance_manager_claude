import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { AllocationData } from "@/actions/allocation";

interface AllocationBars5030Props {
  data: AllocationData | null;
}

export function AllocationBars5030({ data }: AllocationBars5030Props) {
  if (!data) {
    return (
      <div className="rounded-xl bg-z-surface-2 border border-z-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Distribucion 50/30/20
        </p>
        <p className="text-sm text-muted-foreground">
          Importa un extracto para ver tu distribucion.
        </p>
      </div>
    );
  }

  const bars = [
    {
      label: "Necesidades",
      barData: data.needs,
      color: "var(--z-income)",
    },
    {
      label: "Deseos",
      barData: data.wants,
      color: "var(--z-alert)",
    },
    {
      label: "Ahorro/Deuda",
      barData: data.savings,
      color:
        data.savings.percent < data.savings.target
          ? "var(--z-debt)"
          : "var(--z-income)",
    },
  ];

  return (
    <div className="rounded-xl bg-z-surface-2 border border-z-border p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Distribucion 50/30/20
      </p>

      {bars.map((bar) => (
        <div key={bar.label} className="mb-4 last:mb-0">
          <div className="flex justify-between text-xs mb-1">
            <span>
              {bar.label}{" "}
              <span className="text-muted-foreground">
                (meta: {bar.barData.target}%)
              </span>
            </span>
            <span
              className={cn(
                "font-bold",
                bar.barData.percent > bar.barData.target + 5 ? "text-z-debt" : ""
              )}
            >
              {Math.round(bar.barData.percent)}% ·{" "}
              {formatCurrency(bar.barData.amount, data.currency)}
            </span>
          </div>

          <div className="relative h-5 bg-z-surface-3 rounded-md overflow-hidden">
            <div
              className="h-full rounded-md"
              style={{
                width: `${Math.min(Math.max(bar.barData.percent, 0), 100)}%`,
                background: bar.color,
              }}
            />
            {/* Target dashed line */}
            <div
              className="absolute top-0 h-full border-l-2 border-dashed border-white/30"
              style={{ left: `${bar.barData.target}%` }}
            />
          </div>
        </div>
      ))}

      {data.untaggedCategories > 0 && (
        <p className="text-[10px] text-muted-foreground mt-3">
          {data.untaggedCategories} categor{data.untaggedCategories === 1 ? "ia sin" : "ias sin"} tipo asignado — afecta precision
        </p>
      )}
    </div>
  );
}
