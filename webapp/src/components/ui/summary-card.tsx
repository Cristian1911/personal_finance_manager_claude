import { cn } from "@/lib/utils";
import { CompactMetricBox } from "@/components/ui/stat-card";

interface SummaryMetric {
  label: string;
  value: React.ReactNode;
  context?: string;
}

interface SummaryCardProps {
  label?: string;
  metrics: [SummaryMetric, SummaryMetric, SummaryMetric];
  className?: string;
}

export function SummaryCard({ label = "Resumen del período", metrics, className }: SummaryCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-z-surface-2/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]",
        className
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-olive-deep">
        {label}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <CompactMetricBox
            key={m.label}
            label={m.label}
            value={m.value}
            context={m.context}
          />
        ))}
      </div>
    </div>
  );
}
