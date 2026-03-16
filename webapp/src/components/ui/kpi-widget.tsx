import { cn } from "@/lib/utils";

type SemanticColor = "income" | "expense" | "debt" | "alert" | "neutral";

interface KPIWidgetProps {
  label: string;
  value: string;
  trend?: { direction: "up" | "down" | "flat"; text: string };
  icon?: React.ReactNode;
  semanticColor?: SemanticColor;
  className?: string;
}

const colorMap: Record<SemanticColor, { icon: string; trend: Record<string, string> }> = {
  income: { icon: "bg-z-income/10 text-z-income", trend: { up: "text-z-income", down: "text-z-debt", flat: "text-muted-foreground" } },
  expense: { icon: "bg-z-expense/10 text-z-expense", trend: { up: "text-z-debt", down: "text-z-income", flat: "text-muted-foreground" } },
  debt: { icon: "bg-z-debt/10 text-z-debt", trend: { up: "text-z-debt", down: "text-z-income", flat: "text-muted-foreground" } },
  alert: { icon: "bg-z-alert/10 text-z-alert", trend: { up: "text-z-alert", down: "text-z-income", flat: "text-muted-foreground" } },
  neutral: { icon: "bg-muted text-muted-foreground", trend: { up: "text-z-income", down: "text-z-debt", flat: "text-muted-foreground" } },
};

export function KPIWidget({ label, value, trend, icon, semanticColor = "neutral", className }: KPIWidgetProps) {
  const colors = colorMap[semanticColor];
  const trendColor = trend ? (colors.trend[trend.direction] ?? "text-muted-foreground") : "";
  const trendArrow = trend?.direction === "up" ? "\u2191" : trend?.direction === "down" ? "\u2193" : "\u2192";

  return (
    <div className={cn("flex items-start justify-between rounded-[14px] bg-z-surface-2 p-4", className)}>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight">{value}</p>
        {trend && (
          <p className={cn("mt-0.5 text-[11px]", trendColor)}>
            {trendArrow} {trend.text}
          </p>
        )}
      </div>
      {icon && (
        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", colors.icon)}>
          {icon}
        </div>
      )}
    </div>
  );
}
